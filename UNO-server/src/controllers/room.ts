import type { RoomInfo } from 'types/room';
import { emitGameOver, emitToNextTurn } from '../services/game';
import type { ClientRoomEvents, ClientToServerEvents, RespondFromServer } from 'types/server';
import { createPlayer, createRoom, emitAllPlayers, findRoomBySocket, MAX_ROOM_PLAYERS, roomCollection, updatePlayerListToPlayers, userInWhichRoom } from '../services/room';
import { randomCoding } from '../utils';
import { deleteKey, get, set } from '../utils/customCRUD';
import WebSocket from 'ws';

const roomControllers: Pick<ClientToServerEvents, ClientRoomEvents> = {
  CREATE_ROOM: async (data, ws) => {
    const code = randomCoding();
    let roomInfo: RoomInfo;
    set(roomCollection, code, (roomInfo = createRoom(data, ws, code)));
    send(ws, {
      message: '房间创建成功',
      data: roomInfo,
      type: 'RES_CREATE_ROOM',
    });
  },
  LIST_ROOMS: (data, ws) => {
    const query = data?.query?.trim().toLowerCase() || '';
    const rooms = [...roomCollection.values()]
      .filter((roomInfo) => roomInfo.status === 'WAITING' && roomInfo.players.length < MAX_ROOM_PLAYERS)
      .filter((roomInfo) => {
        if (!query) return true;
        return [roomInfo.roomName, roomInfo.roomCode, roomInfo.owner.name]
          .some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => b.createTime - a.createTime)
      .map((roomInfo) => ({
        roomCode: roomInfo.roomCode,
        roomName: roomInfo.roomName,
        ownerName: roomInfo.owner.name,
        playerCount: roomInfo.players.length,
        maxPlayers: MAX_ROOM_PLAYERS,
        status: 'WAITING' as const,
        createTime: roomInfo.createTime
      }));
    send(ws, { data: rooms, type: 'RES_ROOM_LIST' });
  },
  JOIN_ROOM: async (data, ws, wss) => {
    const { roomCode, userInfo } = data;
    const roomInfo = get(roomCollection, roomCode)

    if (!roomInfo) {
      return send(ws, {
        message: '房间不存在',
        data: null,
        type: 'RES_JOIN_ROOM',
      })
    }
    if (roomInfo.players.length >= MAX_ROOM_PLAYERS) {
      return send(ws, {
        message: `房间已满，最多 ${MAX_ROOM_PLAYERS} 人`,
        data: null,
        type: 'RES_JOIN_ROOM',
      })
    }
    if (roomInfo.status === 'GAMING') {
      return send(ws, {
        message: '该房间已开始游戏',
        data: null,
        type: 'RES_JOIN_ROOM',
      })
    } else if (roomInfo.status === 'END') {
      return send(ws, {
        message: '该房间游戏已结束',
        data: null,
        type: 'RES_JOIN_ROOM',
      })
    } else {
      roomInfo.players.push(createPlayer(userInfo, ws));
      // 触发其他客户端更新玩家列表
      updatePlayerListToPlayers(roomCode, roomInfo.players, `玩家 ${userInfo.name} 进入`);
      return send(ws, {
        message: '加入房间成功',
        data: roomInfo,
        type: 'RES_JOIN_ROOM',
      });
    }
  },
  LEAVE_ROOM: async (data, ws) => {
    const { roomCode, userInfo } = data
    const roomInfo = get(roomCollection, roomCode);
    if (!roomInfo) {
      return send(ws, { message: '房间不存在', data: null, type: 'RES_LEAVE_ROOM' });
    }
    handlePlayerLeave(roomCode, roomInfo, ws, userInfo?.name || '玩家');
    send(ws, {
      message: '您已离开房间',
      data: null,
      type: 'RES_LEAVE_ROOM'
    })
  },
  DISSOLVE_ROOM: async (data, ws) => {
    const code = data;
    dissolveRoom(code);
    emitAllPlayers(code, {
      message: '房间已解散',
      data: null,
      type: 'RES_DISSOLVE_ROOM'
    })
    send(ws, {
      message: '房间已解散',
      data: null,
      type: 'RES_DISSOLVE_ROOM'
    })
  },
  READY: async (data, ws) => {
    const { roomCode, ready } = data;
    const roomInfo = get(roomCollection, roomCode);
    if (!roomInfo) return;
    const player = roomInfo.players.find((item) => item.socketInstance === ws);
    if (!player) return;
    player.ready = ready;
    updatePlayerListToPlayers(roomCode, roomInfo.players, `${player.name} ${ready ? '已准备' : '取消准备'}`);
  }
};
export default roomControllers;



function dissolveRoom(code: string) {
  deleteKey(roomCollection, code)
  roomCollection.delete(code);
}

/**
 * 离开房间
 * @param ws 玩家websocket实例
 * @param roomInfo 房间信息
 * @returns 返回玩家原来在队伍的位置,不在房间时返回 -1
 */
function leaveRoom(ws: WebSocket.WebSocket, roomInfo: RoomInfo) {
  const idx = roomInfo.players.findIndex((item) => item.socketInstance === ws)
  if (idx < 0) return -1;
  roomInfo.players.splice(idx, 1)
  userInWhichRoom.delete(ws)
  return idx;
}

/**
 * 处理一名玩家离开/掉线后的房间收尾:空房回收、房主转移、对局中人数不足则结束本局。
 */
function handlePlayerLeave(roomCode: string, roomInfo: RoomInfo, ws: WebSocket.WebSocket, leftName: string) {
  const idx = leaveRoom(ws, roomInfo);
  if (idx < 0) return;

  // 房间已空,直接回收(房间只要有人才保留)
  if (roomInfo.players.length === 0) {
    dissolveRoom(roomCode);
    return;
  }

  // 房主离开则把房主转移给现有第一位玩家
  const ownerStillHere = roomInfo.players.some(
    (player) => player.id === roomInfo.owner.id && player.name === roomInfo.owner.name
  );
  if (!ownerStillHere) {
    roomInfo.owner = roomInfo.players[0];
    roomInfo.owner.ready = false;
    // 只同步房主与玩家,避免泄露牌堆
    emitAllPlayers(roomCode, {
      message: `房主已变更为 ${roomInfo.owner.name}`,
      data: { ...roomInfo, gameCards: [] },
      type: 'UPDATE_ROOM_INFO'
    });
  }

  // 对局中人数不足两人,结束本局(真人房会自动重置回等待)
  if (roomInfo.status === 'GAMING' && roomInfo.players.length < 2) {
    emitGameOver(roomInfo, roomCode);
    return;
  }

  updatePlayerListToPlayers(roomCode, roomInfo.players, `玩家 ${leftName} 离开房间`);

  // 对局中修正出牌顺序:离开者在当前出牌者之前则前移,正是当前出牌者则进入下一轮
  if (roomInfo.status === 'GAMING') {
    if (idx === roomInfo.order) {
      if (roomInfo.order >= roomInfo.players.length) roomInfo.order = -1;
      emitToNextTurn(roomCode, roomInfo);
    } else if (idx < roomInfo.order) {
      roomInfo.order -= 1;
    }
  }
}

/**
 * socket 断开时,把该玩家从其所在房间移除。
 */
export function handlePlayerDisconnect(ws: WebSocket.WebSocket) {
  const found = findRoomBySocket(ws);
  if (!found) return;
  const { roomCode, roomInfo } = found;
  const player = roomInfo.players.find((item) => item.socketInstance === ws);
  handlePlayerLeave(roomCode, roomInfo, ws, player?.name || '玩家');
}

export function send(sc: WebSocket.WebSocket, data: RespondFromServer) {
  try {
    const stringify = JSON.stringify(data, (key, value) => {
      // 不传递ws实例对象
      if (key === 'socketInstance') {
        return undefined;
      }
      return value
    });
    sc.send(stringify)
  } catch (error) {
    console.error(error)
  }
}

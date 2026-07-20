import { createAIPlayer, createRoom, emitAllPlayers, isRoomOwner, roomCollection, updateRoomInfoAtStart } from '../services/room';
import { get } from '../utils/customCRUD';
import {
  checkCards,
  changePlayerUNOStatus,
  dealCardsToPlayers,
  drawCardsForPlayer,
  emitAfterPenalty,
  emitGameOver,
  emitToNextTurn,
  emitToPlayerTurn,
  getActiveColor,
  getNextOrder,
  getPlayConstraint,
  getSpecifiedCards,
  hasMatchingColor,
  isFunctionCard,
  isConcreteColor,
  removeCardsFromPlayer,
  useCards,
} from '../services/game';
import type { ClientGameEvents, ClientToServerEvents } from 'types/server';
import type { PlayerInfo, RoomInfo } from 'types/room';
import { colorList } from '../configs';
import { send } from './room';
import WebSocket from 'ws';
import { randomCoding } from '../utils';

function getPlayer(roomInfo: RoomInfo, ws: WebSocket.WebSocket) {
  return roomInfo.players.find((item) => item.socketInstance === ws);
}

function getCurrentPlayer(roomInfo: RoomInfo, ws: WebSocket.WebSocket) {
  const player = roomInfo.players[roomInfo.order];
  return player?.socketInstance === ws ? player : undefined;
}

function sendError(ws: WebSocket.WebSocket, type: 'RES_OUT_OF_THE_CARD' | 'RES_GET_ONE_CARD' | 'RES_NEXT_TURN' | 'RES_SUBMIT_COLOR' | 'RES_UNO', message: string) {
  send(ws, { message, data: null, type });
}

function sendGameNotice(roomCode: string, message: string) {
  emitAllPlayers(roomCode, { message, data: null, type: 'GAME_NOTICE' });
}

function finishNormalTurn(roomCode: string, roomInfo: RoomInfo) {
  roomInfo.pendingAction = null;
  emitToNextTurn(roomCode, roomInfo);
}

const concreteColors = Object.keys(colorList) as CardColor[];

function randomColor() {
  return concreteColors[Math.floor(Math.random() * concreteColors.length)];
}

function setPlayedCardColor(roomInfo: RoomInfo, player: PlayerInfo, color: CardColor) {
  if (roomInfo.lastCard) roomInfo.lastCard.color = color;
  if (player.lastCard) player.lastCard.color = color;
}

function startRoomGame(roomCode: string, roomInfo: RoomInfo) {
  updateRoomInfoAtStart(roomInfo);
  roomInfo.order = -1;
  roomInfo.playOrder = 1;
  roomInfo.lastCard = null;
  roomInfo.players.forEach((player) => {
    player.cards = [];
    player.lastCard = null;
    player.uno = false;
  });
  roomInfo.accumulation = 0;
  roomInfo.gameCards = useCards(roomInfo.players.length);
  dealCardsToPlayers(roomInfo);
  emitToNextTurn(roomCode, roomInfo);
}

const gameControllers: Pick<ClientToServerEvents, ClientGameEvents> = {
  START_GAME: (roomCode, ws) => {
    const roomInfo = get(roomCollection, roomCode);
    if (!roomInfo) {
      return send(ws, { message: '房间不存在', data: null, type: 'RES_START_GAME' });
    }
    const requester = roomInfo.players.find((player) => player.socketInstance === ws);
    if (!requester || !isRoomOwner(roomInfo, requester)) {
      return send(ws, { message: '只有房主可以开始游戏', data: null, type: 'RES_START_GAME' });
    }
    if (roomInfo.players.length < 2) {
      return send(ws, { message: '当前人数不足两人，无法开始游戏', data: null, type: 'RES_START_GAME' });
    }
    const notReady = roomInfo.players.filter(
      (player) => !player.isAI && !isRoomOwner(roomInfo, player) && !player.ready
    );
    if (notReady.length) {
      return send(ws, { message: '还有玩家未准备，无法开始游戏', data: null, type: 'RES_START_GAME' });
    }
    startRoomGame(roomCode, roomInfo);
    send(ws, { data: null, type: 'RES_START_GAME' });
  },
  START_AI_GAME: (data, ws) => {
    const roomCode = randomCoding();
    const roomInfo = createRoom({
      roomId: Date.now().toString(),
      roomName: '人机对战',
      owner: data.userInfo
    }, ws, roomCode);
    roomInfo.players.push(createAIPlayer(data.difficulty));
    roomCollection.set(roomCode, roomInfo);
    startRoomGame(roomCode, roomInfo);
    send(ws, {
      message: `人机对战已开始，难度：${data.difficulty}`,
      type: 'RES_START_AI_GAME',
      data: { roomInfo, userCards: roomInfo.players[0].cards }
    });
  },
  OUT_OF_THE_CARD: async (data, ws) => {
    const { roomCode, cardsIndex } = data;
    const roomInfo = get(roomCollection, roomCode);
    if (!roomInfo) return sendError(ws, 'RES_OUT_OF_THE_CARD', '房间不存在');
    const forcedResponse = roomInfo.pendingAction?.kind === 'FORCED_COLOR' ? roomInfo.pendingAction : undefined;
    if (roomInfo.pendingAction && !forcedResponse) {
      return sendError(ws, 'RES_OUT_OF_THE_CARD', '请先完成当前卡牌效果');
    }
    const player = getCurrentPlayer(roomInfo, ws);
    if (!player) return sendError(ws, 'RES_OUT_OF_THE_CARD', '现在还没轮到你出牌');
    if (forcedResponse && forcedResponse.targetId !== player.id) {
      return sendError(ws, 'RES_OUT_OF_THE_CARD', '当前应由指定玩家出牌');
    }
    if (!cardsIndex.length) return sendError(ws, 'RES_OUT_OF_THE_CARD', '请选择要出的牌');

    const activeColor = getActiveColor(roomInfo.lastCard);
    const actorHadMatchingColor = roomInfo.lastCard ? hasMatchingColor(player.cards, activeColor) : false;
    if (!checkCards(player.cards, cardsIndex, roomInfo.lastCard, getPlayConstraint(roomInfo))) {
      const rule = forcedResponse
        ? `必须打出${colorList[forcedResponse.color]}牌${forcedResponse.allowPalette ? '或换色牌' : ''}`
        : roomInfo.accumulation > 0
          ? '必须打出当前同色牌、反转牌或换色牌'
          : '多牌必须是相同点数的数字牌';
      return sendError(ws, 'RES_OUT_OF_THE_CARD', `出牌不符合规则：${rule}`);
    }

    const playedCards = removeCardsFromPlayer(player, cardsIndex, roomInfo);
    const playedCard = playedCards[playedCards.length - 1];
    if (!playedCard) return sendError(ws, 'RES_OUT_OF_THE_CARD', '出牌无效');

    if (forcedResponse) roomInfo.pendingAction = null;

    send(ws, { message: '出牌成功', data: player.cards, type: 'RES_OUT_OF_THE_CARD' });
    sendGameNotice(roomCode, `${player.name} 打出${playedCards.length > 1 ? `了 ${playedCards.length} 张牌` : '了一张牌'}`);

    // 没有喊 UNO 而直接出完牌，补两张后继续游戏
    if (player.cards.length === 0 && !player.uno) {
      player.cards.push(...getSpecifiedCards(roomInfo.gameCards, 2, roomInfo.players.length));
      send(ws, {
        message: '请记得UNO！获得手牌2张',
        data: player.cards,
        type: 'RES_OUT_OF_THE_CARD'
      });
    }
    if (player.cards.length === 0) {
      emitGameOver(roomInfo, roomCode);
      return;
    }

    switch (playedCard.type) {
      case 'exchange':
        roomInfo.playOrder = roomInfo.playOrder === 1 ? -1 : 1;
        sendGameNotice(roomCode, `${player.name} 改变了出牌方向`);
        finishNormalTurn(roomCode, roomInfo);
        break;
      case 'ban': {
        const skipped = getNextOrder(roomInfo);
        sendGameNotice(roomCode, `${player.name} 跳过了下一位玩家`);
        emitAfterPenalty(roomCode, roomInfo, skipped);
        break;
      }
      case 'add-2': {
        roomInfo.accumulation += 2;
        sendGameNotice(roomCode, `${player.name} 将 +2 累计到 ${roomInfo.accumulation}`);
        finishNormalTurn(roomCode, roomInfo);
        break;
      }
      case 'palette':
        roomInfo.pendingAction = {
          kind: 'COLOR',
          actorId: player.id,
          cardType: 'palette',
          actorHadMatchingColor: false
        };
        send(ws, { message: '请选择颜色', type: 'SELECT_COLOR', data: { cardType: 'palette' } });
        break;
      case 'add-4':
        roomInfo.pendingAction = {
          kind: 'COLOR',
          actorId: player.id,
          cardType: 'add-4',
          actorHadMatchingColor
        };
        send(ws, { message: '请选择颜色，之后由下一位决定是否质疑', type: 'SELECT_COLOR', data: { cardType: 'add-4' } });
        break;
      case 'target': {
        roomInfo.pendingAction = { kind: 'TARGET', actorId: player.id, cardType: 'target' };
        const targets = roomInfo.players
          .filter((target) => target.id !== player.id)
          .map((target) => ({ id: target.id, name: target.name }));
        send(ws, {
          message: '请选择指定目标',
          type: 'SELECT_TARGET',
          data: { cardType: 'target', targets }
        });
        break;
      }
      case 'bomb': {
        const color = randomColor();
        const penalty = 4 + Math.floor(Math.random() * 5);
        setPlayedCardColor(roomInfo, player, color);
        emitAllPlayers(roomCode, {
          message: `炸弹随机到${colorList[color]}，未命中将摸 ${penalty} 张牌`,
          type: 'BOMB_COLOR_ROLL',
          data: { finalColor: color, penalty }
        });
        const targetIndex = getNextOrder(roomInfo);
        const target = roomInfo.players[targetIndex];
        if (!target) return;
        roomInfo.pendingAction = {
          kind: 'FORCED_COLOR',
          source: 'bomb',
          actorId: player.id,
          targetId: target.id,
          color,
          penalty,
          allowPalette: false
        };
        emitToPlayerTurn(roomCode, roomInfo, targetIndex);
        break;
      }
      default:
        finishNormalTurn(roomCode, roomInfo);
    }
  },
  GET_ONE_CARD: (roomCode, ws) => {
    const roomInfo = get(roomCollection, roomCode);
    if (!roomInfo) return sendError(ws, 'RES_GET_ONE_CARD', '房间不存在');
    const player = getCurrentPlayer(roomInfo, ws);
    if (!player) return sendError(ws, 'RES_GET_ONE_CARD', '现在还没轮到你');
    const forced = roomInfo.pendingAction?.kind === 'FORCED_COLOR' ? roomInfo.pendingAction : undefined;
    if (roomInfo.pendingAction && !forced) return sendError(ws, 'RES_GET_ONE_CARD', '请先完成当前卡牌效果');
    if (forced && forced.targetId !== player.id) return sendError(ws, 'RES_GET_ONE_CARD', '当前应由指定玩家操作');

    const penalty = forced?.penalty || roomInfo.accumulation;
    if (penalty > 0) {
      const drawn = getSpecifiedCards(roomInfo.gameCards, penalty, roomInfo.players.length);
      player.cards.push(...drawn);
      roomInfo.pendingAction = null;
      roomInfo.accumulation = 0;
      if (player.cards.length > 1 && player.uno) changePlayerUNOStatus(ws, player, false);
      sendGameNotice(roomCode, `${player.name} 接受处罚，获得 ${penalty} 张牌`);
      send(ws, {
        data: { userCards: player.cards, card: drawn[0], penaltyResolved: true },
        type: 'RES_GET_ONE_CARD'
      });
      emitToNextTurn(roomCode, roomInfo);
      return;
    }

    const card = getSpecifiedCards(roomInfo.gameCards, 1, roomInfo.players.length)[0];
    if (!card) return sendError(ws, 'RES_GET_ONE_CARD', '暂时没有可摸的牌');
    player.cards.push(card);
    if (player.cards.length > 1 && player.uno) changePlayerUNOStatus(ws, player, false);
    sendGameNotice(roomCode, `${player.name} 摸了一张牌`);
    send(ws, {
      data: { userCards: player.cards, card },
      type: 'RES_GET_ONE_CARD'
    });
  },
  NEXT_TURN: (roomCode, ws) => {
    const roomInfo = get(roomCollection, roomCode);
    if (!roomInfo) return sendError(ws, 'RES_NEXT_TURN', '房间不存在');
    if (roomInfo.pendingAction) return sendError(ws, 'RES_NEXT_TURN', '请先完成当前卡牌效果');
    if (roomInfo.accumulation > 0) return sendError(ws, 'RES_NEXT_TURN', '请出牌传递 +2，或接受累计处罚');
    if (!getCurrentPlayer(roomInfo, ws)) return sendError(ws, 'RES_NEXT_TURN', '现在还没轮到你');
    emitToNextTurn(roomCode, roomInfo);
  },
  SUBMIT_COLOR: (res, ws) => {
    const { color, roomCode } = res;
    const roomInfo = get(roomCollection, roomCode);
    if (!roomInfo) return sendError(ws, 'RES_SUBMIT_COLOR', '房间不存在');
    if (!isConcreteColor(color)) return sendError(ws, 'RES_SUBMIT_COLOR', '颜色无效');
    const player = getPlayer(roomInfo, ws);
    const pending = roomInfo.pendingAction;
    if (!player || !pending || (pending.kind !== 'COLOR' && pending.kind !== 'TARGET_COLOR') || pending.actorId !== player.id) {
      return sendError(ws, 'RES_SUBMIT_COLOR', '当前没有等待你选择颜色的牌');
    }

    setPlayedCardColor(roomInfo, player, color);
    emitAllPlayers(roomCode, {
      message: '卡牌颜色更改为：' + colorList[color],
      type: 'COLOR_IS_CHANGE',
      data: color
    });

    if (pending.kind === 'TARGET_COLOR') {
      const targetIndex = roomInfo.players.findIndex((target) => target.id === pending.targetId);
      const target = roomInfo.players[targetIndex];
      if (!target) return sendError(ws, 'RES_SUBMIT_COLOR', '目标玩家不存在');
      roomInfo.pendingAction = {
        kind: 'FORCED_COLOR',
        source: 'target',
        actorId: player.id,
        targetId: target.id,
        color,
        penalty: 4,
        allowPalette: true
      };
      sendGameNotice(roomCode, `${player.name} 指定 ${target.name} 打出${colorList[color]}牌`);
      emitToPlayerTurn(roomCode, roomInfo, targetIndex);
      return;
    }

    if (pending.cardType === 'palette') {
      finishNormalTurn(roomCode, roomInfo);
      return;
    }

    const target = roomInfo.players[getNextOrder(roomInfo)];
    if (!target) return;
    roomInfo.pendingAction = {
      kind: 'ADD4_CHALLENGE',
      actorId: pending.actorId,
      targetId: target.id,
      color,
      actorHadMatchingColor: pending.actorHadMatchingColor
    };
    send(target.socketInstance, {
      message: '你可以质疑这张 +4，也可以接受处罚',
      type: 'CHALLENGE_AVAILABLE',
      data: { actorName: player.name, color, penalty: 4, challengePenalty: 4 }
    });
    if (target.isAI) {
      void import('../services/ai').then(({ scheduleAIChallenge }) => scheduleAIChallenge(roomCode));
    }
    sendGameNotice(roomCode, `等待${target.name}决定是否质疑 +4`);
  },
  SELECT_TARGET: (res, ws) => {
    const { targetId, roomCode } = res;
    const roomInfo = get(roomCollection, roomCode);
    if (!roomInfo) return sendError(ws, 'RES_SUBMIT_COLOR', '房间不存在');
    const actor = getPlayer(roomInfo, ws);
    const pending = roomInfo.pendingAction;
    if (!actor || !pending || pending.kind !== 'TARGET' || pending.actorId !== actor.id) {
      return sendError(ws, 'RES_SUBMIT_COLOR', '当前没有等待你指定目标的牌');
    }
    const targetIndex = roomInfo.players.findIndex((player) => player.id === targetId && player.id !== actor.id);
    const target = roomInfo.players[targetIndex];
    if (!target) return sendError(ws, 'RES_SUBMIT_COLOR', '目标玩家不存在');

    roomInfo.pendingAction = { kind: 'TARGET_COLOR', actorId: actor.id, targetId: target.id };
    send(ws, {
      message: `请为 ${target.name} 指定颜色`,
      type: 'SELECT_COLOR',
      data: { cardType: 'target' }
    });
  },
  CHALLENGE_ADD4: (res, ws) => {
    const { challenge, roomCode } = res;
    const roomInfo = get(roomCollection, roomCode);
    if (!roomInfo) return sendError(ws, 'RES_SUBMIT_COLOR', '房间不存在');
    const challenger = getPlayer(roomInfo, ws);
    const pending = roomInfo.pendingAction;
    if (!challenger || !pending || pending.kind !== 'ADD4_CHALLENGE' || pending.targetId !== challenger.id) {
      return sendError(ws, 'RES_SUBMIT_COLOR', '当前没有可处理的 +4 质疑');
    }
    const actor = roomInfo.players.find((player) => player.id === pending.actorId);
    if (!actor) return sendError(ws, 'RES_SUBMIT_COLOR', '出牌玩家不存在');

    if (challenge && pending.actorHadMatchingColor) {
      drawCardsForPlayer(roomInfo, actor, 4);
      sendGameNotice(roomCode, `${challenger.name} 质疑成功，${actor.name} 获得 4 张牌`);
    } else if (challenge) {
      drawCardsForPlayer(roomInfo, challenger, 4);
      sendGameNotice(roomCode, `${challenger.name} 质疑失败，获得 4 张牌`);
    } else {
      drawCardsForPlayer(roomInfo, challenger, 4);
      sendGameNotice(roomCode, `${challenger.name} 接受 +4，获得 4 张牌`);
    }
    roomInfo.pendingAction = null;
    const challengerIndex = roomInfo.players.findIndex((player) => player.id === challenger.id);
    emitAfterPenalty(roomCode, roomInfo, challengerIndex);
  },
  UNO: (roomCode, ws) => {
    const roomInfo = get(roomCollection, roomCode);
    if (!roomInfo) return sendError(ws, 'RES_UNO', '房间不存在');
    const player = getPlayer(roomInfo, ws);
    if (!player) return sendError(ws, 'RES_UNO', '玩家不存在');
    if (player.cards.length !== 1 || isFunctionCard(player.cards[0])) {
      return sendError(ws, 'RES_UNO', '不符合 UNO 条件');
    }
    changePlayerUNOStatus(ws, player, true);
    emitAllPlayers(roomCode, {
      message: '玩家' + player.name + ' UNO!',
      type: 'RES_UNO',
      data: null
    });
  }
};

export default gameControllers;

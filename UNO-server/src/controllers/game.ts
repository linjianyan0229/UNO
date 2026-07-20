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
  getActiveColor,
  getNextOrder,
  getSpecifiedCards,
  hasMatchingColor,
  isFunctionCard,
  isConcreteColor,
  removeCardsFromPlayer,
  useCards,
} from '../services/game';
import type { ClientGameEvents, ClientToServerEvents } from 'types/server';
import type { RoomInfo } from 'types/room';
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
  roomInfo.gameCards = useCards();
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
    if (roomInfo.pendingAction) return sendError(ws, 'RES_OUT_OF_THE_CARD', '请先完成当前卡牌效果');
    const player = getCurrentPlayer(roomInfo, ws);
    if (!player) return sendError(ws, 'RES_OUT_OF_THE_CARD', '现在还没轮到你出牌');
    if (!cardsIndex.length) return sendError(ws, 'RES_OUT_OF_THE_CARD', '请选择要出的牌');

    const activeColor = getActiveColor(roomInfo.lastCard);
    const actorHadMatchingColor = roomInfo.lastCard ? hasMatchingColor(player.cards, activeColor) : false;
    if (!checkCards(player.cards, cardsIndex, roomInfo.lastCard)) {
      return sendError(ws, 'RES_OUT_OF_THE_CARD', '出牌不符合规则：多牌必须是相同点数的数字牌');
    }

    const playedCards = removeCardsFromPlayer(player, cardsIndex, roomInfo);
    const playedCard = playedCards[playedCards.length - 1];
    if (!playedCard) return sendError(ws, 'RES_OUT_OF_THE_CARD', '出牌无效');

    // 指定目标牌和炸弹牌沿用当前颜色，避免效果结束后牌局失去颜色上下文
    if (playedCard.type === 'target' || playedCard.type === 'bomb') {
      playedCard.color = activeColor;
      player.lastCard = { ...playedCard };
      roomInfo.lastCard = { ...playedCard };
    }

    send(ws, { message: '出牌成功', data: player.cards, type: 'RES_OUT_OF_THE_CARD' });
    sendGameNotice(roomCode, `${player.name} 打出${playedCards.length > 1 ? `了 ${playedCards.length} 张牌` : '了一张牌'}`);

    // 没有喊 UNO 而直接出完牌，补两张后继续游戏
    if (player.cards.length === 0 && !player.uno) {
      player.cards.push(...getSpecifiedCards(roomInfo.gameCards, 2));
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
        const skipped = getNextOrder(roomInfo);
        const target = roomInfo.players[skipped];
        if (target) drawCardsForPlayer(roomInfo, target, 2);
        sendGameNotice(roomCode, `${target?.name || '下一位玩家'} 获得 +2`);
        emitAfterPenalty(roomCode, roomInfo, skipped);
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
      case 'target':
      case 'bomb': {
        roomInfo.pendingAction = { kind: 'TARGET', actorId: player.id, cardType: playedCard.type };
        const targets = roomInfo.players
          .filter((target) => target.id !== player.id)
          .map((target) => ({ id: target.id, name: target.name }));
        send(ws, {
          message: playedCard.type === 'bomb' ? '请选择炸弹目标' : '请选择指定目标',
          type: 'SELECT_TARGET',
          data: { cardType: playedCard.type, targets }
        });
        break;
      }
      default:
        finishNormalTurn(roomCode, roomInfo);
    }
  },
  GET_ONE_CARD: (roomCode, ws) => {
    const roomInfo = get(roomCollection, roomCode);
    if (!roomInfo) return sendError(ws, 'RES_GET_ONE_CARD', '房间不存在');
    if (roomInfo.pendingAction) return sendError(ws, 'RES_GET_ONE_CARD', '请先完成当前卡牌效果');
    const player = getCurrentPlayer(roomInfo, ws);
    if (!player) return sendError(ws, 'RES_GET_ONE_CARD', '现在还没轮到你');
    const card = getSpecifiedCards(roomInfo.gameCards, 1)[0];
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
    if (!player || !pending || pending.kind !== 'COLOR' || pending.actorId !== player.id) {
      return sendError(ws, 'RES_SUBMIT_COLOR', '当前没有等待你选择颜色的牌');
    }

    if (roomInfo.lastCard) roomInfo.lastCard.color = color;
    if (player.lastCard) player.lastCard.color = color;
    emitAllPlayers(roomCode, {
      message: '卡牌颜色更改为：' + colorList[color],
      type: 'COLOR_IS_CHANGE',
      data: color
    });

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
      data: { actorName: player.name, color, penalty: 4, challengePenalty: 6 }
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

    const penalty = pending.cardType === 'bomb' ? 5 : 2;
    drawCardsForPlayer(roomInfo, target, penalty);
    roomInfo.pendingAction = null;
    sendGameNotice(roomCode, `${actor.name} 指定 ${target.name}，获得 ${penalty} 张牌并跳过本轮`);
    emitAfterPenalty(roomCode, roomInfo, targetIndex);
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
      drawCardsForPlayer(roomInfo, challenger, 6);
      sendGameNotice(roomCode, `${challenger.name} 质疑失败，获得 6 张牌`);
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

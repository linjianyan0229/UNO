import type { RoomInfo, PlayerInfo } from 'types/room';
import { cardInfomation, colorList, FUNCTION_CARD_TYPE, InitCardNum } from '../configs/card';
import { shuffle } from '../utils';
import WebSocket from 'ws';
import { send } from '../controllers/room';
import { emitAllPlayers, roomCollection, updatePlayerListToPlayers } from './room';

// 生成游戏卡牌
export const useCards = () => shuffle(cardInfomation());

// 获取指定数量的牌
export function getSpecifiedCards(cards: CardInfo[], num: number) {
  const result: CardInfo[] = [];
  for (let i = 0; i < num; i += 1) {
    if (cards.length < num) {
      cards.push(...useCards());
    }
    const card = cards.shift();
    if (card) result.push(card);
  }
  return result;
}

// 给指定玩家发指定数量的牌
export function emitDealCardsToPlayer(socketInstance: WebSocket.WebSocket, newPlayerCards: CardInfo[], num: number) {
  send(socketInstance, {
    message: `获得卡牌 ${num} 张`,
    data: newPlayerCards,
    type: 'RES_DEAL_CARDS'
  });
}

// 游戏开始，给所有玩家发牌
export function dealCardsToPlayers(roomInfo: RoomInfo) {
  for (const player of roomInfo.players) {
    const userCards = (player.cards = getSpecifiedCards(roomInfo.gameCards, InitCardNum));
    send(player.socketInstance, {
      message: '游戏开始啦',
      data: {
        roomInfo,
        userCards
      },
      type: 'GAME_IS_START'
    });
  }
}

function isSameColor(target: CardInfo, lastCard: CardInfo) {
  return target.color === lastCard.color;
}

function isSameType(target: CardInfo, lastCard: CardInfo) {
  return target.type === lastCard.type;
}

export function isNumberCard(card: CardInfo) {
  return card.type.startsWith('number-');
}

// 万能牌可以在任意颜色或类型上使用
export function isUniversalCard(card: CardInfo) {
  return ['palette', 'add-4', 'target', 'bomb'].includes(card.type);
}

export function isFunctionCard(card: CardInfo) {
  return FUNCTION_CARD_TYPE.includes(card.type);
}

function checkCard(target: CardInfo, lastCard: CardInfo | null): boolean {
  if (!lastCard || isUniversalCard(target)) return true;
  return isSameColor(target, lastCard) || isSameType(target, lastCard);
}

/**
 * 多牌连出规则：多张牌必须是相同点数的数字牌；功能牌和万能牌单独出。
 */
export function checkCards(cards: CardInfo[], cardsIndex: number[], lastCard: CardInfo | null): boolean {
  const uniqueIndexes = [...new Set(cardsIndex)];
  if (uniqueIndexes.length === 0 || uniqueIndexes.length !== cardsIndex.length) return false;

  const selected = uniqueIndexes.map((index) => cards[index]);
  if (selected.some((card) => !card)) return false;
  if (!checkCard(selected[0], lastCard)) return false;

  if (selected.length > 1) {
    const first = selected[0];
    if (!isNumberCard(first) || selected.some((card) => !isNumberCard(card) || card.type !== first.type)) {
      return false;
    }
  }
  return true;
}

// 从玩家手牌中移除一组牌，并将最后一张牌更新到桌面
export function removeCardsFromPlayer(player: PlayerInfo, cardsIndex: number[], roomInfo: RoomInfo) {
  const orderedIndexes = [...new Set(cardsIndex)].sort((a, b) => a - b);
  const playedCards = orderedIndexes.map((index) => player.cards[index]).filter(Boolean).map((card) => ({ ...card }));
  for (const index of [...orderedIndexes].sort((a, b) => b - a)) {
    player.cards.splice(index, 1);
  }
  const lastCard = playedCards[playedCards.length - 1];
  if (lastCard) {
    player.lastCard = { ...lastCard };
    roomInfo.lastCard = { ...lastCard };
  }
  return playedCards;
}

// 兼容旧调用方
export function updatePlayerCardInfo(player: PlayerInfo, cardsIndex: number[], roomInfo: RoomInfo) {
  removeCardsFromPlayer(player, cardsIndex, roomInfo);
  return player.cards;
}

// 获取下一位玩家序号
export function getNextOrder(roomInfo: RoomInfo): number {
  if (roomInfo.players.length === 0) return -1;
  return (roomInfo.order + roomInfo.playOrder + roomInfo.players.length) % roomInfo.players.length;
}

// 通知玩家进入下一轮
export function emitToNextTurn(roomCode: string, roomInfo: RoomInfo) {
  if (roomInfo.players.length === 0) return;
  roomInfo.order = getNextOrder(roomInfo);
  const nextPlayer = roomInfo.players[roomInfo.order];
  if (nextPlayer) {
    emitAllPlayers(roomCode, {
      message: `轮到玩家${nextPlayer.name}出牌`,
      type: 'NEXT_TURN',
      data: {
        players: roomInfo.players,
        lastCard: roomInfo.lastCard,
        order: roomInfo.order
      }
    });
    if (nextPlayer.isAI) {
      void import('./ai').then(({ scheduleAITurn }) => scheduleAITurn(roomCode));
    }
  }
}

// 通知玩家进入下一轮；skipCurrentNext 用于跳过受到惩罚的下一位玩家
export function emitAfterPenalty(roomCode: string, roomInfo: RoomInfo, skippedPlayerIndex: number) {
  roomInfo.order = skippedPlayerIndex;
  emitToNextTurn(roomCode, roomInfo);
}

// 对局结束
export function emitGameOver(roomInfo: RoomInfo, roomCode: string) {
  roomInfo.endTime = Date.now();
  // 快照本局排名(剩余手牌越少越靠前),用副本避免改动真实座位顺序;
  // 排名副本仍保留结束时的手牌引用,因此重置后仍能显示当时的张数
  const winnerOrder = [...roomInfo.players]
    .sort((a, b) => a.cards.length - b.cards.length)
    .map((player) => ({ ...player }));
  roomInfo.winnerOrder = winnerOrder;
  roomInfo.pendingAction = null;

  // 含 AI 的对局(人机)结束后不保留房间;纯真人房保留以便再来一局
  const canReplay = !roomInfo.players.some((player) => player.isAI);

  if (canReplay) {
    // 回到等待状态,清空手牌与准备,便于重新开局或有新玩家加入
    roomInfo.status = 'WAITING';
    roomInfo.order = -1;
    roomInfo.playOrder = 1;
    roomInfo.lastCard = null;
    roomInfo.startTime = -1;
    roomInfo.players.forEach((player) => {
      player.cards = [];
      player.lastCard = null;
      player.uno = false;
      player.ready = false;
    });
  } else {
    roomInfo.status = 'END';
  }

  emitAllPlayers(roomCode, {
    type: 'GAME_IS_OVER',
    message: '游戏结束',
    data: {
      winnerOrder,
      endTime: roomInfo.endTime,
      players: roomInfo.players,
      owner: roomInfo.owner,
      canReplay
    }
  });

  if (canReplay) {
    // 同步大厅玩家状态(手牌已清空、准备已重置)
    updatePlayerListToPlayers(roomCode, roomInfo.players, '本局结束，回到房间');
  } else {
    // 人机房不再保留,直接回收
    roomCollection.delete(roomCode);
  }
}

export function isConcreteColor(color: string): color is CardColor {
  return Object.prototype.hasOwnProperty.call(colorList, color);
}

export function getActiveColor(lastCard: CardInfo | null): CardColor {
  if (lastCard && isConcreteColor(lastCard.color)) return lastCard.color;
  return '#FF6666';
}

export function hasMatchingColor(cards: CardInfo[], color: CardColor) {
  return cards.some((card) => card.color === color);
}

// 给下一个玩家添加牌
export function drawCardsForPlayer(roomInfo: RoomInfo, player: PlayerInfo, num: number) {
  player.cards.push(...getSpecifiedCards(roomInfo.gameCards, num));
  if (player.cards.length > 1 && player.uno) {
    changePlayerUNOStatus(player.socketInstance, player, false);
  }
  emitDealCardsToPlayer(player.socketInstance, player.cards, num);
}

export function dealCardsToPlayer(roomInfo: RoomInfo, num: number) {
  const nextPlayer = roomInfo.players[getNextOrder(roomInfo)];
  if (nextPlayer) drawCardsForPlayer(roomInfo, nextPlayer, num);
}

export function changePlayerUNOStatus(ws: WebSocket.WebSocket, player: PlayerInfo, status: boolean) {
  player.uno = status;
  send(ws, {
    data: {
      playerId: player.id,
      playerName: player.name,
      unoStatus: status
    },
    type: 'CHANGE_UNO_STATUS'
  });
}

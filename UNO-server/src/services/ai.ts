import type { PlayerInfo, RoomInfo } from 'types/room';
import { get } from '../utils/customCRUD';
import { emitAllPlayers, roomCollection } from './room';
import { send } from '../controllers/room';
import {
  drawCardsForPlayer,
  emitAfterPenalty,
  emitGameOver,
  emitToNextTurn,
  getActiveColor,
  getNextOrder,
  getSpecifiedCards,
  hasMatchingColor,
  isNumberCard,
  isUniversalCard,
  removeCardsFromPlayer
} from './game';

const aiTurnTimers = new Map<string, ReturnType<typeof setTimeout>>();
const aiChallengeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function notice(roomCode: string, message: string) {
  emitAllPlayers(roomCode, { message, data: null, type: 'GAME_NOTICE' });
}

function playable(card: CardInfo, lastCard: CardInfo | null) {
  return !lastCard || isUniversalCard(card) || card.color === lastCard.color || card.type === lastCard.type;
}

function chooseColor(player: PlayerInfo): CardColor {
  const counts = new Map<CardColor, number>();
  for (const card of player.cards) {
    if (card.color === '#FF6666' || card.color === '#99CC66' || card.color === '#99CCFF' || card.color === '#FFCC33') {
      counts.set(card.color, (counts.get(card.color) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '#FF6666';
}

function cardPriority(card: CardInfo, hasColor: boolean, difficulty: AIDifficulty) {
  if (card.type === 'add-4') return !hasColor || difficulty === 'easy' ? 95 : 5;
  if (card.type === 'bomb') return difficulty === 'easy' ? 85 : 70;
  if (card.type === 'target') return 70;
  if (card.type === 'add-2') return 55;
  if (card.type === 'ban') return 50;
  if (card.type === 'exchange') return 45;
  if (isNumberCard(card)) return 30;
  return 20;
}

function chooseCards(roomInfo: RoomInfo, player: PlayerInfo) {
  const lastCard = roomInfo.lastCard;
  const activeColor = getActiveColor(lastCard);
  const hasColor = lastCard ? hasMatchingColor(player.cards, activeColor) : false;
  const candidates = player.cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => playable(card, lastCard));
  if (!candidates.length) return [];

  const difficulty = player.aiDifficulty || 'normal';
  if (difficulty !== 'easy') {
    const numberGroups = new Map<string, number[]>();
    for (const candidate of candidates) {
      if (isNumberCard(candidate.card)) {
        const group = numberGroups.get(candidate.card.type) || [];
        group.push(candidate.index);
        numberGroups.set(candidate.card.type, group);
      }
    }
    const group = [...numberGroups.values()].sort((a, b) => b.length - a.length)[0];
    if (group && group.length > 1) return group;
  }

  candidates.sort((a, b) => cardPriority(b.card, hasColor, difficulty) - cardPriority(a.card, hasColor, difficulty));
  return [candidates[0].index];
}

function emitUnoStatus(roomCode: string, player: PlayerInfo, status: boolean) {
  player.uno = status;
  emitAllPlayers(roomCode, {
    type: 'CHANGE_UNO_STATUS',
    data: { playerId: player.id, playerName: player.name, unoStatus: status }
  });
}

function finishTurn(roomCode: string, roomInfo: RoomInfo) {
  roomInfo.pendingAction = null;
  emitToNextTurn(roomCode, roomInfo);
}

function applyAIPlayedCard(roomCode: string, roomInfo: RoomInfo, player: PlayerInfo, playedCard: CardInfo, actorHadMatchingColor: boolean) {
  switch (playedCard.type) {
    case 'exchange':
      roomInfo.playOrder = roomInfo.playOrder === 1 ? -1 : 1;
      notice(roomCode, `${player.name} 改变了出牌方向`);
      finishTurn(roomCode, roomInfo);
      break;
    case 'ban': {
      const skipped = getNextOrder(roomInfo);
      notice(roomCode, `${player.name} 跳过了下一位玩家`);
      emitAfterPenalty(roomCode, roomInfo, skipped);
      break;
    }
    case 'add-2': {
      const skipped = getNextOrder(roomInfo);
      const target = roomInfo.players[skipped];
      if (target) drawCardsForPlayer(roomInfo, target, 2);
      notice(roomCode, `${target?.name || '下一位玩家'} 获得 +2`);
      emitAfterPenalty(roomCode, roomInfo, skipped);
      break;
    }
    case 'palette': {
      const color = chooseColor(player);
      if (roomInfo.lastCard) roomInfo.lastCard.color = color;
      if (player.lastCard) player.lastCard.color = color;
      emitAllPlayers(roomCode, { message: `AI 选择了${color}`, type: 'COLOR_IS_CHANGE', data: color });
      finishTurn(roomCode, roomInfo);
      break;
    }
    case 'add-4': {
      const color = chooseColor(player);
      if (roomInfo.lastCard) roomInfo.lastCard.color = color;
      if (player.lastCard) player.lastCard.color = color;
      emitAllPlayers(roomCode, { message: `AI 选择了${color}，等待质疑`, type: 'COLOR_IS_CHANGE', data: color });
      const target = roomInfo.players[getNextOrder(roomInfo)];
      if (!target) return;
      roomInfo.pendingAction = {
        kind: 'ADD4_CHALLENGE',
        actorId: player.id,
        targetId: target.id,
        color,
        actorHadMatchingColor
      };
      if (target.isAI) scheduleAIChallenge(roomCode);
      else send(target.socketInstance, {
        message: '你可以质疑这张 +4，也可以接受处罚',
        type: 'CHALLENGE_AVAILABLE',
        data: { actorName: player.name, color, penalty: 4, challengePenalty: 6 }
      });
      break;
    }
    case 'target':
    case 'bomb': {
      const target = roomInfo.players.find((candidate) => !candidate.isAI && candidate.id !== player.id);
      if (!target) return finishTurn(roomCode, roomInfo);
      const penalty = playedCard.type === 'bomb' ? 5 : 2;
      const targetIndex = roomInfo.players.findIndex((candidate) => candidate.id === target.id);
      drawCardsForPlayer(roomInfo, target, penalty);
      notice(roomCode, `${player.name} 指定 ${target.name}，获得 ${penalty} 张牌并跳过本轮`);
      emitAfterPenalty(roomCode, roomInfo, targetIndex);
      break;
    }
    default:
      finishTurn(roomCode, roomInfo);
  }
}

function runAITurn(roomCode: string) {
  const roomInfo = get(roomCollection, roomCode);
  if (!roomInfo || roomInfo.status !== 'GAMING' || roomInfo.pendingAction) return;
  const player = roomInfo.players[roomInfo.order];
  if (!player?.isAI) return;

  let indexes = chooseCards(roomInfo, player);
  if (!indexes.length) {
    drawCardsForPlayer(roomInfo, player, 1);
    notice(roomCode, `${player.name} 摸了一张牌`);
    indexes = chooseCards(roomInfo, player);
    if (!indexes.length) return finishTurn(roomCode, roomInfo);
  }

  const activeColor = getActiveColor(roomInfo.lastCard);
  const actorHadMatchingColor = roomInfo.lastCard ? hasMatchingColor(player.cards, activeColor) : false;
  const playedCards = removeCardsFromPlayer(player, indexes, roomInfo);
  const playedCard = playedCards[playedCards.length - 1];
  if (!playedCard) return finishTurn(roomCode, roomInfo);
  if (playedCard.type === 'target' || playedCard.type === 'bomb') {
    playedCard.color = activeColor;
    player.lastCard = { ...playedCard };
    roomInfo.lastCard = { ...playedCard };
  }
  notice(roomCode, `${player.name} 打出了${playedCard.type === 'bomb' ? '炸弹牌' : playedCard.type === 'target' ? '指定目标牌' : '一组牌'}`);

  if (player.cards.length === 1) {
    emitUnoStatus(roomCode, player, true);
    notice(roomCode, `${player.name} UNO!`);
  }
  if (player.cards.length === 0) {
    if (!player.uno) {
      player.cards.push(...getSpecifiedCards(roomInfo.gameCards, 2));
      notice(roomCode, `${player.name} 忘记 UNO，获得 2 张牌`);
    } else {
      return emitGameOver(roomInfo, roomCode);
    }
  }
  applyAIPlayedCard(roomCode, roomInfo, player, playedCard, actorHadMatchingColor);
}

export function scheduleAITurn(roomCode: string) {
  if (aiTurnTimers.has(roomCode)) return;
  const roomInfo = get(roomCollection, roomCode);
  const player = roomInfo?.players[roomInfo.order];
  const delay = player?.aiDifficulty === 'hard' ? 900 : player?.aiDifficulty === 'easy' ? 450 : 700;
  const timer = setTimeout(() => {
    aiTurnTimers.delete(roomCode);
    runAITurn(roomCode);
  }, delay);
  aiTurnTimers.set(roomCode, timer);
}

export function scheduleAIChallenge(roomCode: string) {
  if (aiChallengeTimers.has(roomCode)) return;
  const timer = setTimeout(() => {
    aiChallengeTimers.delete(roomCode);
    const roomInfo = get(roomCollection, roomCode);
    const pending = roomInfo?.pendingAction;
    if (!roomInfo || !pending || pending.kind !== 'ADD4_CHALLENGE') return;
    const challenger = roomInfo.players.find((player) => player.id === pending.targetId);
    const actor = roomInfo.players.find((player) => player.id === pending.actorId);
    if (!challenger || !actor) return;
    if (pending.actorHadMatchingColor) {
      drawCardsForPlayer(roomInfo, actor, 4);
      notice(roomCode, `${challenger.name} 质疑成功，${actor.name} 获得 4 张牌`);
    } else {
      drawCardsForPlayer(roomInfo, challenger, 6);
      notice(roomCode, `${challenger.name} 质疑失败，获得 6 张牌`);
    }
    roomInfo.pendingAction = null;
    const challengerIndex = roomInfo.players.findIndex((player) => player.id === challenger.id);
    emitAfterPenalty(roomCode, roomInfo, challengerIndex);
  }, 500);
  aiChallengeTimers.set(roomCode, timer);
}

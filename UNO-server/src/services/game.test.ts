import assert from 'node:assert/strict';
import test from 'node:test';
import { cardInfomation } from '../configs/card';
import { roomCollection } from './room';
import {
  canRespondToDrawTwo,
  canRespondToForcedColor,
  checkCards,
  emitToPlayerTurn
} from './game';

const red = '#FF6666' as CardColor;
const blue = '#99CCFF' as CardColor;

function card(type: CardInfo['type'], color: string): CardInfo {
  return { cardId: Math.random(), icon: '', type, color };
}

test('two-player decks do not contain skip cards', () => {
  assert.equal(cardInfomation(2).some((item) => item.type === 'ban'), false);
  assert.equal(cardInfomation(3).filter((item) => item.type === 'ban').length, 8);
});

test('+2 chains accept matching colors, reverse cards, and wild color cards', () => {
  assert.equal(canRespondToDrawTwo(card('number-3', red), red), true);
  assert.equal(canRespondToDrawTwo(card('add-2', red), red), true);
  assert.equal(canRespondToDrawTwo(card('exchange', blue), red), true);
  assert.equal(canRespondToDrawTwo(card('palette', '#9a9a9a'), red), true);
  assert.equal(canRespondToDrawTwo(card('add-2', blue), red), false);
  assert.equal(canRespondToDrawTwo(card('add-4', '#9a9a9a'), red), false);
});

test('target cards allow a palette response but bombs require an exact color', () => {
  const palette = card('palette', '#9a9a9a');
  assert.equal(canRespondToForcedColor(palette, red, true), true);
  assert.equal(canRespondToForcedColor(palette, red, false), false);
  assert.equal(canRespondToForcedColor(card('number-7', red), red, false), true);
  assert.equal(canRespondToForcedColor(card('number-7', blue), red, true), false);
});

test('+2 constraints are enforced by the multi-card validator', () => {
  const cards = [card('number-4', red), card('number-4', red), card('number-4', blue)];
  const constraint = { kind: 'DRAW_TWO' as const, color: red };
  assert.equal(checkCards(cards, [0, 1], card('add-2', red), constraint), true);
  assert.equal(checkCards(cards, [2], card('add-2', red), constraint), false);
});

function player(id: string, cards: CardInfo[]): any {
  return {
    id,
    name: id,
    avatar: '',
    cards,
    lastCard: null,
    uno: false,
    ready: true,
    socketInstance: { readyState: 1, send: () => undefined }
  };
}

function room(players: any[]): any {
  return {
    roomId: 'test',
    roomName: 'test',
    roomCode: 'RULE-TEST',
    owner: players[0],
    players,
    gameCards: cardInfomation(players.length),
    userCards: {},
    lastCard: card('add-2', red),
    order: 0,
    status: 'GAMING',
    winnerOrder: [],
    createTime: 0,
    startTime: 0,
    endTime: -1,
    accumulation: 4,
    playOrder: 1,
    pendingAction: null
  };
}

test('an unanswered +2 chain draws the accumulated cards and advances', () => {
  const players = [player('one', [card('number-1', red)]), player('two', [card('number-2', blue)])];
  const info = room(players);
  roomCollection.set(info.roomCode, info);
  emitToPlayerTurn(info.roomCode, info, 1);
  assert.equal(players[1].cards.length, 5);
  assert.equal(info.accumulation, 0);
  assert.equal(info.order, 0);
  roomCollection.delete(info.roomCode);
});

test('a player holding a valid +2 response keeps the accumulated turn', () => {
  const players = [player('one', [card('number-1', blue)]), player('two', [card('exchange', blue)])];
  const info = room(players);
  roomCollection.set(info.roomCode, info);
  emitToPlayerTurn(info.roomCode, info, 1);
  assert.equal(players[1].cards.length, 1);
  assert.equal(info.accumulation, 4);
  assert.equal(info.order, 1);
  roomCollection.delete(info.roomCode);
});

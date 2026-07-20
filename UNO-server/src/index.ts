import type { ClientEvents } from './types/server';
import EventEmitter from 'events';

import WebSocket, { WebSocketServer } from 'ws';
import controllers from './controllers';
import { handlePlayerDisconnect } from './controllers/room';

const port = Number(process.env.UNO_PORT || 3000);
const wss = new WebSocketServer({ port });

export const eventBus = new EventEmitter();

// 监听事件列表
const events: ClientEvents[] = [
  'CREATE_ROOM',
  'JOIN_ROOM',
  'LIST_ROOMS',
  'LEAVE_ROOM',
  'DISSOLVE_ROOM',
  'READY',
  'REGISTER',
  'LOGIN',
  'AUTO_LOGIN',
  'UPDATE_PROFILE',
  'START_GAME',
  'OUT_OF_THE_CARD',
  'GET_ONE_CARD',
  'NEXT_TURN',
  'SUBMIT_COLOR',
  'SELECT_TARGET',
  'CHALLENGE_ADD4',
  'START_AI_GAME',
  'UNO'
]

let currentClient: WebSocket.WebSocket | null = null;

// 注册事件
events.forEach((key) => {
  eventBus.on(key, (data) => controllers[key](data, currentClient, wss))
})

wss.on('connection', function connection(ws) {
  // 监听消息
  ws.on('message', function incoming(message) {
    const { type, data } = JSON.parse(message.toString())
    currentClient = ws;
    eventBus.emit(type, data)
    currentClient = null;
  });

  // 监听错误
  ws.on('error', (error) => {
    console.error('error:', error);
  });

  // 监听断开:把该玩家移出所在房间(房间只要还有人就保留)
  ws.on('close', () => {
    handlePlayerDisconnect(ws)
  })

  //发送欢迎标语👏
  ws.send(JSON.stringify({
    message: '欢迎来到UNO世界！',
  }))
});

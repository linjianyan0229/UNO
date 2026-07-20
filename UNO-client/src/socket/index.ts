// import { io, Socket } from "socket.io-client";
// import type { ClientToServerEvents, ServerToClientEvents } from "~/types/server";
// import config from "~/configs/socket";
import { eventBus } from '~/store/socket';
import { useNotify } from '../composables/main';
// const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

const ws = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:3000')
const quietGameMessageTypes = new Set([
  'GAME_NOTICE',
  'NEXT_TURN',
  'RES_UNO',
  'COLOR_IS_CHANGE',
  'CHANGE_UNO_STATUS',
  'SELECT_COLOR',
  'SELECT_TARGET',
  'CHALLENGE_AVAILABLE',
  'RES_DEAL_CARDS',
  'GAME_IS_START',
  'RES_START_AI_GAME'
])
const quietGameMessages = new Set(['出牌成功', '玩家信息创建成功', '游戏开始啦'])

ws.addEventListener('open', function open() {

});

ws.addEventListener<'message'>('message', function incoming(res: MessageEvent<string>) {
  try {
    const { message, data, type } = JSON.parse(res.data)
    if (message) {
      const isInGame = typeof window !== 'undefined' && window.location.pathname === '/process'
      if (!isInGame || (!quietGameMessageTypes.has(type) && !quietGameMessages.has(message))) {
        useNotify(message)
      }
      eventBus.emit('GAME_LOG', { message, data, type })
    }
    eventBus.emit(type, data)
  } catch (err) {
    console.error('发生错误:', err)
  }
});

export default ws;

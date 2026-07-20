// import { io, Socket } from "socket.io-client";
// import type { ClientToServerEvents, ServerToClientEvents } from "~/types/server";
// import config from "~/configs/socket";
import { eventBus } from './events';
import { useNotify } from '../composables/main';
// const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

const defaultWsUrl = import.meta.env.DEV
  ? 'ws://localhost:3000'
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
const ws = new WebSocket(import.meta.env.VITE_WS_URL || defaultWsUrl)
let connectionFailureHandled = false
const quietGameMessageTypes = new Set([
  'GAME_NOTICE',
  'NEXT_TURN',
  'RES_UNO',
  'COLOR_IS_CHANGE',
  'CHANGE_UNO_STATUS',
  'SELECT_COLOR',
  'SELECT_TARGET',
  'CHALLENGE_AVAILABLE',
  'BOMB_COLOR_ROLL',
  'RES_DEAL_CARDS',
  'GAME_IS_START',
  'RES_START_AI_GAME'
])
const quietGameMessages = new Set(['出牌成功', '玩家信息创建成功', '游戏开始啦'])

ws.addEventListener('open', function open() {
  connectionFailureHandled = false
});

function handleConnectionFailure() {
  if (connectionFailureHandled) return
  connectionFailureHandled = true
  eventBus.emit('SOCKET_DISCONNECTED')
  useNotify('连接已断开，当前牌局无法继续')
  if (typeof window !== 'undefined' && ['/process', '/wait'].includes(window.location.pathname)) {
    window.setTimeout(() => window.location.assign('/'), 900)
  }
}

ws.addEventListener('close', handleConnectionFailure)
ws.addEventListener('error', handleConnectionFailure)
eventBus.on('SOCKET_REQUEST_TIMEOUT', handleConnectionFailure)

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

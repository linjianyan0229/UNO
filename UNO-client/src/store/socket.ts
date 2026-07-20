import { defineStore } from "pinia";
import socket from "~/socket";
import type { ServerEvents } from '~/types/server';
import { RoomInfo, RoomSummary } from "~/types/room";
import { eventBus } from '~/socket/events';

export { eventBus }

const REQUEST_TIMEOUT = 10_000

const useSocketStore = defineStore('socket', {
  state: () => {
    return {
      socket
    }
  },
  actions: {
    Promisify<T>(eventName: ServerEvents) {
      return new Promise<T>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout>
        const cleanup = () => {
          clearTimeout(timer)
          eventBus.removeListener(eventName, onResponse)
          eventBus.removeListener('SOCKET_DISCONNECTED', onDisconnect)
        }
        const onResponse = (data: T) => {
          cleanup()
          resolve(data)
        }
        const onDisconnect = () => {
          cleanup()
          reject(new Error('WebSocket disconnected'))
        }
        eventBus.once(eventName, onResponse)
        eventBus.once('SOCKET_DISCONNECTED', onDisconnect)
        timer = setTimeout(() => {
          cleanup()
          eventBus.emit('SOCKET_REQUEST_TIMEOUT')
          reject(new Error(`WebSocket request timed out: ${eventName}`))
        }, REQUEST_TIMEOUT)
      })
    },
    whenReady() {
      if (this.socket.readyState === WebSocket.OPEN) return Promise.resolve()
      if (this.socket.readyState !== WebSocket.CONNECTING) {
        eventBus.emit('SOCKET_DISCONNECTED')
        return Promise.reject(new Error('WebSocket is not connected'))
      }
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup()
          eventBus.emit('SOCKET_REQUEST_TIMEOUT')
          reject(new Error('WebSocket connection timed out'))
        }, REQUEST_TIMEOUT)
        const cleanup = () => {
          clearTimeout(timer)
          this.socket.removeEventListener('open', onOpen)
          this.socket.removeEventListener('close', onClose)
        }
        const onOpen = () => {
          cleanup()
          resolve()
        }
        const onClose = () => {
          cleanup()
          reject(new Error('WebSocket disconnected before opening'))
        }
        this.socket.addEventListener('open', onOpen, { once: true })
        this.socket.addEventListener('close', onClose, { once: true })
      })
    },
    async request<T>(responseEvent: ServerEvents, type: string, data: unknown) {
      await this.whenReady()
      const response = this.Promisify<T>(responseEvent)
      try {
        this.socket.send(JSON.stringify({ type, data }))
      } catch (error) {
        eventBus.emit('SOCKET_DISCONNECTED')
        throw error
      }
      return response
    },
    sendEvent(type: string, data: unknown) {
      if (this.socket.readyState !== WebSocket.OPEN) {
        eventBus.emit('SOCKET_DISCONNECTED')
        return false
      }
      this.socket.send(JSON.stringify({ type, data }))
      return true
    },
    async register(name: string, password: string) {
      return this.request<UserProfile | null>('RES_REGISTER', 'REGISTER', { name, password })
    },
    async login(name: string, password: string) {
      return this.request<UserProfile | null>('RES_LOGIN', 'LOGIN', { name, password })
    },
    async autoLogin(token: string) {
      return this.request<UserProfile | null>('RES_AUTO_LOGIN', 'AUTO_LOGIN', { token })
    },
    async updateProfile(token: string, payload: { name?: string, avatar?: string }) {
      return this.request<UserProfile | null>('RES_UPDATE_PROFILE', 'UPDATE_PROFILE', { token, ...payload })
    },
    createRoom(name: string, owner: UserInfo) {
      return this.request<RoomInfo>('RES_CREATE_ROOM', 'CREATE_ROOM', {
        roomId: Date.now().toString(),
        roomName: name,
        owner
      })
    },
    joinRoom(code: string, userInfo: UserInfo) {
      return this.request<RoomInfo>('RES_JOIN_ROOM', 'JOIN_ROOM', { roomCode: code, userInfo })
    },
    listRooms(query = '') {
      return this.request<RoomSummary[]>('RES_ROOM_LIST', 'LIST_ROOMS', { query })
    },
    startGame(code: string) {
      return this.request<null>('RES_START_GAME', 'START_GAME', code)
    },
    startAIGame(userInfo: UserInfo, difficulty: AIDifficulty) {
      return this.request<{ roomInfo: RoomInfo, userCards: CardInfo[] }>(
        'RES_START_AI_GAME',
        'START_AI_GAME',
        { userInfo, difficulty }
      )
    },
    dissolveGame(code: string) {
      this.sendEvent('DISSOLVE_ROOM', code)
    },
    toggleReady(code: string, ready: boolean) {
      this.sendEvent('READY', { roomCode: code, ready })
    },
    leaveGame(code: string, userInfo: UserInfo) {
      return this.request<null>('RES_LEAVE_ROOM', 'LEAVE_ROOM', { roomCode: code, userInfo })
    },
    outOfCard(cardsIndex: number[], roomCode: string) {
      return this.request<CardInfo[] | null>('RES_OUT_OF_THE_CARD', 'OUT_OF_THE_CARD', { cardsIndex, roomCode })
    },
    getOneCard(roomCode: string) {
      return this.request<{
        card: CardInfo,
        userCards: CardInfo[],
        penaltyResolved?: boolean
      }>('RES_GET_ONE_CARD', 'GET_ONE_CARD', roomCode)
    },
    toNextTurn(roomCode: string) {
      this.sendEvent('NEXT_TURN', roomCode)
    },
    submitColor(color: CardColor, roomCode: string) {
      this.sendEvent('SUBMIT_COLOR', { color, roomCode })
    },
    submitTarget(targetId: string, roomCode: string) {
      this.sendEvent('SELECT_TARGET', { targetId, roomCode })
    },
    challengeAdd4(challenge: boolean, roomCode: string) {
      this.sendEvent('CHALLENGE_ADD4', { challenge, roomCode })
    },
    uno(roomCode: string) {
      this.sendEvent('UNO', roomCode)
    }
  }
})

export default useSocketStore

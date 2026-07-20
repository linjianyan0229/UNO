import { defineStore } from "pinia";
import socket from "~/socket";
import EventEmitter from "events";
import type { ServerEvents } from '~/types/server';
import { RoomInfo, RoomSummary } from "~/types/room";

export const eventBus = new EventEmitter()

const useSocketStore = defineStore('socket', {
  state: () => {
    return {
      socket
    }
  },
  actions: {
    Promisify<T>(eventName: ServerEvents) {
      return new Promise<T>((resolve) => {
        eventBus.once(eventName, resolve)
      })
    },
    whenReady() {
      if (this.socket.readyState === WebSocket.OPEN) return Promise.resolve()
      return new Promise<void>((resolve) => {
        this.socket.addEventListener('open', () => resolve(), { once: true })
      })
    },
    async register(name: string, password: string) {
      await this.whenReady()
      this.socket.send(JSON.stringify({
        type: 'REGISTER',
        data: { name, password }
      }))
      return this.Promisify<UserProfile | null>('RES_REGISTER')
    },
    async login(name: string, password: string) {
      await this.whenReady()
      this.socket.send(JSON.stringify({
        type: 'LOGIN',
        data: { name, password }
      }))
      return this.Promisify<UserProfile | null>('RES_LOGIN')
    },
    async autoLogin(token: string) {
      await this.whenReady()
      this.socket.send(JSON.stringify({
        type: 'AUTO_LOGIN',
        data: { token }
      }))
      return this.Promisify<UserProfile | null>('RES_AUTO_LOGIN')
    },
    async updateProfile(token: string, payload: { name?: string, avatar?: string }) {
      await this.whenReady()
      this.socket.send(JSON.stringify({
        type: 'UPDATE_PROFILE',
        data: { token, ...payload }
      }))
      return this.Promisify<UserProfile | null>('RES_UPDATE_PROFILE')
    },
    createRoom(name: string, owner: UserInfo) {
      this.socket.send(JSON.stringify({
        type: 'CREATE_ROOM',
        data: {
          roomId: Date.now().toString(),
          roomName: name,
          owner
        }
      }))
      return this.Promisify<RoomInfo>('RES_CREATE_ROOM')
    },
    joinRoom(code: string, userInfo: UserInfo) {
      this.socket.send(JSON.stringify({
        type: 'JOIN_ROOM',
        data: {
          roomCode: code,
          userInfo
        }
      }))
      return this.Promisify<RoomInfo>('RES_JOIN_ROOM')
    },
    listRooms(query = '') {
      this.socket.send(JSON.stringify({
        type: 'LIST_ROOMS',
        data: { query }
      }))
      return this.Promisify<RoomSummary[]>('RES_ROOM_LIST')
    },
    startGame(code: string) {
      this.socket.send(JSON.stringify({
        type: 'START_GAME',
        data: code
      }))
      return this.Promisify<null>('RES_START_GAME')
    },
    startAIGame(userInfo: UserInfo, difficulty: AIDifficulty) {
      this.socket.send(JSON.stringify({
        type: 'START_AI_GAME',
        data: { userInfo, difficulty }
      }))
      return this.Promisify<{ roomInfo: RoomInfo, userCards: CardInfo[] }>('RES_START_AI_GAME')
    },
    dissolveGame(code: string) {
      this.socket.send(JSON.stringify({
        type: 'DISSOLVE_ROOM',
        data: code
      }))
    },
    toggleReady(code: string, ready: boolean) {
      this.socket.send(JSON.stringify({
        type: 'READY',
        data: {
          roomCode: code,
          ready,
        }
      }))
    },
    leaveGame(code: string, userInfo: UserInfo) {
      this.socket.send(JSON.stringify({
        type: 'LEAVE_ROOM',
        data: {
          roomCode: code,
          userInfo,
        }
      }))
      return this.Promisify<null>('RES_LEAVE_ROOM')
    },
    outOfCard(cardsIndex: number[], roomCode: string) {
      this.socket.send(JSON.stringify({
        type: 'OUT_OF_THE_CARD',
        data: {
          cardsIndex,
          roomCode,
        }
      }))
      return this.Promisify<CardInfo[] | null>('RES_OUT_OF_THE_CARD')
    },
    getOneCard(roomCode: string) {
      this.socket.send(JSON.stringify({
        type: 'GET_ONE_CARD',
        data: roomCode
      }))
      return this.Promisify<{
        card: CardInfo,
        userCards: CardInfo[]
      }>('RES_GET_ONE_CARD')
    },
    toNextTurn(roomCode: string) {
      this.socket.send(JSON.stringify({
        type: 'NEXT_TURN',
        data: roomCode
      }))
    },
    submitColor(color: CardColor, roomCode: string) {
      this.socket.send(JSON.stringify({
        type: 'SUBMIT_COLOR',
        data: {
          color,
          roomCode
        }
      }))
    },
    submitTarget(targetId: string, roomCode: string) {
      this.socket.send(JSON.stringify({
        type: 'SELECT_TARGET',
        data: { targetId, roomCode }
      }))
    },
    challengeAdd4(challenge: boolean, roomCode: string) {
      this.socket.send(JSON.stringify({
        type: 'CHALLENGE_ADD4',
        data: { challenge, roomCode }
      }))
    },
    uno(roomCode: string) {
      this.socket.send(JSON.stringify({
        type: 'UNO',
        data: roomCode
      }))
    }
  }
})

export default useSocketStore

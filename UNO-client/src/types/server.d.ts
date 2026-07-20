import type { RoomData, RoomInfo, PlayerInfo, RoomSummary } from "./room"
import type { UserInfo, UserProfile } from "./user"


declare interface RespondFromClient<T = ClientEvents, D = unknown> {
  type: T,
  data: D
  message?: string
}

declare interface RespondFromServer<T = ServerEvents, D = unknown> {
  type: T,
  data: D
  message?: string
}

type RoomCode = string

declare interface ClientToServerEvents {
  CREATE_ROOM: ClientEventListenersCb<'CREATE_ROOM', RoomData>
  REGISTER: ClientEventListenersCb<'REGISTER', { name: string, password: string }>
  LOGIN: ClientEventListenersCb<'LOGIN', { name: string, password: string }>
  AUTO_LOGIN: ClientEventListenersCb<'AUTO_LOGIN', { token: string }>
  UPDATE_PROFILE: ClientEventListenersCb<'UPDATE_PROFILE', { token: string, name?: string, avatar?: string }>
  JOIN_ROOM: ClientEventListenersCb<'JOIN_ROOM', UserInfo>
  LEAVE_ROOM: ClientEventListenersCb<'LEAVE_ROOM', {
    roomCode: string,
    userInfo: UserInfo
  }>
  DISSOLVE_ROOM: ClientEventListenersCb<'DISSOLVE_ROOM', RoomCode>
  READY: ClientEventListenersCb<'READY', { roomCode: RoomCode, ready: boolean }>
  LIST_ROOMS: ClientEventListenersCb<'LIST_ROOMS', { query?: string }>
  START_GAME: ClientEventListenersCb<'START_GAME', RoomCode>
  OUT_OF_THE_CARD: ClientEventListenersCb<'OUT_OF_THE_CARD', {
    roomCode: RoomCode,
    cardsIndex: number[]
  }>
  GET_ONE_CARD: ClientEventListenersCb<'GET_ONE_CARD', RoomCode>
  NEXT_TURN: ClientEventListenersCb<'NEXT_TURN', RoomCode>
  SUBMIT_COLOR: ClientEventListenersCb<'SUBMIT_COLOR', {
    color: CardColor,
    roomCode: RoomCode
  }>
  SELECT_TARGET: ClientEventListenersCb<'SELECT_TARGET', {
    targetId: string,
    roomCode: RoomCode
  }>
  CHALLENGE_ADD4: ClientEventListenersCb<'CHALLENGE_ADD4', {
    challenge: boolean,
    roomCode: RoomCode
  }>
  START_AI_GAME: ClientEventListenersCb<'START_AI_GAME', {
    userInfo: UserInfo,
    difficulty: AIDifficulty
  }>
  UNO: ClientEventListenersCb<'UNO', RoomCode>
}

declare interface ServerToClientEvents {
  WELCOME: ClientEventListenersCb<'WELCOME', null>
  RES_CREATE_ROOM: ServerEventListenersCb<'RES_CREATE_ROOM', RoomInfo>
  RES_REGISTER: ServerEventListenersCb<'RES_REGISTER', UserProfile | null>
  RES_LOGIN: ServerEventListenersCb<'RES_LOGIN', UserProfile | null>
  RES_AUTO_LOGIN: ServerEventListenersCb<'RES_AUTO_LOGIN', UserProfile | null>
  RES_UPDATE_PROFILE: ServerEventListenersCb<'RES_UPDATE_PROFILE', UserProfile | null>
  RES_JOIN_ROOM: ServerEventListenersCb<'RES_JOIN_ROOM', { roomCode: string, playerInfo: PlayerInfo }>
  RES_LEAVE_ROOM: ServerEventListenersCb<'RES_LEAVE_ROOM', null>
  RES_DISSOLVE_ROOM: ServerEventListenersCb<'RES_DISSOLVE_ROOM', null>
  RES_ROOM_LIST: ServerEventListenersCb<'RES_ROOM_LIST', RoomSummary[]>
  UPDATE_PLAYER_LIST: ServerEventListenersCb<'UPDATE_PLAYER_LIST', PlayerInfo[]>
  UPDATE_ROOM_INFO: ServerEventListenersCb<'UPDATE_ROOM_INFO', RoomInfo>
  GAME_IS_START: ServerEventListenersCb<'GAME_IS_START', { roomInfo: RoomInfo, userCards: CardInfo[] }>
  RES_START_GAME: ServerEventListenersCb<'RES_START_GAME', {
    userCards: CardInfo[]
  }>
  DEAL_CARDS: ServerEventListenersCb<'RES_DEAL_CARDS', CardInfo[]>
  NEXT_TURN: ServerEventListenersCb<'NEXT_TURN', {
    players: PlayerInfo[],
    lastCard: CardInfo,
    order: number;
  }>
  RES_OUT_OF_THE_CARD: ServerEventListenersCb<'RES_OUT_OF_THE_CARD', CardInfo[] | null>
  GAME_IS_OVER: ServerEventListenersCb<'GAME_IS_OVER', {
    endTime: number,
    winnerOrder: PlayerInfo[],
    players: PlayerInfo[],
    owner: PlayerInfo,
    canReplay: boolean
  }>
  RES_GET_ONE_CARD: ServerEventListenersCb<'RES_OUT_OF_THE_CARD', {
    card: CardInfo;
    userCards: CardInfo[]
  }>
  RES_NEXT_TURN: ServerEventListenersCb<'RES_NEXT_TURN', null>
  SELECT_COLOR: ServerEventListenersCb<'SELECT_COLOR', { cardType: 'palette' | 'add-4' }>
  COLOR_IS_CHANGE: ServerEventListenersCb<'COLOR_IS_CHANGE', CardColor>
  SELECT_TARGET: ServerEventListenersCb<'SELECT_TARGET', {
    cardType: 'target' | 'bomb',
    targets: TargetPlayer[]
  }>
  CHALLENGE_AVAILABLE: ServerEventListenersCb<'CHALLENGE_AVAILABLE', {
    actorName: string,
    color: CardColor,
    penalty: number,
    challengePenalty: number
  }>
  GAME_NOTICE: ServerEventListenersCb<'GAME_NOTICE', null>
  RES_START_AI_GAME: ServerEventListenersCb<'RES_START_AI_GAME', {
    roomInfo: RoomInfo,
    userCards: CardInfo[]
  }>
  RES_UNO: ServerEventListenersCb<'SELECT_COLOR', null>
  CHANGE_UNO_STATUS: ServerEventListenersCb<'SELECT_COLOR', {
    playerId: string,
    playerName: string,
    unoStatus: boolean
  }>
}


declare type ServerEventListenersCb<T, D> = (args: RespondFromClient<T, D>) => void
declare type ClientEventListenersCb<T, D> = (args: D, ws: WebSocket.WebSocket, wss: WebSocket.Server<WebSocket.WebSocket>) => void

declare type ClientRoomEvents = 'CREATE_ROOM' | 'JOIN_ROOM' | 'LEAVE_ROOM' | 'DISSOLVE_ROOM' | 'READY' | 'LIST_ROOMS'
declare type ClientUserEvents = 'REGISTER' | 'LOGIN' | 'AUTO_LOGIN' | 'UPDATE_PROFILE'
declare type ClientGameEvents = 'OUT_OF_THE_CARD' | 'START_GAME' | 'START_AI_GAME' | 'GET_ONE_CARD' | 'NEXT_TURN' | 'SUBMIT_COLOR' | 'SELECT_TARGET' | 'CHALLENGE_ADD4' | 'UNO'

declare type ServerRoomEvents = 'RES_CREATE_ROOM' | 'RES_JOIN_ROOM' | 'RES_LEAVE_ROOM' | 'RES_DISSOLVE_ROOM' | 'RES_ROOM_LIST'
declare type ServerUserEvents = 'RES_REGISTER' | 'RES_LOGIN' | 'RES_AUTO_LOGIN' | 'RES_UPDATE_PROFILE'
declare type ServerRGameEvents = 'RES_SUBMIT_COLOR' | 'RES_DEAL_CARDS' | 'UPDATE_PLAYER_LIST' | 'UPDATE_ROOM_INFO' | 'GAME_IS_START' | 'RES_START_GAME' | 'RES_START_AI_GAME' | 'DEAL_CARDS' | 'NEXT_TURN' | 'RES_OUT_OF_THE_CARD' | 'GAME_IS_OVER' | 'RES_GET_ONE_CARD' | 'RES_NEXT_TURN' | 'SELECT_COLOR' | 'COLOR_IS_CHANGE' | 'SELECT_TARGET' | 'CHALLENGE_AVAILABLE' | 'GAME_NOTICE' | 'RES_UNO' | 'CHANGE_UNO_STATUS'



declare type ClientEvents = ClientRoomEvents | ClientUserEvents | ClientGameEvents
declare type ServerEvents = 'WELCOME' | ServerRoomEvents | ServerUserEvents | ServerRGameEvents

declare type Controllers<T extends keyof EToD, S, I> = {
  [K in T]: (args: K extends keyof ClientToServerEvents ? GetDataTypeOfEventName<K> : unknown, sc: S, io: I)
    => Promise<addRESPrefix<K> extends keyof ClientToServerEvents ? RespondFromClient<addRESPrefix<K>, GetDataTypeOfEventName<addRESPrefix<K>>> : void>
}

declare interface InterServerEvents {
}


declare type ServerType = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents>
declare type SocketType = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents>;

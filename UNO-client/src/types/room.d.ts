import WebSocket from 'ws';
declare interface RoomData {
  roomId: string;
  roomName: string;
  owner: PlayerInfo;
}

declare interface RoomSummary {
  roomCode: string;
  roomName: string;
  ownerName: string;
  playerCount: number;
  maxPlayers: number;
  status: 'WAITING';
  createTime: number;
}

declare interface PlayerInfo extends UserInfo {
  socketInstance: WebSocket.WebSocket,
  lastCard: CardInfo | null,
  cards: CardInfo[],
  uno: boolean,
  ready: boolean,
  avatar: string,
  isAI?: boolean,
  aiDifficulty?: AIDifficulty
}

declare type PendingAction =
  | {
      kind: 'COLOR'
      actorId: string
      cardType: 'palette' | 'add-4'
      actorHadMatchingColor: boolean
    }
  | {
      kind: 'ADD4_CHALLENGE'
      actorId: string
      targetId: string
      color: CardColor
      actorHadMatchingColor: boolean
    }
  | {
      kind: 'TARGET'
      actorId: string
      cardType: 'target'
    }
  | {
      kind: 'TARGET_COLOR'
      actorId: string
      targetId: string
    }
  | {
      kind: 'FORCED_COLOR'
      source: 'target' | 'bomb'
      actorId: string
      targetId: string
      color: CardColor
      penalty: number
      allowPalette: boolean
    }

declare interface TargetPlayer {
  id: string
  name: string
}

declare type RoomInfo = RoomData & {
  roomCode: string;
  gameCards: CardInfo[];
  userCards: {
    [key: string]: CardInfo[]
  };
  lastCard: CardInfo | null;
  players: PlayerInfo[];
  order: number;
  status: 'WAITING' | 'GAMING' | 'END'
  winnerOrder: PlayerInfo[];
  createTime: number;
  startTime: number;
  endTime: number;
  playOrder: 1 | -1;
  accumulation: number
  pendingAction: PendingAction | null
}

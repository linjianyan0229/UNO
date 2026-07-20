<template>
  <div class="wait-shell">
    <button v-if="!isOwner" class="corner-leave" type="button" @click="handleLeave">离开房间</button>

    <div class="wait-grid">
      <!-- 左侧:玩家列表 -->
      <section class="players-panel" aria-label="玩家列表">
        <header class="panel-head">
          <h2>玩家</h2>
          <span class="panel-count">{{ players.length }}/{{ maxPlayers }}</span>
        </header>

        <ul class="player-list">
          <li v-for="player in players" :key="player.id + player.name" class="player-row">
            <img class="player-avatar" :src="avatarOf(player)" alt="" />
            <div class="player-meta">
              <strong>{{ player.name }}</strong>
              <span class="player-id">No.{{ player.id }}</span>
            </div>
            <span v-if="isOwnerPlayer(player)" class="tag tag-owner">房主</span>
            <span v-else-if="player.isAI" class="tag tag-ai">AI</span>
            <span v-else class="tag" :class="player.ready ? 'tag-ready' : 'tag-wait'">
              {{ player.ready ? '已准备' : '待准备' }}
            </span>
          </li>
        </ul>

        <div v-if="lastRanking.length" class="ranking-card">
          <div class="ranking-head">上局排名</div>
          <ol class="ranking-list">
            <li v-for="(p, i) in lastRanking" :key="p.id + p.name">
              <span class="rank-no" :class="{ champ: i === 0 }">{{ i + 1 }}</span>
              <span class="rank-name">{{ p.name }}</span>
              <span class="rank-cards">{{ p.cards?.length ?? 0 }} 张</span>
            </li>
          </ol>
        </div>
      </section>

      <!-- 右侧:房间信息与操作 -->
      <section class="info-panel" aria-label="房间信息">
        <div class="room-title">
          <span class="room-kicker">房间名称</span>
          <h1>{{ roomName || 'UNO 房间' }}</h1>
          <button class="room-code" type="button" @click="copyCode">房间号 {{ roomCode }} · 点击复制</button>
        </div>

        <div v-if="qrCodeUrl" class="qr-box">
          <img :src="qrCodeUrl" alt="房间二维码" />
          <span>扫码加入</span>
        </div>

        <div class="link-box">
          <span class="link-label">邀请链接</span>
          <div class="link-row">
            <input readonly :value="joinLink" aria-label="房间分享链接" />
            <a v-if="joinLink" class="link-open" :href="joinLink">打开</a>
            <button type="button" @click="copyJoinLink()">复制</button>
          </div>
        </div>

        <div class="action-box">
          <template v-if="isOwner">
            <button class="btn btn-primary" :disabled="!canStart" @click="handleStart">开始游戏</button>
            <button class="btn btn-ghost" type="button" @click="handleDissolve">解散房间</button>
            <p v-if="!canStart" class="action-hint">{{ startHint }}</p>
          </template>
          <template v-else>
            <button class="btn" :class="myReady ? 'btn-ghost' : 'btn-primary'" type="button" @click="handleToggleReady">
              {{ myReady ? '取消准备' : '准备' }}
            </button>
            <p class="action-hint">已准备后等待房主开始，或点击左上角「离开房间」</p>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoomStore } from '~/store/room';
import useSocketStore, { eventBus } from '~/store/socket';
import useUserStore from '~/store/user';
import { generateFromString } from 'generate-avatar';
import { useClipboard } from '@vueuse/core'
import { useNotify } from '~/composables';
import Dialog from '~/plugins/dialog/Dialog';
import QRCode from 'qrcode';
import type { PlayerInfo, RoomInfo } from '~/types/room';

const router = useRouter()
const roomStore = useRoomStore()
const userStore = useUserStore()
const socketStore = useSocketStore()

const roomName = computed(() => roomStore.roomName)
const roomCode = computed(() => roomStore.roomCode)
const players = computed(() => roomStore.players || [])
const maxPlayers = 9
const lastRanking = computed(() => roomStore.winnerOrder || [])

const isOwnerPlayer = (player: PlayerInfo) =>
  roomStore?.owner?.id === player.id && roomStore?.owner?.name === player.name
const isOwner = computed(() => roomStore?.owner?.id === userStore?.id && roomStore?.owner?.name === userStore?.name)

const me = computed(() => players.value.find((p) => p.id === userStore.id && p.name === userStore.name))
const myReady = computed(() => !!me.value?.ready)

// 需所有非房主真人玩家准备,且至少 2 人,房主才能开始
const nonOwnerHumans = computed(() => players.value.filter((p) => !p.isAI && !isOwnerPlayer(p)))
const allReady = computed(() => nonOwnerHumans.value.every((p) => p.ready))
const canStart = computed(() => players.value.length >= 2 && allReady.value)
const startHint = computed(() => {
  if (players.value.length < 2) return '至少需要 2 名玩家'
  if (!allReady.value) return '等待所有玩家准备'
  return ''
})

const avatarOf = (player: PlayerInfo) =>
  player.avatar || `data:image/svg+xml;utf8,${generateFromString(player.id + player.name)}`

const { copy } = useClipboard({ source: roomCode })
const joinLink = computed(() => {
  if (!roomCode.value || typeof window === 'undefined') return ''
  return `${window.location.origin}/rooms?room=${encodeURIComponent(roomCode.value)}`
})
const { copy: copyJoinLink } = useClipboard({ source: joinLink })
const qrCodeUrl = ref('')

watch(joinLink, async (value) => {
  if (!value) {
    qrCodeUrl.value = ''
    return
  }
  qrCodeUrl.value = await QRCode.toDataURL(value, {
    width: 176,
    margin: 1,
    color: { dark: '#24272b', light: '#ffffff' }
  })
}, { immediate: true })

const copyCode = () => {
  copy()
  useNotify('复制成功')
}

onBeforeMount(() => {
  eventBus.on('UPDATE_PLAYER_LIST', (players: PlayerInfo[]) => {
    roomStore.updatePlayers(players)
  })

  // 房主变更等房间级同步
  eventBus.on('UPDATE_ROOM_INFO', (roomInfo: RoomInfo) => {
    roomStore.setRoomInfo(roomInfo)
  })

  // 游戏开始,进入对局
  eventBus.on('GAME_IS_START', ({ roomInfo, userCards }) => {
    eventBus.once('NEXT_TURN', ({ lastCard, order, players }) => {
      roomStore.setRoomInfoProp<'lastCard'>('lastCard', lastCard);
      roomStore.setRoomInfoProp<'order'>('order', order);
      roomStore.setRoomInfoProp<'players'>('players', players);
    })
    roomStore.setRoomInfo(roomInfo)
    roomStore.setUserCards(userCards)
    router.push('/process')
  })

  // 房间被解散
  eventBus.on('RES_DISSOLVE_ROOM', () => {
    roomStore.cleanRoom(router)
  })
})

onUnmounted(() => {
  eventBus.removeAllListeners('UPDATE_PLAYER_LIST')
  eventBus.removeAllListeners('UPDATE_ROOM_INFO')
  eventBus.removeAllListeners('GAME_IS_START')
  eventBus.removeAllListeners('RES_DISSOLVE_ROOM')
})

const handleStart = () => {
  if (!canStart.value) {
    useNotify(startHint.value)
    return
  }
  socketStore.startGame(roomCode.value)
}

const handleToggleReady = () => {
  socketStore.toggleReady(roomCode.value, !myReady.value)
}

const handleDissolve = () => {
  Dialog({
    title: '解散房间',
    content: '解散后房间将关闭，是否确认？',
    comfirm: (close) => {
      socketStore.dissolveGame(roomCode.value)
      close()
    }
  })
}

const handleLeave = () => {
  Dialog({
    title: '离开房间',
    content: '是否确认离开该房间？',
    comfirm: (close) => {
      socketStore.leaveGame(roomCode.value, userStore.getUserInfo()).then(() => {
        roomStore.cleanRoom(router)
      })
      close()
    }
  })
}
</script>

<style scoped>
.wait-shell {
  position: relative;
  width: min(100%, 960px);
  box-sizing: border-box;
  padding: 8px 4px 24px;
  color: #24272b;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.corner-leave {
  position: absolute;
  z-index: 5;
  top: -2px;
  left: 4px;
  min-height: 34px;
  padding: 5px 12px;
  color: #626970;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.94);
  border: 2px dashed #aeb5bc;
  border-radius: 7px;
  cursor: pointer;
  transition: color 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
}

.corner-leave:hover {
  color: #a63d42;
  background: #fff7f7;
  border-color: #c64b4e;
}

.wait-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 18px;
  margin-top: 40px;
  align-items: start;
}

/* 左:玩家列表 */
.players-panel,
.info-panel {
  box-sizing: border-box;
  padding: 16px 16px 18px;
  background: #ffffff;
  border: 1px solid #e0e3e6;
  border-radius: 12px;
  box-shadow: 0 8px 22px rgba(28, 32, 37, 0.06);
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-head h2 {
  margin: 0;
  font-size: 16px;
}

.panel-count {
  color: #737980;
  font-size: 12px;
  font-weight: 600;
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #f7f8f9;
  border: 1px solid #e6e9ec;
  border-radius: 9px;
}

.player-avatar {
  width: 40px;
  height: 40px;
  flex: none;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(28, 32, 37, 0.16);
}

.player-meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.3;
}

.player-meta strong {
  max-width: 100%;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-id {
  color: #969ca2;
  font-size: 11px;
}

.tag {
  flex: none;
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
}

.tag-owner { color: #a4741b; background: #fdf1d6; }
.tag-ai { color: #4a6b7a; background: #e3eef2; }
.tag-ready { color: #2f7d46; background: #e0f3e6; }
.tag-wait { color: #8a8f96; background: #eceef0; }

/* 上局排名 */
.ranking-card {
  margin-top: 14px;
  padding: 12px;
  background: #fbfaf5;
  border: 1px dashed #e2d9bf;
  border-radius: 10px;
}

.ranking-head {
  margin-bottom: 8px;
  color: #8a7a3f;
  font-size: 12px;
  font-weight: 700;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ranking-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.rank-no {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: #737980;
  font-size: 12px;
  font-weight: 700;
  background: #ececec;
  border-radius: 50%;
}

.rank-no.champ {
  color: #fff;
  background: #e4ad2e;
}

.rank-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-cards {
  flex: none;
  color: #868c93;
  font-size: 12px;
}

/* 右:房间信息 */
.info-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.room-title {
  width: 100%;
  text-align: center;
}

.room-kicker {
  color: #9aa0a6;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.4px;
}

.room-title h1 {
  margin: 6px 0 8px;
  font-size: 24px;
  line-height: 1.1;
  word-break: break-word;
}

.room-code {
  padding: 5px 12px;
  color: #a14b4f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: #fbf1f1;
  border: 1px dashed #e2b6b7;
  border-radius: 999px;
  cursor: pointer;
}

.room-code:hover {
  background: #f8e6e6;
}

.qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #7b8188;
  font-size: 12px;
}

.qr-box img {
  width: 156px;
  height: 156px;
  padding: 6px;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #d5dade;
  border-radius: 8px;
}

.link-box {
  width: 100%;
}

.link-label {
  display: block;
  margin-bottom: 7px;
  color: #727980;
  font-size: 12px;
  font-weight: 600;
}

.link-row {
  display: flex;
  min-width: 0;
  gap: 7px;
}

.link-row input {
  min-width: 0;
  height: 34px;
  flex: 1;
  padding: 0 9px;
  color: #696f76;
  font-size: 11px;
  background: #fff;
  border: 1px solid #d4d9dd;
  border-radius: 6px;
}

.link-open {
  display: inline-flex;
  height: 34px;
  align-items: center;
  padding: 0 10px;
  color: #687078;
  font-size: 12px;
  text-decoration: none;
  background: #eef0f2;
  border-radius: 6px;
}

.link-row button {
  flex: none;
  padding: 0 12px;
  color: #fff;
  font-size: 12px;
  background: #c64b4e;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.action-box {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 10px;
  margin-top: 2px;
}

.btn {
  width: 100%;
  padding: 11px 16px;
  font-size: 14px;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;
}

.btn-primary {
  color: #fff;
  background: #c64b4e;
  border: 2px solid #c64b4e;
}

.btn-primary:hover {
  background: #b13f42;
  border-color: #b13f42;
}

.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.btn-ghost {
  color: #626970;
  background: transparent;
  border: 2px dashed #aeb5bc;
}

.btn-ghost:hover {
  color: #24272b;
  border-color: #7e858c;
}

.action-hint {
  margin: 0;
  color: #969ca2;
  font-size: 12px;
  text-align: center;
}

@media (max-width: 720px) {
  .wait-grid {
    grid-template-columns: 1fr;
    margin-top: 44px;
  }

  .info-panel {
    order: -1;
  }

  .qr-box img {
    width: 132px;
    height: 132px;
  }
}

@media (prefers-color-scheme: dark) {
  .wait-shell {
    color: #eef1f4;
  }

  .corner-leave {
    color: #d3d7db;
    background: rgba(30, 33, 37, 0.94);
    border-color: #596068;
  }

  .corner-leave:hover {
    color: #ffb4b7;
    background: #352529;
    border-color: #dc676a;
  }

  .players-panel,
  .info-panel {
    background: rgba(27, 30, 35, 0.94);
    border-color: #3f454b;
    box-shadow: none;
  }

  .player-row {
    background: #24282d;
    border-color: #3a4046;
  }

  .player-id { color: #8a9199; }
  .tag-owner { color: #f0c766; background: #3a3016; }
  .tag-ai { color: #a9cede; background: #23343c; }
  .tag-ready { color: #8fe0a5; background: #1f3a27; }
  .tag-wait { color: #a3a9b0; background: #2c3137; }

  .ranking-card {
    background: #262319;
    border-color: #4a4429;
  }

  .ranking-head { color: #d4bd76; }
  .rank-no { color: #c3c8cd; background: #3a4046; }

  .room-kicker { color: #90969c; }
  .room-code {
    color: #f0aeb0;
    background: #33262a;
    border-color: #6a4a4d;
  }

  .link-row input {
    color: #c8cdd2;
    background: #24282d;
    border-color: #454b52;
  }

  .link-open {
    color: #c8cdd2;
    background: #333940;
  }

  .btn-ghost {
    color: #c8cdd2;
    border-color: #596068;
  }

  .btn-ghost:hover {
    color: #fff;
    border-color: #8a9199;
  }

  .action-hint,
  .qr-box { color: #9ca3aa; }
}
</style>

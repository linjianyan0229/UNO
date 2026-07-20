<template>
  <div class="rooms-shell">
    <header class="rooms-header">
      <button class="back-button" type="button" @click="router.push('/')">返回首页</button>
      <div>
        <span class="rooms-kicker">ONLINE ROOMS</span>
        <h1>加入房间</h1>
        <p>搜索一个等待中的房间，或使用朋友分享的房间号加入。</p>
      </div>
      <span class="online-count">{{ rooms.length }} 个房间</span>
    </header>

    <section class="join-controls" aria-label="加入房间设置">
      <div class="control-field search-field">
        <label for="room-search">搜索房间</label>
        <div class="input-action">
          <input id="room-search" v-model="searchQuery" placeholder="房间名、房间号或房主" @keyup.enter="loadRooms" />
          <button type="button" title="搜索房间" @click="loadRooms">搜索</button>
        </div>
      </div>
      <div class="control-field code-field">
        <label for="room-code">房间号</label>
        <div class="input-action">
          <input id="room-code" v-model="joinCode" placeholder="输入分享的房间号" @keyup.enter="joinByCode" />
          <button type="button" title="加入房间" @click="joinByCode">加入</button>
        </div>
      </div>
    </section>

    <section class="room-results" aria-label="可加入房间列表">
      <div v-if="loading" class="room-state">正在查找房间...</div>
      <div v-else-if="!rooms.length" class="room-state">
        <strong>没有找到等待中的房间</strong>
        <span>可以创建一个新房间，或检查分享的房间号。</span>
      </div>
      <div v-else class="room-grid">
        <article v-for="room in rooms" :key="room.roomCode" class="room-item">
          <div class="room-item-main">
            <div class="room-mark">{{ room.roomName.slice(0, 1) || '房' }}</div>
            <div class="room-copy">
              <h2>{{ room.roomName }}</h2>
              <p>房主：{{ room.ownerName }}</p>
              <span class="room-code">{{ room.roomCode }}</span>
            </div>
          </div>
          <div class="room-item-meta">
            <span>{{ room.playerCount }}/{{ room.maxPlayers }} 人</span>
            <button type="button" @click="chooseRoom(room.roomCode)">加入房间</button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRoomStore } from '~/store/room'
import useSocketStore from '~/store/socket'
import useUserStore from '~/store/user'
import { useNotify } from '~/composables'
import type { RoomSummary } from '~/types/room'

const router = useRouter()
const route = useRoute()
const socketStore = useSocketStore()
const userStore = useUserStore()
const roomStore = useRoomStore()

const searchQuery = ref('')
const joinCode = ref(typeof route.query.room === 'string' ? route.query.room.toUpperCase() : '')
const rooms = ref<RoomSummary[]>([])
const loading = ref(false)
let refreshTimer: ReturnType<typeof setInterval> | undefined

const loadRooms = async () => {
  loading.value = true
  try {
    rooms.value = await socketStore.listRooms(searchQuery.value.trim())
  } finally {
    loading.value = false
  }
}

const chooseRoom = (roomCode: string) => {
  joinCode.value = roomCode
  void joinByCode()
}

const joinByCode = async () => {
  const code = joinCode.value.trim().toUpperCase()
  if (!code) {
    useNotify('请输入房间号')
    return
  }
  // 已登录,直接用账号身份加入
  const roomInfo = await socketStore.joinRoom(code, userStore.getUserInfo())
  if (!roomInfo) return
  roomStore.setRoomInfo(roomInfo)
  router.push('/wait')
}

onMounted(() => {
  void loadRooms()
  refreshTimer = setInterval(() => void loadRooms(), 5000)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.rooms-shell {
  width: min(100%, 1040px);
  min-height: 620px;
  box-sizing: border-box;
  padding: 28px 36px 36px;
  color: #25282d;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.rooms-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e0e3e6;
}

.back-button {
  flex: none;
  padding: 7px 12px;
  color: #636a71;
  font-size: 13px;
  background: #fff;
  border: 1px dashed #aeb5bc;
  border-radius: 6px;
  cursor: pointer;
}

.rooms-kicker {
  color: #858b92;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.6px;
}

.rooms-header h1 {
  margin: 7px 0 5px;
  font-size: 28px;
  line-height: 1;
}

.rooms-header p {
  margin: 0;
  color: #757c83;
  font-size: 13px;
}

.online-count {
  flex: none;
  padding: 7px 10px;
  color: #697078;
  font-size: 12px;
  background: #f1f3f4;
  border-radius: 5px;
}

.join-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  align-items: end;
  padding: 22px 0;
}

.control-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7px;
}

.control-field label {
  color: #6b7178;
  font-size: 12px;
  font-weight: 600;
}

.control-field input {
  width: 100%;
  height: 38px;
  box-sizing: border-box;
  padding: 0 10px;
  color: #282c31;
  background: #fff;
  border: 1px solid #d3d8dc;
  border-radius: 6px;
  outline: none;
}

.control-field input:focus {
  border-color: #c64b4e;
  box-shadow: 0 0 0 3px rgba(198, 75, 78, 0.12);
}

.input-action {
  display: flex;
  gap: 7px;
}

.input-action input {
  min-width: 0;
  flex: 1;
}

.input-action button,
.room-item-meta button {
  flex: none;
  min-width: 58px;
  padding: 0 12px;
  color: #fff;
  font-size: 13px;
  background: #c64b4e;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.room-results {
  min-height: 280px;
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.room-item {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #dce0e3;
  border-radius: 7px;
}

.room-item-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.room-mark {
  display: flex;
  width: 38px;
  height: 38px;
  flex: none;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 17px;
  font-weight: 800;
  background: #4e8ca8;
  border-radius: 7px;
}

.room-copy {
  min-width: 0;
}

.room-copy h2 {
  max-width: 170px;
  margin: 0 0 4px;
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-copy p {
  margin: 0 0 3px;
  color: #7c838a;
  font-size: 11px;
}

.room-code {
  color: #a14b4f;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
}

.room-item-meta {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 9px;
}

.room-item-meta > span {
  color: #6e757c;
  font-size: 12px;
  white-space: nowrap;
}

.room-item-meta button {
  height: 30px;
  min-width: 70px;
  padding: 0 9px;
  font-size: 12px;
}

.room-state {
  display: flex;
  min-height: 260px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #8a9198;
  text-align: center;
}

.room-state strong {
  color: #555c63;
  font-size: 15px;
}

@media (max-width: 820px) {
  .rooms-shell {
    min-height: 0;
    padding: 22px 18px 28px;
  }

  .rooms-header {
    flex-wrap: wrap;
  }

  .rooms-header > div {
    order: 3;
    width: 100%;
  }

  .join-controls,
  .room-grid {
    grid-template-columns: 1fr;
  }

  .join-controls {
    gap: 12px;
  }

  .room-item {
    align-items: flex-start;
  }
}

@media (prefers-color-scheme: dark) {
  .rooms-shell {
    color: #eef1f4;
  }

  .rooms-header {
    border-color: #3b4147;
  }

  .back-button,
  .control-field input,
  .room-item {
    color: #eef1f4;
    background: #25292d;
    border-color: #4b5259;
  }

  .rooms-header p,
  .control-field label,
  .room-copy p,
  .room-item-meta > span,
  .room-state {
    color: #aeb4ba;
  }

  .online-count {
    color: #c8cdd2;
    background: #373c42;
  }

  .room-state strong {
    color: #e1e4e7;
  }
}
</style>

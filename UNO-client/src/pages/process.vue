<template>
  <div class="process-shell">
    <button class="leave-button" type="button" @click="handleLeave">离开房间</button>
    <div class="process-layout">
      <div class="game-table">
        <enemy-area></enemy-area>
        <section class="discard-zone" aria-label="出牌堆">
          <span class="discard-label">出牌堆</span>
          <div class="discard-stack">
            <Card
              v-if="gameLastCard"
              class="discard-card"
              :card-id="gameLastCard.cardId"
              :type="gameLastCard.type"
              :color="gameLastCard.color"
              :icon="gameLastCard.icon"
              :order="0"
            />
            <div v-else class="discard-placeholder">等待首张牌</div>
            <span v-if="drawPenalty" class="draw-counter" aria-live="polite">+{{ drawPenalty }}</span>
          </div>
        </section>
        <CardArea w="100%" overflow="visible" @deal-card="handleDealCards"></CardArea>
        <transition name="uno-pop">
          <div v-if="unoAnnouncement" class="uno-announcement" role="status">
            <span>UNO!</span>
            <strong>{{ unoAnnouncement }} 喊了 UNO</strong>
          </div>
        </transition>
      </div>
      <aside class="game-log" aria-label="对战日志">
        <div class="log-header">
          <div>
            <span class="log-kicker">MATCH LOG</span>
            <h2>对战日志</h2>
          </div>
          <span class="log-count">{{ gameLogs.length }}</span>
        </div>
        <ol v-if="gameLogs.length" ref="logList" class="log-list">
          <li v-for="entry in gameLogs" :key="entry.id" class="log-entry">
            <time>{{ entry.time }}</time>
            <span>{{ entry.message }}</span>
          </li>
        </ol>
        <div v-else class="log-empty">等待玩家操作</div>
      </aside>
    </div>
  </div>
  <Teleport to="body">
    <div v-if="showColorPicker" fixed top-0 left-0 right-0 bottom-0 z-100 flex items-center justify-center bg="#00000066">
      <div class="card-prompt">
        <h2 class="prompt-title">选择颜色</h2>
        <p class="prompt-desc">{{ colorPromptDescription }}</p>
        <div class="prompt-color-grid">
          <label class="prompt-color-option" :class="{ active: selectColor === '#FF6666' }" :style="{ '--swatch': '#FF6666' }">
            <input type="radio" value="#FF6666" v-model="selectColor">
            <span class="prompt-swatch"></span>
            <span>红色</span>
          </label>
          <label class="prompt-color-option" :class="{ active: selectColor === '#FFCC33' }" :style="{ '--swatch': '#FFCC33' }">
            <input type="radio" value="#FFCC33" v-model="selectColor">
            <span class="prompt-swatch"></span>
            <span>黄色</span>
          </label>
          <label class="prompt-color-option" :class="{ active: selectColor === '#99CC66' }" :style="{ '--swatch': '#99CC66' }">
            <input type="radio" value="#99CC66" v-model="selectColor">
            <span class="prompt-swatch"></span>
            <span>绿色</span>
          </label>
          <label class="prompt-color-option" :class="{ active: selectColor === '#99CCFF' }" :style="{ '--swatch': '#99CCFF' }">
            <input type="radio" value="#99CCFF" v-model="selectColor">
            <span class="prompt-swatch"></span>
            <span>蓝色</span>
          </label>
        </div>
        <button class="prompt-btn" @click="confirmColor">确认颜色</button>
      </div>
    </div>
    <div v-if="showChallenge" fixed top-0 left-0 right-0 bottom-0 z-100 flex items-center justify-center bg="#00000066">
      <div w="70 sm:96" bg="white dark:black" b="4 dashed gray-300 rounded-4" p-4 text="gray-700 dark:gray-200">
        <h2 text="5" font-bold mb-3>+4 质疑</h2>
        <p mb-4>{{ challengeInfo.actorName }} 打出了 +4。质疑失败同样摸 4 张。</p>
        <div flex justify="evenly" gap-3>
          <button c-red-500 b="red-500 rounded-2 2" px-3 py-2 @click="resolveChallenge(true)">质疑</button>
          <button c-gray-600 b="gray-400 rounded-2 2" px-3 py-2 @click="resolveChallenge(false)">接受 +4</button>
        </div>
      </div>
    </div>
    <div v-if="showTargetPicker" fixed top-0 left-0 right-0 bottom-0 z-100 flex items-center justify-center bg="#00000066">
      <div class="card-prompt">
        <h2 class="prompt-title">指定目标牌</h2>
        <p class="prompt-desc">选择一名其他玩家作为目标。</p>
        <div class="prompt-option-list">
          <label v-for="target in targetOptions" :key="target.id" class="prompt-option" :class="{ active: selectedTargetId === target.id }">
            <input type="radio" :value="target.id" v-model="selectedTargetId">
            <span>{{ target.name }}</span>
          </label>
        </div>
        <button class="prompt-btn" @click="submitTarget">确认目标</button>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { useRoomStore } from '~/store/room';
import useSocketStore, { eventBus } from '~/store/socket';
import type { TargetPlayer } from '~/types/room';
import useUserStore from '~/store/user';
import Dialog from '~/plugins/dialog/Dialog';

const router = useRouter()

const socketStore = useSocketStore();
const roomStore = useRoomStore();
const userStore = useUserStore();

const gameLastCard = computed(() => roomStore.lastCard)
const drawPenalty = computed(() => roomStore.accumulation)

interface GameLogEntry {
  id: number
  time: string
  message: string
}

const gameLogs = ref<GameLogEntry[]>([])
const logList = ref<HTMLElement | null>(null)
const unoAnnouncement = ref('')
let logSequence = 0
let unoAnnouncementTimer: ReturnType<typeof setTimeout> | undefined

const addGameLog = (message: string) => {
  const text = message.trim()
  if (!text) return
  gameLogs.value = [
    ...gameLogs.value.slice(-39),
    {
      id: ++logSequence,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message: text
    }
  ]
  nextTick(() => {
    if (logList.value) logList.value.scrollTop = logList.value.scrollHeight
  })
}

const handleGameLog = ({ message, type }: { message?: string, type?: string }) => {
  if (!message || type === 'RES_CREATE_USER' || type === 'GAME_IS_START' || type === 'RES_START_AI_GAME' || message === '出牌成功') return
  const unoMatch = message.match(/^(?:玩家)?(.+?)\s*UNO!$/)
  if (unoMatch) {
    unoAnnouncement.value = unoMatch[1].trim()
    if (unoAnnouncementTimer) clearTimeout(unoAnnouncementTimer)
    unoAnnouncementTimer = setTimeout(() => {
      unoAnnouncement.value = ''
    }, 2600)
  }
  addGameLog(message)
}

const handleLeave = () => {
  Dialog({
    title: '离开房间',
    content: '是否确认？',
    comfirm: () => {
      socketStore.leaveGame(roomStore.roomCode, userStore.getUserInfo()).then(() => {
        roomStore.cleanRoom(router)
      })
    }
  })
}

const selectColor = ref<CardColor>('#FF6666')
const colorActionType = ref<'palette' | 'add-4' | 'target'>('palette')
const colorPromptDescription = computed(() => colorActionType.value === 'target'
  ? '选择目标玩家必须打出的颜色；没有该颜色或换色牌时将摸 4 张。'
  : colorActionType.value === 'add-4'
    ? '选择颜色后，下一位玩家可以接受或质疑。'
    : '挑一个新的出牌颜色。')
const showColorPicker = ref(false)
const showChallenge = ref(false)
const challengeInfo = ref({ actorName: '', color: '#FF6666' as CardColor, penalty: 4, challengePenalty: 4 })
const showTargetPicker = ref(false)
const targetOptions = ref<TargetPlayer[]>([])
const selectedTargetId = ref('')
let bombColorTimer: ReturnType<typeof setInterval> | undefined
let bombColorFinishTimer: ReturnType<typeof setTimeout> | undefined
const submitColor = () => {
  socketStore.submitColor(selectColor.value, roomStore.roomCode);
  selectColor.value = '#FF6666'
}

const confirmColor = () => {
  submitColor()
  showColorPicker.value = false
}

const handleDealCards = (cardsIndex: Set<number>) => {
  socketStore.outOfCard(Array.from(cardsIndex), roomStore.roomCode).then((data) => {
    if (data) {
      roomStore.setUserCards(data)
      roomStore.clearSelectCards()
    }
  })
}

const resolveChallenge = (challenge: boolean) => {
  socketStore.challengeAdd4(challenge, roomStore.roomCode)
  showChallenge.value = false
}

const submitTarget = () => {
  if (!selectedTargetId.value) return
  socketStore.submitTarget(selectedTargetId.value, roomStore.roomCode)
  showTargetPicker.value = false
  selectedTargetId.value = ''
}

onBeforeMount(() => {
  addGameLog('牌局记录已开始')
  eventBus.on('GAME_LOG', handleGameLog)
  eventBus.on('NEXT_TURN', ({ lastCard, order, players, accumulation, pendingAction }) => {
    roomStore.setRoomInfoProp<'lastCard'>('lastCard', lastCard);
    roomStore.setRoomInfoProp<'order'>('order', order);
    roomStore.setRoomInfoProp<'players'>('players', players);
    roomStore.setRoomInfoProp<'accumulation'>('accumulation', accumulation);
    roomStore.setRoomInfoProp<'pendingAction'>('pendingAction', pendingAction);
  })
  eventBus.on('GAME_IS_OVER', ({ winnerOrder, endTime, players, owner, canReplay }) => {
    roomStore.setRoomInfoProp<'winnerOrder'>('winnerOrder', winnerOrder);
    roomStore.setRoomInfoProp<'endTime'>('endTime', endTime);
    if (canReplay) {
      // 真人房:回到房间,可再来一局
      roomStore.setRoomInfoProp<'status'>('status', 'WAITING');
      if (players) roomStore.updatePlayers(players);
      if (owner) roomStore.setRoomInfoProp<'owner'>('owner', owner);
      roomStore.setUserCards([]);
      roomStore.clearSelectCards();
      router.push('/wait');
    } else {
      // 人机房:保留独立结算页
      router.push('/end');
    }
  })
  eventBus.on('SELECT_COLOR', ({ cardType }) => {
    colorActionType.value = cardType
    showColorPicker.value = true;
  })
  eventBus.on('CHALLENGE_AVAILABLE', (data) => {
    challengeInfo.value = data
    showChallenge.value = true
  })
  eventBus.on('SELECT_TARGET', ({ targets }) => {
    targetOptions.value = targets
    selectedTargetId.value = ''
    showTargetPicker.value = true
  })
  eventBus.on('COLOR_IS_CHANGE', (data) => {
    if (roomStore.lastCard) {
      roomStore.setRoomInfoProp<'lastCard'>('lastCard', Object.assign(roomStore.lastCard, { color: data }));
    }
  })
  eventBus.on('BOMB_COLOR_ROLL', ({ finalColor }) => {
    const colors: CardColor[] = ['#FF6666', '#FFCC33', '#99CC66', '#99CCFF']
    let index = 0
    if (bombColorTimer) clearInterval(bombColorTimer)
    if (bombColorFinishTimer) clearTimeout(bombColorFinishTimer)
    bombColorTimer = setInterval(() => {
      if (roomStore.lastCard) roomStore.lastCard.color = colors[index++ % colors.length]
    }, 110)
    bombColorFinishTimer = setTimeout(() => {
      if (bombColorTimer) clearInterval(bombColorTimer)
      bombColorTimer = undefined
      if (roomStore.lastCard) roomStore.lastCard.color = finalColor
    }, 1320)
  })
  eventBus.on('RES_DEAL_CARDS', (data) => {
    roomStore.setUserCards(data)
  })
  eventBus.on('CHANGE_UNO_STATUS', (data) => {
    roomStore.changePlayerUNOStatus(data)
  })
})

onBeforeUnmount(() => {
  if (unoAnnouncementTimer) clearTimeout(unoAnnouncementTimer)
  if (bombColorTimer) clearInterval(bombColorTimer)
  if (bombColorFinishTimer) clearTimeout(bombColorFinishTimer)
  eventBus.removeAllListeners('GAME_LOG')
  eventBus.removeAllListeners('NEXT_TURN')
  eventBus.removeAllListeners('GAME_IS_OVER')
  eventBus.removeAllListeners('UPDATE_PLAYER_LIST');
  eventBus.removeAllListeners('SELECT_COLOR');
  eventBus.removeAllListeners('COLOR_IS_CHANGE');
  eventBus.removeAllListeners('CHALLENGE_AVAILABLE');
  eventBus.removeAllListeners('SELECT_TARGET');
  eventBus.removeAllListeners('BOMB_COLOR_ROLL');
  eventBus.removeAllListeners('DEAL_CARDS');
  eventBus.removeAllListeners('CHANGE_UNO_STATUS');
})

</script>

<style scoped>
.process-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 14px 12px 12px;
}

.process-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 248px;
  gap: 18px;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding-top: 56px;
}

.leave-button {
  position: absolute;
  z-index: 5;
  top: 14px;
  left: 12px;
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

.leave-button:hover {
  color: #a63d42;
  background: #fff7f7;
  border-color: #c64b4e;
}

.game-table {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: clamp(28px, 5vh, 48px);
  box-sizing: border-box;
  padding: 4px 0 18px;
  overflow: hidden;
}

.uno-announcement {
  position: absolute;
  z-index: 20;
  top: 47%;
  left: 50%;
  display: flex;
  width: min(86%, 360px);
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 15px 20px 14px;
  box-sizing: border-box;
  color: #24272b;
  text-align: center;
  background: rgba(255, 255, 255, 0.97);
  border: 3px solid #e4ad2e;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(28, 32, 37, 0.22);
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.uno-announcement span {
  color: #c64b4e;
  font-size: 30px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 1px;
}

.uno-announcement strong {
  font-size: 14px;
  line-height: 1.3;
}

.uno-pop-enter-active,
.uno-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.uno-pop-enter-from,
.uno-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.86);
}

.game-log {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  box-sizing: border-box;
  padding: 16px 14px 12px;
  color: #2b2f34;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #d6dade;
  border-radius: 8px;
  box-shadow: 0 7px 20px rgba(28, 32, 37, 0.08);
}

.log-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e5e8;
}

.log-kicker {
  color: #858b92;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
}

.log-header h2 {
  margin: 5px 0 0;
  font-size: 18px;
  line-height: 1;
}

.log-count {
  display: inline-flex;
  min-width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  color: #737a81;
  font-size: 12px;
  background: #f0f2f4;
  border-radius: 50%;
}

.log-list {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 9px;
  overflow-y: auto;
  margin: 12px 0 0;
  padding: 0 3px 4px 0;
  list-style: none;
  scrollbar-width: thin;
}

.log-entry {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 7px;
  align-items: start;
  padding-bottom: 9px;
  color: #464c53;
  font-size: 12px;
  line-height: 1.45;
  border-bottom: 1px solid #eef0f2;
}

.log-entry time {
  color: #9a9fa5;
  font-size: 10px;
  line-height: 1.6;
  font-variant-numeric: tabular-nums;
}

.log-entry span {
  overflow-wrap: anywhere;
}

.log-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: #989ea4;
  font-size: 13px;
}

.discard-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.discard-label {
  color: #737980;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.discard-stack {
  position: relative;
  width: 84px;
  height: 108px;
  flex: none;
}

.draw-counter {
  position: absolute;
  z-index: 4;
  top: -10px;
  right: -20px;
  display: inline-flex;
  min-width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0 8px;
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  background: #c64b4e;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 5px 14px rgba(78, 22, 25, 0.28);
}

.discard-stack::before,
.discard-stack::after {
  position: absolute;
  top: 4px;
  left: 8px;
  width: 62px;
  height: 88px;
  box-sizing: border-box;
  content: '';
  background: #fff;
  border: 2px solid #d7dbe0;
  border-radius: 9px;
  box-shadow: 0 3px 8px rgba(28, 32, 37, 0.12);
}

.discard-stack::before {
  transform: translate(-5px, 7px) rotate(-5deg);
}

.discard-stack::after {
  transform: translate(5px, 5px) rotate(4deg);
}

:deep(.discard-card) {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 11px;
  width: 62px;
  height: 88px;
  cursor: default;
  filter: none;
}

.discard-placeholder {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62px;
  height: 88px;
  box-sizing: border-box;
  color: #7b8189;
  font-size: 12px;
  background: #f7f8f9;
  border: 2px dashed #bcc2c9;
  border-radius: 9px;
}

@media (min-width: 640px) {
  .discard-stack {
    width: 100px;
    height: 128px;
  }

  .discard-stack::before,
  .discard-stack::after {
    left: 10px;
    width: 76px;
    height: 108px;
  }

  :deep(.discard-card) {
    left: 12px;
    width: 76px;
    height: 108px;
  }

  .discard-placeholder {
    left: 12px;
    width: 76px;
    height: 108px;
  }
}

@media (prefers-color-scheme: dark) {
  .leave-button {
    color: #d3d7db;
    background: rgba(30, 33, 37, 0.94);
    border-color: #596068;
  }

  .leave-button:hover {
    color: #ffb4b7;
    background: #352529;
    border-color: #dc676a;
  }

  .game-log {
    color: #eef1f4;
    background: rgba(27, 30, 35, 0.94);
    border-color: #484d53;
  }

  .log-header {
    border-bottom-color: #3b4147;
  }

  .log-count {
    color: #c1c6cb;
    background: #373c42;
  }

  .log-entry {
    color: #d2d6da;
    border-bottom-color: #353a3f;
  }

  .log-entry time,
  .log-empty,
  .log-kicker {
    color: #9ca3aa;
  }

  .discard-label,
  .discard-placeholder {
    color: #b3b9c1;
  }

  .discard-placeholder {
    background: #25292d;
    border-color: #596068;
  }

  .discard-stack::before,
  .discard-stack::after {
    background: #33383d;
    border-color: #5b6269;
  }
}

@media (max-width: 900px) {
  .process-shell {
    height: auto;
    min-height: 100%;
    padding: 12px 8px 18px;
  }

  .process-layout {
    display: flex;
    height: auto;
    flex-direction: column;
    gap: 22px;
    padding-top: 52px;
  }

  .game-table {
    height: auto;
    min-height: 0;
  }

  .game-log {
    width: 100%;
    height: 190px;
    flex: none;
  }
}

/* 描边提示框 —— 换色 / 炸弹 共用 */
.card-prompt {
  width: min(90vw, 320px);
  box-sizing: border-box;
  padding: 20px 20px 18px;
  color: #1f2328;
  text-align: center;
  background: #ffffff;
  border: 2px solid #1f2328;
  border-radius: 16px;
  box-shadow: 0 12px 34px -14px rgba(17, 20, 24, 0.4);
}

.prompt-title {
  margin: 0 0 6px;
  color: #1f2328;
  font-size: 16px;
  font-weight: 700;
}

.prompt-desc {
  margin: 0 0 16px;
  color: #6b7280;
  font-size: 13px;
}

.prompt-color-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.prompt-color-option,
.prompt-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: #ffffff;
  border: 2px solid #d4d8dd;
  border-radius: 11px;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.prompt-color-option {
  justify-content: center;
  padding: 9px 8px;
}

.prompt-color-option:hover,
.prompt-option:hover {
  border-color: #9aa0a8;
  background: #f9fafb;
}

.prompt-color-option input,
.prompt-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.prompt-swatch {
  width: 16px;
  height: 16px;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 50%;
  background: var(--swatch);
}

.prompt-color-option.active,
.prompt-option.active {
  border-color: #1f2328;
  background: #f3f4f6;
}

.prompt-option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.prompt-option {
  padding: 10px 14px;
}

.prompt-btn {
  width: 100%;
  margin-top: 2px;
  padding: 9px 16px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: #1f2328;
  border: 2px solid #1f2328;
  border-radius: 10px;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.prompt-btn:hover {
  background: #33383f;
  border-color: #33383f;
}

html.dark .card-prompt {
  color: #f0f0f2;
  background: #1c1c1e;
  border-color: #55555f;
  box-shadow: 0 12px 34px -14px rgba(0, 0, 0, 0.65);
}

html.dark .prompt-title {
  color: #f0f0f2;
}

html.dark .prompt-desc {
  color: #9ca3af;
}

html.dark .prompt-color-option,
html.dark .prompt-option {
  color: #d4d4d8;
  background: #1c1c1e;
  border-color: #4a4a52;
}

html.dark .prompt-color-option:hover,
html.dark .prompt-option:hover {
  border-color: #6b6b74;
  background: #26262b;
}

html.dark .prompt-color-option.active,
html.dark .prompt-option.active {
  border-color: #e5e7eb;
  background: #26262b;
}

html.dark .prompt-btn {
  color: #1c1c1e;
  background: #f3f4f6;
  border-color: #f3f4f6;
}

html.dark .prompt-btn:hover {
  background: #e2e3e6;
  border-color: #e2e3e6;
}
</style>

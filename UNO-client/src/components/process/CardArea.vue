<template>
  <div class="hand-area">
    <div class="hand-stage" ref="cardArea">
      <Card class="hand-card" v-for="(card, i) in cards" flex="none" :card-id="card.cardId" :style="{
        position: 'absolute',
        top: '32px',
        left: '50%',
        zIndex: hoverIndex === i ? 1000 : isActive(i) ? 900 + i : i,
        transform: `translateX(calc(-50% + ${card.offset + cardShift(i)}px)) translateY(${cardLift(i)}px) rotate(${cardRotate(card, i)}deg) scale(${cardScale(i)})`,
        transformOrigin: '50% 100%'
      }" :key="card.cardId" :type="card.type" :color="card.color" :icon="card.icon" :order="i"
        @mouseenter="hoverIndex = i" @mouseleave="hoverIndex = -1"
        @click="handleClickCard(card, i)">
      </Card>
    </div>
    <div class="hand-actions">
      <button v-show="isInTurn" c-gray text="3.5" b="gray rounded-10 3 dashed hover:transparent"
        transition="duration-400" hover="bg-gray text-white" px-3 py-1 @click="handleDealCards">出牌</button>
      <button v-show="isInTurn" :disabled="isDrawing" c-gray text="3.5" b="gray rounded-10 3 dashed hover:transparent"
        transition="duration-400" hover="bg-gray text-white" px-3 py-1 @click="handleGetCard">{{ isDrawing ? '取牌中...' : drawPenalty ? `接受 +${drawPenalty}` : '取牌' }}</button>
      <button c-red-500 text="3.5" b="red-500 rounded-10 3 dashed hover:transparent" transition="duration-400"
        hover="bg-red-500 text-white" px-3 py-1 @click="handleUNO">UNO</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoomStore } from '~/store/room';
import { isInTurn, useCheckCard, useNotify } from '~/composables';
import useSocketStore from '~/store/socket';
import Dialog from '~/plugins/dialog/Dialog';
const emit = defineEmits(['dealCard'])
const socketStore = useSocketStore()
const roomStore = useRoomStore();
const cardArea = ref<HTMLElement>();
const hoverIndex = ref(-1)
const cardAreaWidth = ref(720)
const isDrawing = ref(false)
const drawPenalty = computed(() => {
  if (roomStore.accumulation) return roomStore.accumulation
  const pending = roomStore.pendingAction
  return pending?.kind === 'FORCED_COLOR' ? pending.penalty : 0
})
// 双击判定:同一张牌在 300ms 内再次点击视为双击
let lastClickIndex = -1
let lastClickAt = 0
let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  const updateCardAreaWidth = () => {
    cardAreaWidth.value = cardArea.value?.clientWidth || 720
  }

  updateCardAreaWidth()
  if (cardArea.value) {
    resizeObserver = new ResizeObserver(updateCardAreaWidth)
    resizeObserver.observe(cardArea.value)
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())

const cards = computed(() => {
  const count = roomStore.userCards.length
  const availableWidth = Math.min(Math.max(cardAreaWidth.value - 84, 0), 560)
  const step = count > 1 ? Math.min(56, availableWidth / (count - 1)) : 0
  const rotateStep = count > 1 ? Math.min(3, 20 / (count - 1)) : 0
  return roomStore.userCards.map((item, index) => {
    return {
      offset: (index - (count - 1) / 2) * step,
      rotate: (index - (count - 1) / 2) * rotateStep,
      ...item,
    }
  })
})
const selectList = computed(() => roomStore.selectCards)

const isActive = computed(() => {
  return (i: number) => {
    return roomStore.selectCards.has(i);
  }
})

const cardLift = (i: number) => {
  if (roomStore.selectCards.has(i)) return -40
  return hoverIndex.value === i ? -48 : 0
}

const cardScale = (i: number) => hoverIndex.value === i ? 1.07 : 1

// 悬停/选中的牌扶正竖直,不再跟着扇形倾斜,抽出来更清爽
const cardRotate = (card: { rotate: number }, i: number) => {
  if (hoverIndex.value === i || roomStore.selectCards.has(i)) return 0
  return card.rotate
}

// 悬停时,两侧邻牌向外让开一个缺口,让抽出的牌明显跟邻牌分离
const cardShift = (i: number) => {
  if (hoverIndex.value < 0 || hoverIndex.value === i) return 0
  const dir = i < hoverIndex.value ? -1 : 1
  const dist = Math.abs(i - hoverIndex.value)
  return dir * Math.max(0, 16 - (dist - 1) * 7)
}

// 双击某张牌 —— 直接打出这一张
const handleQuickPlay = (card: CardInfo, i: number) => {
  if (!isInTurn.value) {
    useNotify('不在出牌阶段')
    return
  }
  if (!useCheckCard(card)) {
    useNotify('该牌不能出')
    return
  }
  roomStore.clearSelectCards()
  emit('dealCard', [i])
}

const handleClickCard = (card: CardInfo, i: number) => {
  if (i === lastClickIndex && Date.now() - lastClickAt < 300) {
    lastClickIndex = -1
    lastClickAt = 0
    handleQuickPlay(card, i)
    return
  }
  lastClickIndex = i
  lastClickAt = Date.now()

  if (!isInTurn.value) {
    useNotify('不在出牌阶段')
    if (roomStore.selectCards.has(i)) {
      roomStore.unSelectCard(i)
    }
    return;
  }
  if (!useCheckCard(card)) {
    useNotify('该牌不能出')
    if (roomStore.selectCards.has(i)) {
      roomStore.unSelectCard(i)
    }
    return;
  }
  if (!roomStore.selectCards.has(i) && roomStore.selectCards.size > 0) {
    const firstIndex = Array.from(roomStore.selectCards)[0]
    const firstCard = roomStore.userCards[firstIndex]
    if (!firstCard?.type.startsWith('number-') || firstCard.type !== card.type) {
      useNotify('多牌连出必须选择相同点数的数字牌')
      return
    }
  }
  if (roomStore.selectCards.has(i)) {
    roomStore.unSelectCard(i)
  } else {
    roomStore.selectCard(i)
  }
}

const handleDealCards = () => {
  if (selectList.value.size === 0) {
    useNotify('请选择要出的牌');
    return;
  }
  emit('dealCard', Array.from(selectList.value));
}

const handleGetCard = () => {
  if (isDrawing.value) return
  isDrawing.value = true
  socketStore.getOneCard(roomStore.roomCode).then((data) => {
    if (data) {
      const { card, userCards, penaltyResolved } = data;
      roomStore.setUserCards(userCards);
      if (penaltyResolved) return;
      if (useCheckCard(card)) {
        Dialog({
          title: '获得的牌符合规则',
          content: '是否打出此牌？',
          comfirm: (close) => {
            const idx = roomStore.userCards.findIndex(c => c.type === card.type && c.color === card.color)
            socketStore.outOfCard([idx], roomStore.roomCode).then((data) => {
              if (data) {
                roomStore.setUserCards(data)
              }
              close()
            })
          },
          cancel: (close) => {
            socketStore.toNextTurn(roomStore.roomCode);
            close()
          }
        })
      } else {
        socketStore.toNextTurn(roomStore.roomCode)
      }
    }
  }).catch(() => {
    useNotify('取牌失败，连接已断开')
  }).finally(() => {
    isDrawing.value = false
  })
}

const handleUNO = () => {
  socketStore.uno(roomStore.roomCode)
}

</script>

<style scoped>
.hand-area {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.hand-stage {
  position: relative;
  width: 100%;
  height: 148px;
  max-width: 760px;
  margin: 0 auto;
}

.hand-actions {
  display: flex;
  width: min(100%, 720px);
  min-height: 36px;
  align-items: center;
  justify-content: space-evenly;
  gap: 8px;
}

:deep(.hand-card) {
  cursor: pointer;
  user-select: none;
  transition: transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease;
  will-change: transform;
}

@media (max-width: 639px) {
  .hand-area {
    gap: 14px;
  }

  .hand-stage {
    height: 124px;
  }

  .hand-actions {
    min-height: 34px;
  }
}
</style>

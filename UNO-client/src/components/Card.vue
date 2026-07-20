<script setup lang="ts">
import { useCheckCard } from '~/composables';

type zeroToNine = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
type cardColor = '#FF6666' | '#99CC66' | '#99CCFF' | '#FFCC33'

type CardNumberType<T extends number> = `number-${T}`;
type CardOtherType = 'add-2' | 'add-4' | 'exchange' | 'palette' | 'ban' | 'target' | 'bomb'

interface CardProps {
  cardId: number,
  icon: string,
  type: CardNumberType<zeroToNine> | CardOtherType
  color: cardColor | string,
  order: number
}

const props = defineProps<CardProps>()
const bgColor = computed(() => `${props.color}`)
const canSelect = computed(() => useCheckCard(props))
const isNumberCard = computed(() => props.type.startsWith('number-'))
const numberLabel = computed(() => isNumberCard.value ? props.type.slice(7) : '')
const cardLabel = computed(() => {
  switch (props.type) {
    case 'add-2': return '+2'
    case 'add-4': return '+4'
    case 'exchange': return '↔'
    case 'ban': return '跳'
    case 'palette': return '换色'
    case 'target': return '目标'
    case 'bomb': return '炸弹'
    default: return ''
  }
})
const isLongLabel = computed(() => cardLabel.value.length > 2)
const accessibleLabel = computed(() => isNumberCard.value ? `数字 ${numberLabel.value}` : cardLabel.value)
</script>

<template>
  <div
    class="container"
    :class="{ disabled: !canSelect }"
    :style="{ backgroundColor: bgColor }"
    :aria-label="accessibleLabel"
    relative
    justify-between
  >
    <span class="card-corner card-corner-top">{{ isNumberCard ? numberLabel : cardLabel }}</span>
    <div class="card-face">
      <span v-if="isNumberCard" class="card-number">{{ numberLabel }}</span>
      <span v-else class="card-action" :class="{ 'action-label-long': isLongLabel }">{{ cardLabel }}</span>
    </div>
    <span class="card-corner card-corner-bottom">{{ isNumberCard ? numberLabel : cardLabel }}</span>
  </div>
</template>

<style scoped>
.container {
  width: 62px;
  height: 88px;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.96);
  border-radius: 9px;
  box-shadow: 0 4px 10px rgba(30, 34, 40, 0.2);
  color: #fff;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
  text-shadow: 0 1px 2px rgba(40, 40, 40, 0.16);
  transition: filter 0.18s, box-shadow 0.18s;
}

.container.disabled {
  filter: grayscale(0.72) brightness(0.88);
}

.card-face {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.card-number {
  font-size: 38px;
  font-weight: 800;
  line-height: 1;
}

.card-action {
  font-size: 23px;
  font-weight: 800;
  line-height: 1;
  text-align: center;
}

.action-label-long {
  font-size: 15px;
}

.card-corner {
  position: absolute;
  z-index: 1;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.card-corner-top { top: 7px; left: 8px; }
.card-corner-bottom { right: 8px; bottom: 7px; transform: rotate(180deg); }

@media (min-width: 640px) {
  .container {
    width: 76px;
    height: 108px;
  }

  .card-number { font-size: 46px; }
  .card-action { font-size: 27px; }
  .action-label-long { font-size: 17px; }
  .card-corner { font-size: 11px; }
}
</style>

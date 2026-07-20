<template>
  <div
    class="player-summary"
    :class="{ active: inOrder }"
    :aria-current="inOrder ? 'true' : undefined"
  >
    <img class="player-avatar" :src="avatarSrc" alt="" />
    <div class="player-copy">
      <strong>{{ name }}</strong>
      <span>{{ cardNum }} 张牌</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { generateFromString } from 'generate-avatar'
import { useRoomStore } from '~/store/room';
export interface PlayerProps {
  id: string,
  name: string,
  cardNum: number,
  avatar?: string
}

const props = withDefaults(defineProps<PlayerProps>(), {
  name: '无玩家',
  id: '-1',
  cardNum: 0,
  avatar: ''
})

const roomStore = useRoomStore()

const avatarSrc = computed(() => props.avatar || `data:image/svg+xml;utf8,${generateFromString(props.id + props.name)}`)
const inOrder = computed(() => {
  const idx = roomStore.players.findIndex(p => p.id === props.id && p.name === props.name)
  return idx === roomStore.order
})
</script>

<style scoped>
.player-summary {
  display: flex;
  align-items: center;
  width: 154px;
  height: 62px;
  padding: 8px 10px;
  box-sizing: border-box;
  color: #545a61;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid #d9dde1;
  border-radius: 8px;
  box-shadow: 0 3px 10px rgba(28, 32, 37, 0.08);
  transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.player-summary.active {
  color: #24272b;
  background: #fff9e8;
  border-color: #e4ad2e;
  box-shadow: 0 0 0 3px rgba(228, 173, 46, 0.18), 0 5px 14px rgba(28, 32, 37, 0.12);
}

.player-avatar {
  width: 42px;
  height: 42px;
  flex: none;
  object-fit: cover;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(28, 32, 37, 0.16);
}

.player-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  margin-left: 10px;
  line-height: 1.25;
}

.player-copy strong {
  max-width: 84px;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-copy span {
  margin-top: 4px;
  color: #777d84;
  font-size: 12px;
}

@media (max-width: 639px) {
  .player-summary {
    width: 138px;
    height: 56px;
    padding: 7px 8px;
  }

  .player-avatar {
    width: 38px;
    height: 38px;
  }

  .player-copy {
    margin-left: 8px;
  }

  .player-copy strong {
    max-width: 75px;
    font-size: 13px;
  }
}

@media (prefers-color-scheme: dark) {
  .player-summary {
    color: #d6d9dd;
    background: rgba(30, 33, 37, 0.94);
    border-color: #484d53;
  }

  .player-summary.active {
    color: #fff;
    background: #3b3420;
    border-color: #e4ad2e;
  }

  .player-copy span {
    color: #aeb3b9;
  }
}
</style>

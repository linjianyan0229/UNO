<template>
  <div class="players-scroll">
    <div class="players-list">
      <EnemyPlayer
        v-for="player in players"
        :key="player.id + player.name"
        :name="player.name"
        :id="player.id"
        :card-num="player.cards?.length"
        :avatar="player.avatar"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoomStore } from '~/store/room';

const roomStore = useRoomStore()
const players = computed(() => roomStore?.players || [])
</script>

<style scoped>
.players-scroll {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.players-scroll::-webkit-scrollbar {
  display: none;
}

.players-list {
  display: flex;
  align-items: center;
  justify-content: center;
  width: max-content;
  min-width: 100%;
  gap: 12px;
  box-sizing: border-box;
  padding: 4px 10px;
}

@media (max-width: 639px) {
  .players-list {
    gap: 8px;
    padding-inline: 6px;
  }
}
</style>

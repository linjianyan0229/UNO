<template>
  <div v-if="visible" class="dialog-mask">
    <div class="dialog-card" :class="{ dark: isDark }">
      <button class="dialog-close" type="button" aria-label="关闭" @click="handleClose">✕</button>
      <div class="dialog-head">
        <slot name="title">
          <h1 class="dialog-title">{{ title }}</h1>
        </slot>
      </div>
      <div class="dialog-body">
        <slot>
          <p class="dialog-content">{{ content }}</p>
        </slot>
      </div>
      <div class="dialog-foot">
        <button class="dialog-btn dialog-btn-primary" type="button" @click="handleConfirm">
          确认
        </button>
        <button v-if="showCancel" class="dialog-btn dialog-btn-ghost" type="button" @click="handleCancel">
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isDark } from '~/composables'

interface DialogProps {
  title?: string;
  visible?: boolean;
  content?: string;
  showCancel?:boolean
}

const emit = defineEmits(['close', 'open', 'confirm', 'cancel'])

withDefaults(defineProps<DialogProps>(), {
  title: '',
  content: '',
  visible:true,
  showCancel: true
})

const handleClose = () => {
  emit('close')
}

const handleConfirm = () => {
  emit('confirm')
  emit('close')
}

const handleCancel = () => {
  emit('cancel')
  emit('close')
}
</script>

<style scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 99;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(17, 20, 24, 0.32);
}

.dialog-card {
  position: relative;
  display: flex;
  width: min(90vw, 320px);
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  color: #1f2328;
  background: #ffffff;
  border: 2px solid #1f2328;
  border-radius: 16px;
  box-shadow: 0 12px 34px -14px rgba(17, 20, 24, 0.4);
}

.dialog-close {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 24px;
  height: 24px;
  color: #9ca3af;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.dialog-close:hover {
  color: #4b5563;
  background: #f3f4f6;
}

.dialog-head {
  padding: 16px 18px 10px;
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.dialog-body {
  padding: 2px 18px 16px;
  color: #4b5563;
  font-size: 14px;
  line-height: 1.5;
}

.dialog-content {
  margin: 0;
}

.dialog-foot {
  display: flex;
  gap: 10px;
  padding: 12px 18px 16px;
  border-top: 1px solid #eef0f2;
}

.dialog-btn {
  flex: 1;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: 10px;
  transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
}

.dialog-btn-primary {
  color: #ffffff;
  background: #1f2328;
  border-color: #1f2328;
}

.dialog-btn-primary:hover {
  background: #33383f;
  border-color: #33383f;
}

.dialog-btn-ghost {
  color: #1f2328;
  background: #ffffff;
  border-color: #1f2328;
}

.dialog-btn-ghost:hover {
  background: #f3f4f6;
  border-color: #1f2328;
}

/* 深色模式 */
.dialog-card.dark {
  color: #f0f0f2;
  background: #1c1c1e;
  border-color: #55555f;
  box-shadow: 0 12px 34px -14px rgba(0, 0, 0, 0.65);
}

.dialog-card.dark .dialog-body {
  color: #a1a1aa;
}

.dialog-card.dark .dialog-foot {
  border-top-color: #2a2a2e;
}

.dialog-card.dark .dialog-close {
  color: #71717a;
}

.dialog-card.dark .dialog-close:hover {
  color: #d4d4d8;
  background: #26262b;
}

.dialog-card.dark .dialog-btn-primary {
  color: #1c1c1e;
  background: #f3f4f6;
  border-color: #f3f4f6;
}

.dialog-card.dark .dialog-btn-primary:hover {
  background: #e2e3e6;
  border-color: #e2e3e6;
}

.dialog-card.dark .dialog-btn-ghost {
  color: #f0f0f2;
  background: #1c1c1e;
  border-color: #55555f;
}

.dialog-card.dark .dialog-btn-ghost:hover {
  background: #26262b;
  border-color: #6b6b74;
}
</style>

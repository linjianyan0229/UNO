<template>
  <div class="auth-shell">
    <div class="auth-brand" aria-hidden="true">
      <div class="logo-tile logo-tile-red">U</div>
      <div class="logo-tile logo-tile-blue">N</div>
      <div class="logo-tile logo-tile-yellow">O</div>
    </div>

    <div class="auth-card">
      <div class="auth-tabs">
        <button type="button" :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button type="button" :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
      </div>

      <p class="auth-desc">{{ mode === 'login' ? '登录你的账号，快速进入牌局' : '注册一个唯一用户名，头像和昵称随时可改' }}</p>

      <div class="field">
        <label for="auth-name">用户名</label>
        <input id="auth-name" v-model="name" maxlength="16" placeholder="1-16 个字符" autocomplete="username"
          @keyup.enter="submit" />
      </div>

      <div class="field">
        <label for="auth-pass">密码</label>
        <input id="auth-pass" v-model="password" type="password" maxlength="32" placeholder="至少 4 位"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" @keyup.enter="submit" />
      </div>

      <button class="auth-submit" :disabled="submitting" @click="submit">
        {{ submitting ? '请稍候...' : (mode === 'login' ? '登录' : '注册并登录') }}
      </button>

      <p class="auth-switch">
        {{ mode === 'login' ? '还没有账号？' : '已有账号？' }}
        <button type="button" @click="mode = mode === 'login' ? 'register' : 'login'">
          {{ mode === 'login' ? '去注册' : '去登录' }}
        </button>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import useSocketStore from '~/store/socket'
import useUserStore from '~/store/user'
import { useNotify } from '~/composables'

const router = useRouter()
const route = useRoute()
const socketStore = useSocketStore()
const userStore = useUserStore()

const mode = ref<'login' | 'register'>('login')
const name = ref('')
const password = ref('')
const submitting = ref(false)

const submit = async () => {
  if (submitting.value) return
  const n = name.value.trim()
  if (n.length < 1 || n.length > 16) return useNotify('用户名需为 1-16 个字符')
  if (password.value.length < 4) return useNotify('密码至少 4 位')

  submitting.value = true
  try {
    const profile = mode.value === 'login'
      ? await socketStore.login(n, password.value)
      : await socketStore.register(n, password.value)
    if (!profile) return // 失败信息已由服务端消息提示
    userStore.setProfile(profile)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.auth-shell {
  display: flex;
  width: min(100%, 420px);
  flex-direction: column;
  align-items: center;
  gap: 22px;
  color: #24272b;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.auth-brand {
  display: flex;
  height: 64px;
  align-items: center;
  justify-content: center;
}

.logo-tile {
  width: 44px;
  height: 58px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid #fff;
  border-radius: 8px;
  box-sizing: border-box;
  color: #fff;
  font-size: 24px;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(28, 32, 38, 0.14);
}

.logo-tile + .logo-tile { margin-left: -10px; }
.logo-tile-red { background: #e76464; transform: rotate(-10deg); }
.logo-tile-blue { background: #5c9fc5; transform: translateY(-4px) rotate(2deg); }
.logo-tile-yellow { background: #d5a92f; transform: rotate(10deg); }

.auth-card {
  width: 100%;
  box-sizing: border-box;
  padding: 22px 24px 24px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #dadde1;
  border-radius: 14px;
  box-shadow: 0 18px 44px rgba(28, 32, 37, 0.08);
}

.auth-tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  margin-bottom: 14px;
  background: #f1f3f4;
  border-radius: 10px;
}

.auth-tabs button {
  flex: 1;
  padding: 9px 0;
  color: #6b7178;
  font-size: 14px;
  font-weight: 700;
  background: transparent;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.auth-tabs button.active {
  color: #c64b4e;
  background: #fff;
  box-shadow: 0 1px 4px rgba(28, 32, 37, 0.12);
}

.auth-desc {
  margin: 0 0 16px;
  color: #757c83;
  font-size: 13px;
  text-align: center;
}

.field { margin-bottom: 14px; }

.field label {
  display: block;
  margin-bottom: 7px;
  color: #535961;
  font-size: 13px;
  font-weight: 700;
}

.field input {
  width: 100%;
  height: 42px;
  box-sizing: border-box;
  padding: 0 12px;
  color: #25292e;
  font: inherit;
  font-size: 14px;
  background: #fff;
  border: 1px solid #d5d9dd;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.field input:focus {
  border-color: #c64b4e;
  box-shadow: 0 0 0 3px rgba(198, 75, 78, 0.12);
}

.auth-submit {
  width: 100%;
  height: 44px;
  margin-top: 4px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  background: #c64b4e;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.18s, opacity 0.18s;
}

.auth-submit:hover { background: #b13f42; }
.auth-submit:disabled { cursor: wait; opacity: 0.6; }

.auth-switch {
  margin: 14px 0 0;
  color: #868c93;
  font-size: 12px;
  text-align: center;
}

.auth-switch button {
  color: #c64b4e;
  font-size: 12px;
  font-weight: 700;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.dark .auth-shell { color: #eef1f4; }

.dark .auth-card {
  background: rgba(27, 29, 32, 0.92);
  border-color: #3d4247;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.3);
}

.dark .auth-tabs { background: #2a2e33; }
.dark .auth-tabs button { color: #b4bac0; }
.dark .auth-tabs button.active { color: #ff8a8d; background: #1f2226; }
.dark .auth-desc { color: #9ca3aa; }
.dark .field label { color: #cfd4d9; }

.dark .field input {
  color: #eef1f4;
  background: #202327;
  border-color: #41464b;
}

.dark .field input:focus {
  border-color: #dc676a;
  box-shadow: 0 0 0 3px rgba(220, 103, 106, 0.16);
}

.dark .auth-switch { color: #9ca3aa; }
</style>

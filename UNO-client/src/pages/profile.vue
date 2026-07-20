<template>
  <div class="profile-shell">
    <header class="profile-head">
      <button class="link-back" type="button" @click="router.push('/')">返回首页</button>
      <h1>个人资料</h1>
      <button class="link-logout" type="button" @click="logout">退出登录</button>
    </header>

    <section class="profile-card">
      <div class="avatar-block">
        <img class="avatar-img" :src="avatarSrc" alt="头像" />
        <div class="avatar-actions">
          <button class="btn-outline" type="button" @click="fileInput?.click()">上传头像</button>
          <input ref="fileInput" class="hidden-file" type="file" accept="image/*" @change="onFile" />
          <span class="avatar-hint">支持 jpg/png，自动裁剪压缩</span>
        </div>
      </div>

      <div class="uid-row">
        <span class="uid-label">UID</span>
        <code class="uid-value">#{{ uid }}</code>
      </div>

      <div class="field">
        <label for="profile-name">用户名</label>
        <div class="field-inline">
          <input id="profile-name" v-model="editName" maxlength="16" placeholder="1-16 个字符" @keyup.enter="saveName" />
          <button class="btn-primary" type="button" :disabled="saving" @click="saveName">保存</button>
        </div>
        <p class="field-hint">用户名全局唯一，其他人不能重名。</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import useSocketStore from '~/store/socket'
import useUserStore from '~/store/user'
import { useNotify } from '~/composables'
import { generateFromString } from 'generate-avatar'

const router = useRouter()
const socketStore = useSocketStore()
const userStore = useUserStore()

const uid = computed(() => userStore.id)
const editName = ref(userStore.name)
const saving = ref(false)
const fileInput = ref<HTMLInputElement>()

const avatarSrc = computed(() =>
  userStore.avatar || `data:image/svg+xml;utf8,${generateFromString(userStore.id + userStore.name)}`
)

watch(() => userStore.name, (n) => { editName.value = n })

const saveName = async () => {
  const n = editName.value.trim()
  if (n.length < 1 || n.length > 16) return useNotify('用户名需为 1-16 个字符')
  if (n === userStore.name) return useNotify('名称未改变')
  saving.value = true
  try {
    const profile = await socketStore.updateProfile(userStore.token, { name: n })
    if (profile) userStore.setProfile(profile)
  } finally {
    saving.value = false
  }
}

function resizeImage(file: File, size = 96): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas 不可用'))
        const min = Math.min(img.width, img.height)
        const sx = (img.width - min) / 2
        const sy = (img.height - min) / 2
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

const onFile = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    input.value = ''
    return useNotify('请选择图片文件')
  }
  try {
    const dataUrl = await resizeImage(file)
    const profile = await socketStore.updateProfile(userStore.token, { avatar: dataUrl })
    if (profile) userStore.setProfile(profile)
  } catch {
    useNotify('头像处理失败')
  } finally {
    input.value = ''
  }
}

const logout = () => {
  userStore.logout()
  router.replace('/login')
}
</script>

<style scoped>
.profile-shell {
  width: min(100%, 480px);
  color: #24272b;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.profile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.profile-head h1 {
  margin: 0;
  font-size: 20px;
}

.link-back,
.link-logout {
  padding: 6px 11px;
  font-size: 13px;
  background: #fff;
  border: 1px dashed #aeb5bc;
  border-radius: 7px;
  cursor: pointer;
}

.link-back { color: #636a71; }
.link-logout { color: #a63d42; border-color: #d9a8a9; }
.link-logout:hover { background: #fff7f7; }

.profile-card {
  box-sizing: border-box;
  padding: 22px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #dadde1;
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(28, 32, 37, 0.07);
}

.avatar-block {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e8eaec;
}

.avatar-img {
  width: 84px;
  height: 84px;
  flex: none;
  object-fit: cover;
  background: #fff;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(28, 32, 37, 0.14);
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.avatar-hint {
  color: #969ca2;
  font-size: 11px;
}

.hidden-file { display: none; }

.uid-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #e8eaec;
}

.uid-label {
  color: #757c83;
  font-size: 13px;
  font-weight: 700;
}

.uid-value {
  padding: 4px 10px;
  color: #a14b4f;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  background: #fbf1f1;
  border: 1px dashed #e2b6b7;
  border-radius: 7px;
}

.field { padding-top: 16px; }

.field label {
  display: block;
  margin-bottom: 8px;
  color: #535961;
  font-size: 13px;
  font-weight: 700;
}

.field-inline {
  display: flex;
  gap: 8px;
}

.field-inline input {
  flex: 1;
  min-width: 0;
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
}

.field-inline input:focus {
  border-color: #c64b4e;
  box-shadow: 0 0 0 3px rgba(198, 75, 78, 0.12);
}

.field-hint {
  margin: 8px 0 0;
  color: #969ca2;
  font-size: 12px;
}

.btn-outline {
  padding: 8px 14px;
  color: #636a71;
  font-size: 13px;
  font-weight: 600;
  background: #fff;
  border: 1px solid #cfd4d9;
  border-radius: 8px;
  cursor: pointer;
}

.btn-outline:hover { border-color: #9aa0a8; }

.btn-primary {
  flex: none;
  padding: 0 16px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  background: #c64b4e;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.btn-primary:hover { background: #b13f42; }
.btn-primary:disabled { cursor: wait; opacity: 0.6; }

.dark .profile-shell { color: #eef1f4; }

.dark .link-back,
.dark .link-logout,
.dark .btn-outline {
  background: #25292d;
  border-color: #4b5259;
  color: #cfd4d9;
}

.dark .link-logout { color: #ff9a9d; border-color: #6a4a4d; }

.dark .profile-card {
  background: rgba(27, 29, 32, 0.92);
  border-color: #3d4247;
  box-shadow: none;
}

.dark .avatar-block,
.dark .uid-row { border-color: #363b40; }

.dark .avatar-hint,
.dark .field-hint { color: #9ca3aa; }

.dark .uid-label { color: #a9b0b7; }
.dark .field label { color: #cfd4d9; }

.dark .uid-value {
  color: #f0aeb0;
  background: #33262a;
  border-color: #6a4a4d;
}

.dark .field-inline input {
  color: #eef1f4;
  background: #202327;
  border-color: #41464b;
}
</style>

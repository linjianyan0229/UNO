<template>
  <main :class="{ 'home-main': route.path === '/' }" w="100%" flex-1 flex flex-col justify="center" items-center p="l-3 r-3 t-3"
    text="center gray-700 dark:gray-200" overflow="scroll">
    <router-view />
  </main>

  <!-- 左下角:账号 UID 挂件 -->
  <RouterLink v-if="showUserChip" to="/profile" class="user-chip" title="个人资料">
    <img class="user-chip-avatar" :src="avatarSrc" alt="" />
    <div class="user-chip-text">
      <strong>{{ userStore.name }}</strong>
      <span>#{{ userStore.id }}</span>
    </div>
  </RouterLink>

  <Footer m="t-4" />
</template>

<script lang="ts" setup>
import useUserStore from '~/store/user'
import useSocketStore from '~/store/socket'
import { generateFromString } from 'generate-avatar'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const socketStore = useSocketStore()

const showUserChip = computed(() => userStore.loggedIn && route.name !== 'login')
const avatarSrc = computed(() =>
  userStore.avatar || `data:image/svg+xml;utf8,${generateFromString(userStore.id + userStore.name)}`
)

onMounted(async () => {
  // 启动时用本地 token 向服务端校验并刷新资料;失效则退出到登录页
  if (!userStore.token) return
  try {
    const profile = await socketStore.autoLogin(userStore.token)
    if (profile) {
      userStore.setProfile(profile)
    } else {
      userStore.logout()
      router.replace('/login')
    }
  } catch {
    // 网络异常时保留本地缓存的登录态
  }
})
</script>

<style scoped>
.user-chip {
  position: fixed;
  z-index: 40;
  bottom: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 210px;
  padding: 6px 12px 6px 6px;
  color: #2b2f34;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #dcdfe2;
  border-radius: 999px;
  box-shadow: 0 6px 18px rgba(28, 32, 37, 0.12);
  backdrop-filter: blur(4px);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.user-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(28, 32, 37, 0.18);
}

.user-chip-avatar {
  width: 34px;
  height: 34px;
  flex: none;
  object-fit: cover;
  background: #fff;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(28, 32, 37, 0.18);
}

.user-chip-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
}

.user-chip-text strong {
  max-width: 150px;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-chip-text span {
  color: #a14b4f;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
</style>

<style>
.home-main {
  justify-content: flex-start !important;
}

.home-main > .home-shell {
  margin-top: auto;
  margin-bottom: auto;
}

@media (max-width: 820px) {
  .home-main > .home-shell {
    margin-top: 0;
    margin-bottom: 0;
  }
}

html.dark .user-chip {
  color: #eef1f4;
  background: rgba(28, 31, 35, 0.92);
  border-color: #444a50;
}
html.dark .user-chip-text span { color: #f0aeb0; }
</style>

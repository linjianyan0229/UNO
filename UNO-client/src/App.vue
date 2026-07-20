<template>
  <main :class="{ 'home-main': route.path === '/' }" w="100%" flex-1 flex flex-col justify="center" items-center p="l-3 r-3 t-3"
    text="center gray-700 dark:gray-200" overflow="scroll">
    <router-view />
  </main>

  <!-- 左下角:账号 UID 挂件 -->
  <button v-if="showRulesButton" class="rules-trigger" type="button" @click="openRules">
    <span i-carbon-book></span>
    <span>游戏规则</span>
  </button>

  <RouterLink v-if="showUserChip" to="/profile" class="user-chip" title="个人资料">
    <img class="user-chip-avatar" :src="avatarSrc" alt="" />
    <div class="user-chip-text">
      <strong>{{ userStore.name }}</strong>
      <span>#{{ userStore.id }}</span>
    </div>
  </RouterLink>

  <Teleport to="body">
    <Transition name="rules-fade">
      <div v-if="showRules" class="rules-overlay" @click.self="closeRules">
        <section ref="rulesDialog" class="rules-dialog" role="dialog" aria-modal="true" aria-labelledby="rules-title" tabindex="-1">
          <header class="rules-header">
            <div>
              <span class="rules-kicker">HOW TO PLAY</span>
              <h2 id="rules-title">UNO 游戏规则</h2>
            </div>
            <button class="rules-close" type="button" title="关闭" aria-label="关闭游戏规则" @click="closeRules">
              <span i-carbon-close></span>
            </button>
          </header>

          <div class="rules-body">
            <section class="rules-section">
              <h3>基础规则</h3>
              <ul>
                <li>每位玩家开局获得 9 张牌，最先出完手牌者获胜。</li>
                <li>普通牌必须与桌面牌颜色相同或类型相同；相同点数的数字牌可以一次打出多张。</li>
                <li>没有可出的牌时取 1 张；新牌可出时可以立即打出，也可以保留并结束回合。</li>
                <li>只剩 1 张普通数字牌时可以喊 UNO。未喊 UNO 直接出完牌会补 2 张。</li>
              </ul>
            </section>

            <section class="rules-section">
              <h3>+2 累计</h3>
              <ul>
                <li>打出 +2 后，桌面显示累计计数；同色牌、反转牌或换色牌可以继续传递处罚。</li>
                <li>同色 +2 会让累计值继续增加 2；无法应对时一次摸取全部累计牌，并跳过本轮。</li>
              </ul>
            </section>

            <section class="rules-section rules-actions">
              <h3>功能牌</h3>
              <dl>
                <div><dt>反转</dt><dd>改变当前出牌方向。</dd></div>
                <div><dt>跳过</dt><dd>跳过下一位玩家；双人局不会生成此牌。</dd></div>
                <div><dt>换色</dt><dd>选择新的出牌颜色，可以在任意牌上打出。</dd></div>
                <div><dt>+4</dt><dd>选择颜色后，下一位可以接受或质疑。接受摸 4 张；质疑成功由出牌者摸 4 张，失败则质疑者摸 4 张。</dd></div>
                <div><dt>指定</dt><dd>指定一名玩家和一种颜色；对方没有该颜色或换色牌时摸 4 张。</dd></div>
                <div><dt>炸弹</dt><dd>随机选出一种颜色；下一位没有该颜色时随机摸 4–8 张。</dd></div>
              </dl>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>

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
const showRules = ref(false)
const rulesDialog = ref<HTMLElement | null>(null)

const showUserChip = computed(() => userStore.loggedIn && route.name !== 'login')
const showRulesButton = computed(() => userStore.loggedIn && route.name === 'process')
const avatarSrc = computed(() =>
  userStore.avatar || `data:image/svg+xml;utf8,${generateFromString(userStore.id + userStore.name)}`
)

const openRules = () => {
  showRules.value = true
  nextTick(() => rulesDialog.value?.focus())
}

const closeRules = () => {
  showRules.value = false
}

const handleRulesKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && showRules.value) closeRules()
}

onMounted(async () => {
  window.addEventListener('keydown', handleRulesKeydown)
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

onBeforeUnmount(() => window.removeEventListener('keydown', handleRulesKeydown))
watch(() => route.name, () => closeRules())
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

.rules-trigger {
  position: fixed;
  z-index: 40;
  bottom: 66px;
  left: 14px;
  display: inline-flex;
  height: 36px;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  color: #4f565d;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid #d7dade;
  border-radius: 6px;
  box-shadow: 0 5px 16px rgba(28, 32, 37, 0.1);
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: color 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
}

.rules-trigger:hover {
  color: #a63d42;
  border-color: #c98b8e;
  transform: translateY(-1px);
}

.rules-trigger span:first-child {
  width: 16px;
  height: 16px;
}

.rules-overlay {
  position: fixed;
  z-index: 200;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 24px;
  background: rgba(10, 12, 15, 0.72);
  backdrop-filter: blur(3px);
}

.rules-dialog {
  width: min(100%, 760px);
  max-height: min(82vh, 760px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #25292e;
  text-align: left;
  background: #fff;
  border: 1px solid #d6dade;
  border-radius: 8px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
  outline: none;
}

.rules-header {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid #e1e4e7;
}

.rules-kicker {
  display: block;
  margin-bottom: 5px;
  color: #9a5255;
  font-size: 10px;
  font-weight: 800;
}

.rules-header h2 {
  margin: 0;
  font-size: 23px;
  line-height: 1.2;
}

.rules-close {
  width: 34px;
  height: 34px;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: #656c73;
  background: transparent;
  border: 1px solid #d8dce0;
  border-radius: 50%;
  cursor: pointer;
}

.rules-close:hover {
  color: #a63d42;
  border-color: #c98b8e;
}

.rules-close span {
  width: 18px;
  height: 18px;
}

.rules-body {
  min-height: 0;
  overflow-y: auto;
  padding: 0 24px 22px;
  scrollbar-width: thin;
}

.rules-section {
  padding: 20px 0;
  border-bottom: 1px solid #e7e9eb;
}

.rules-section:last-child {
  border-bottom: 0;
}

.rules-section h3 {
  margin: 0 0 12px;
  color: #34393f;
  font-size: 15px;
}

.rules-section ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
  color: #626970;
  font-size: 13px;
  line-height: 1.65;
}

.rules-actions dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
  margin: 0;
}

.rules-actions dl > div {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #eef0f2;
}

.rules-actions dt {
  color: #a3474b;
  font-size: 13px;
  font-weight: 800;
}

.rules-actions dd {
  margin: 0;
  color: #626970;
  font-size: 13px;
  line-height: 1.55;
}

.rules-fade-enter-active,
.rules-fade-leave-active {
  transition: opacity 0.16s ease;
}

.rules-fade-enter-from,
.rules-fade-leave-to {
  opacity: 0;
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

html.dark .rules-trigger {
  color: #d8dce0;
  background: rgba(28, 31, 35, 0.94);
  border-color: #444a50;
}

html.dark .rules-dialog {
  color: #eef1f4;
  background: #1d2024;
  border-color: #444a50;
}

html.dark .rules-header,
html.dark .rules-section {
  border-color: #3b4046;
}

html.dark .rules-header h2,
html.dark .rules-section h3 {
  color: #eef1f4;
}

html.dark .rules-close {
  color: #c8cdd2;
  border-color: #4b5158;
}

html.dark .rules-section ul,
html.dark .rules-actions dd {
  color: #b6bcc2;
}

html.dark .rules-actions dl > div {
  border-color: #34393f;
}

@media (max-width: 640px) {
  .rules-overlay {
    align-items: flex-end;
    padding: 12px;
  }

  .rules-dialog {
    max-height: 86vh;
  }

  .rules-header {
    padding: 18px 18px 15px;
  }

  .rules-body {
    padding: 0 18px 18px;
  }

  .rules-actions dl {
    grid-template-columns: 1fr;
  }
}
</style>

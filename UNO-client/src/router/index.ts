import routes from 'virtual:generated-pages'
import { createRouter, createWebHistory } from 'vue-router'
import { store } from '~/store'
import { useRoomStore } from '~/store/room'
import useUserStore from '~/store/user'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore(store)
  const authed = !!userStore.token

  // 必须登录:未登录一律去登录页(带回跳地址)
  if (to.name !== 'login' && !authed) {
    return next({ name: 'login', query: to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : {} })
  }
  // 已登录再访问登录页则回首页
  if (to.name === 'login' && authed) {
    return next('/')
  }

  // 进房相关页面需要已有房间
  if ((to.name === 'wait' && from.name != 'index') || to.name === 'process' || to.name === 'end') {
    if (!useRoomStore(store).roomCode) {
      return next('/')
    }
  }
  next()
})

export default router

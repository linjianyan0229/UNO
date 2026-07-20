import { defineStore } from "pinia";

const STORAGE_KEY = 'uno_profile'

function loadCached(): UserProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UserProfile) : null
  } catch {
    return null
  }
}

const useUserStore = defineStore('user', {
  state: () => {
    // 同步水合:刷新后立即恢复登录态,避免路由守卫闪回登录页
    const cached = loadCached()
    return {
      id: cached?.uid || '',
      name: cached?.name || '',
      avatar: cached?.avatar || '',
      token: cached?.token || '',
    }
  },
  getters: {
    loggedIn: (state) => !!state.token,
  },
  actions: {
    setProfile(profile: UserProfile) {
      this.id = profile.uid
      this.name = profile.name
      this.avatar = profile.avatar
      this.token = profile.token
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
      }
    },
    getUserInfo(): UserInfo {
      return { id: this.id, name: this.name, avatar: this.avatar }
    },
    logout() {
      this.id = ''
      this.name = ''
      this.avatar = ''
      this.token = ''
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    },
  }
})

export default useUserStore

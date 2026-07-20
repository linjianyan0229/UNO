declare interface UserInfo {
  id: string,
  name: string,
  avatar?: string
}

// 登录后的账号资料
declare interface UserProfile {
  uid: string,
  name: string,
  avatar: string,
  token: string
}

declare type AIDifficulty = 'easy' | 'normal' | 'hard'

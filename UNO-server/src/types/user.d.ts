declare interface UserInfo {
  id: string,
  name: string,
  avatar?: string
}

// 返回给客户端的账号资料(不含密码)
declare interface UserProfile {
  uid: string,
  name: string,
  avatar: string,
  token: string
}

declare type AIDifficulty = 'easy' | 'normal' | 'hard'

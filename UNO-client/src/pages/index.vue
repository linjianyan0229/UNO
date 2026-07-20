<template>
  <div class="home-shell">
    <section class="home-intro" aria-labelledby="home-title">
      <div class="eyebrow"><span class="eyebrow-dot"></span> ONLINE CARD ROOM</div>
      <div class="logo-lockup" aria-hidden="true">
        <div class="logo-tile logo-tile-red">U</div>
        <div class="logo-tile logo-tile-blue">N</div>
        <div class="logo-tile logo-tile-yellow">O</div>
      </div>
      <h1 id="home-title">来一局 <span>UNO</span></h1>
      <p class="intro-copy">联机、开房，或者让 AI 陪你完成一局。选择入口，马上发牌。</p>
      <div class="feature-list">
        <div class="feature-item">
          <div class="feature-icon" i-carbon-group-objects></div>
          <div><strong>多人房间</strong><span>分享房间号，和朋友一起玩</span></div>
        </div>
        <div class="feature-item">
          <div class="feature-icon" i-carbon-ai-status></div>
          <div><strong>人机对战</strong><span>三档难度，随时开始练习</span></div>
        </div>
      </div>
    </section>

    <section class="game-panel" aria-label="开始游戏">
      <div class="panel-heading">
        <div>
          <span class="panel-kicker">PLAY NOW</span>
          <h2>开始游戏</h2>
        </div>
        <span class="mode-badge">{{ modeLabel }}</span>
      </div>

      <fieldset class="mode-fieldset">
        <legend>选择模式</legend>
        <div class="mode-grid">
          <label v-for="mode in modeOptions" :key="mode.value" class="mode-option" :class="{ active: roomType === mode.value }" @click="handleModeClick(mode.value)">
            <input type="radio" :value="mode.value" v-model="roomType" />
            <span class="mode-option-icon" :class="mode.icon"></span>
            <span class="mode-option-copy"><strong>{{ mode.title }}</strong><small>{{ mode.description }}</small></span>
          </label>
        </div>
      </fieldset>

      <div v-if="roomType !== 'aiGame'" class="field-group">
        <label for="room-answer">{{ roomTip }}</label>
        <input id="room-answer" v-model="roomAns" class="text-input" :placeholder="roomType === 'joinRoom' ? '例如 XUJCP' : '给房间起个名字'" autocomplete="off" />
      </div>
      <div v-else class="field-group">
        <label for="ai-difficulty">AI 难度</label>
        <div class="select-wrap">
          <select id="ai-difficulty" v-model="aiDifficulty" class="text-input">
            <option value="easy">简单 · 快速出牌</option>
            <option value="normal">普通 · 平衡策略</option>
            <option value="hard">困难 · 更积极连牌</option>
          </select>
          <span class="select-arrow" i-carbon-chevron-down></span>
        </div>
      </div>

      <button class="primary-action" :disabled="isSubmitting" @click="handleClick">
        <span>{{ isSubmitting ? '连接中...' : '进入游戏' }}</span>
        <span i-carbon-arrow-right></span>
      </button>
      <div class="panel-note"><span i-carbon-locked></span><span>昵称只用于本局显示，不需要注册</span></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useNotify } from '~/composables';
import { useRoomStore } from '~/store/room';
import useSocketStore from '~/store/socket';
import useUserStore from '~/store/user';

const roomAns = ref('');
const roomType = ref<'joinRoom' | 'createRoom' | 'aiGame'>('joinRoom');
const aiDifficulty = ref<AIDifficulty>('normal');
const isSubmitting = ref(false);

const modeOptions = [
  { value: 'joinRoom' as const, title: '加入房间', description: '输入房间号加入', icon: 'i-carbon-login' },
  { value: 'createRoom' as const, title: '创建房间', description: '邀请朋友来玩', icon: 'i-carbon-add-alt' },
  { value: 'aiGame' as const, title: '人机对战', description: '一个人也能开局', icon: 'i-carbon-ai-status' },
];

const roomTip = computed(() => roomType.value === 'joinRoom' ? '房间代码' : '房间名称');
const modeLabel = computed(() => modeOptions.find((mode) => mode.value === roomType.value)?.title || '选择模式');

const router = useRouter();
const socketStore = useSocketStore();
const userStore = useUserStore();
const roomStore = useRoomStore();

const handleModeClick = (mode: typeof roomType.value) => {
  if (mode === 'joinRoom') {
    router.push('/rooms')
    return
  }
  roomType.value = mode
};

const handleClick = () => {
  if (isSubmitting.value) return;
  if (roomType.value !== 'aiGame' && !roomAns.value) {
    useNotify('请输入' + roomTip.value);
    return;
  }

  isSubmitting.value = true;
  // 已登录,直接用账号身份(uid/昵称/头像)进入,无需再输入昵称
  const flow = roomType.value === 'aiGame'
    ? socketStore.startAIGame(userStore.getUserInfo(), aiDifficulty.value).then((result) => {
        roomStore.setRoomInfo(result.roomInfo);
        roomStore.setUserCards(result.userCards);
        router.push('/process');
      })
    : (roomType.value === 'joinRoom' ? socketStore.joinRoom : socketStore.createRoom)
        .call(socketStore, roomAns.value, userStore.getUserInfo()).then((roomInfo) => {
          if (!roomInfo) return;
          roomStore.setRoomInfo(roomInfo);
          router.push('/wait');
        });

  Promise.resolve(flow).catch(() => {
    useNotify('连接失败，请稍后重试');
  }).finally(() => {
    isSubmitting.value = false;
  });
};
</script>

<style scoped>
.home-shell {
  width: min(100%, 1080px);
  min-height: 620px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 440px);
  gap: 72px;
  align-items: center;
  padding: 40px 48px 52px;
  box-sizing: border-box;
  color: #22252a;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
}

.home-intro {
  max-width: 500px;
  padding: 20px 0;
  text-align: center;
}

.eyebrow,
.panel-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #72777e;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.6px;
}

.eyebrow-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #66a650;
  box-shadow: 0 0 0 4px rgba(102, 166, 80, 0.14);
}

.logo-lockup {
  display: flex;
  height: 78px;
  align-items: center;
  justify-content: center;
  margin: 42px 0 24px;
}

.logo-tile {
  width: 56px;
  height: 74px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 4px solid #fff;
  border-radius: 8px;
  box-sizing: border-box;
  color: #fff;
  font-size: 30px;
  font-weight: 800;
  box-shadow: 0 8px 18px rgba(28, 32, 38, 0.12);
}

.logo-tile + .logo-tile { margin-left: -12px; }
.logo-tile-red { background: #e76464; transform: rotate(-10deg); }
.logo-tile-blue { background: #5c9fc5; transform: translateY(-5px) rotate(2deg); }
.logo-tile-yellow { background: #d5a92f; transform: rotate(10deg); }

.home-intro h1 {
  margin: 0;
  color: #1f2328;
  font-size: 56px;
  font-weight: 800;
  line-height: 1.05;
}

.home-intro h1 span { color: #c64b4e; }

.intro-copy {
  max-width: 410px;
  margin: 22px 0 0;
  color: #6f757c;
  font-size: 17px;
  line-height: 1.8;
}

.feature-list {
  display: grid;
  gap: 14px;
  justify-items: center;
  margin-top: 38px;
}

.feature-item {
  width: min(100%, 320px);
  display: flex;
  align-items: center;
  gap: 12px;
  color: #3b4046;
  text-align: left;
}

.feature-icon {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d9dde1;
  border-radius: 7px;
  color: #c64b4e;
  font-size: 18px;
}

.feature-item strong,
.feature-item span { display: block; }
.feature-item strong { font-size: 14px; }
.feature-item span { margin-top: 2px; color: #858b92; font-size: 12px; }

.game-panel {
  width: 100%;
  padding: 30px 32px 26px;
  border: 1px solid #d9dde1;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 50px rgba(35, 39, 44, 0.08);
  box-sizing: border-box;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 28px;
}

.panel-kicker { color: #a0a5ab; font-size: 10px; letter-spacing: 1.4px; }
.panel-heading h2 { margin: 6px 0 0; color: #24282d; font-size: 26px; font-weight: 800; }
.mode-badge { padding: 6px 9px; border-radius: 4px; background: #f1f2f3; color: #656b72; font-size: 12px; white-space: nowrap; }

.field-group { margin-top: 20px; }
.field-group label,
.mode-fieldset legend { display: block; margin-bottom: 8px; color: #535961; font-size: 13px; font-weight: 700; }
.text-input {
  width: 100%;
  height: 44px;
  padding: 0 13px;
  border: 1px solid #d5d9dd;
  border-radius: 5px;
  outline: none;
  background: #fff;
  box-sizing: border-box;
  color: #25292e;
  font: inherit;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.text-input::placeholder { color: #aeb3b8; }
.text-input:focus { border-color: #c64b4e; box-shadow: 0 0 0 3px rgba(198, 75, 78, 0.12); }
.mode-fieldset { margin: 26px 0 0; padding: 0; border: 0; }
.mode-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }

.mode-option {
  position: relative;
  min-height: 92px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 11px;
  border: 1px solid #dfe2e5;
  border-radius: 6px;
  background: #fff;
  box-sizing: border-box;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
}

.mode-option:hover { border-color: #b6bbc0; transform: translateY(-1px); }
.mode-option.active { border-color: #c64b4e; background: #fff8f7; box-shadow: inset 0 0 0 1px #c64b4e; }
.mode-option input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.mode-option-icon { color: #787e85; font-size: 18px; }
.mode-option.active .mode-option-icon { color: #c64b4e; }
.mode-option-copy strong,
.mode-option-copy small { display: block; }
.mode-option-copy strong { color: #3a3f45; font-size: 12px; }
.mode-option-copy small { margin-top: 3px; color: #92979d; font-size: 10px; line-height: 1.3; }
.select-wrap { position: relative; }
.select-wrap .text-input { appearance: none; padding-right: 40px; cursor: pointer; }
.select-arrow { position: absolute; top: 14px; right: 13px; color: #777e85; pointer-events: none; }

.primary-action {
  width: 100%;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 28px;
  padding: 0 15px 0 18px;
  border: 0;
  border-radius: 5px;
  background: #c64b4e;
  color: #fff;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.primary-action:hover { background: #ad3f43; transform: translateY(-1px); }
.primary-action:disabled { background: #b7a0a1; cursor: wait; transform: none; }
.panel-note { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 17px; color: #969ba1; font-size: 11px; }

.dark .home-shell { color: #f1f3f4; }
.dark .home-intro h1 { color: #f1f3f4; }
.dark .intro-copy,
.dark .feature-item span { color: #9da3aa; }
.dark .feature-item { color: #e0e3e5; }
.dark .feature-icon { border-color: #34383d; }
.dark .game-panel { border-color: #383d42; background: rgba(27, 29, 32, 0.88); box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24); }
.dark .panel-heading h2,
.dark .field-group label,
.dark .mode-fieldset legend,
.dark .mode-option-copy strong { color: #eef0f1; }
.dark .mode-badge { background: #33373c; color: #b7bdc3; }
.dark .text-input,
.dark .mode-option { border-color: #41464b; background: #202326; color: #f1f3f4; }
.dark .text-input::placeholder,
.dark .mode-option-copy small { color: #858c93; }
.dark .mode-option.active { border-color: #dc676a; background: #302326; box-shadow: inset 0 0 0 1px #dc676a; }

@media (max-width: 820px) {
  .home-shell { grid-template-columns: 1fr; gap: 18px; min-height: auto; padding: 18px 18px 28px; align-items: start; }
  .game-panel { order: -1; max-width: 560px; justify-self: center; padding: 24px 26px 20px; }
  .home-intro { order: 1; max-width: 560px; padding: 0; text-align: center; }
  .logo-lockup { height: 52px; margin: 4px 0 12px; transform: scale(0.7); transform-origin: center center; }
  .home-intro h1 { font-size: 36px; }
  .intro-copy { max-width: 560px; margin-top: 10px; font-size: 14px; line-height: 1.55; }
  .feature-list { display: grid; justify-items: center; }
  .feature-item { width: min(100%, 320px); text-align: left; }
  .panel-heading { margin-bottom: 18px; }
  .field-group { margin-top: 14px; }
  .mode-fieldset { margin-top: 18px; }
  .primary-action { margin-top: 20px; }
}

@media (max-width: 480px) {
  .home-shell { padding-right: 12px; padding-left: 12px; }
  .home-intro h1 { font-size: 44px; }
  .intro-copy { margin-top: 15px; font-size: 15px; }
  .feature-list { grid-template-columns: 1fr; gap: 10px; }
  .game-panel { padding: 24px 18px 20px; }
  .mode-grid { grid-template-columns: 1fr; }
  .mode-option { min-height: 58px; flex-direction: row; align-items: center; gap: 10px; }
  .mode-option-copy { flex: 1; }
}
</style>

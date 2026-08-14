<script setup>
import { computed, reactive, ref, watch, onMounted } from 'vue'
import { DEFAULTS, TOOLS, generate, withDefaults, GenerateError } from './lib/state.js'
import { estimate, estimateFromString } from './lib/strength.js'
import { describeUsername } from './lib/username.js'
import { loadOptions, saveOptions } from './lib/storage.js'
import OutputField from './components/OutputField.vue'
import PasswordOptions from './components/PasswordOptions.vue'
import UsernameOptions from './components/UsernameOptions.vue'

const HISTORY_LIMIT = 10

const state = reactive(withDefaults(null))
const value = ref('')
const edited = ref(false) // 手工改过，密码强度只能估算
const error = ref('')
const copied = ref(false)
const showHistory = ref(false)
const ready = ref(false)

// 两个工具各自一份历史，切 tab 时不会看到另一边的内容，避免误复制
const history = reactive({ password: [], username: [] })
const currentHistory = computed(() => history[state.tool])

const isPassword = computed(() => state.tool === 'password')

const strength = computed(() =>
  edited.value ? estimateFromString(value.value) : estimate(state.password)
)
const nameInfo = computed(() => describeUsername(value.value))

function regenerate() {
  try {
    value.value = generate(state)
    error.value = ''
  } catch (e) {
    if (!(e instanceof GenerateError)) throw e
    value.value = ''
    error.value = e.message
  }
  edited.value = false
  copied.value = false
}

function remember(v) {
  if (!v) return
  const list = history[state.tool]
  history[state.tool] = [v, ...list.filter((x) => x !== v)].slice(0, HISTORY_LIMIT)
}

/** 手动刷新：把即将被覆盖的那条存进历史，避免手滑点掉刚生成的好结果 */
function refresh() {
  remember(value.value)
  regenerate()
}

function onEdit(v) {
  value.value = v
  edited.value = true
  copied.value = false
  error.value = ''
}

let copyTimer
async function copy(v = value.value) {
  if (!v) return
  try {
    await navigator.clipboard.writeText(v)
    remember(v)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied.value = false), 1500)
  } catch {
    error.value = '复制失败，请手动选中'
  }
}

/** 只重置当前工具（密码则只重置当前模式）的参数，不动其他部分，也不动已生成的结果 */
function resetCurrent() {
  if (isPassword.value) {
    const mode = state.password.mode
    Object.assign(state.password[mode], DEFAULTS.password[mode])
  } else {
    Object.assign(state.username, DEFAULTS.username)
  }
}

onMounted(async () => {
  Object.assign(state, withDefaults(await loadOptions()))
  ready.value = true
  regenerate()
})

watch(state, () => {
  if (!ready.value) return // 别把默认值抢在读档前写回去
  regenerate()
  saveOptions(JSON.parse(JSON.stringify(state)))
})

// 切换工具时收起历史面板，否则会先闪一下另一个工具的列表
watch(() => state.tool, () => (showHistory.value = false))
</script>

<template>
  <main>
    <nav class="tools">
      <button
        v-for="t in TOOLS"
        :key="t.key"
        :class="{ on: state.tool === t.key }"
        @click="state.tool = t.key"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="scroll">
      <div class="output">
        <p v-if="error" class="error">{{ error }}</p>
        <OutputField
          v-else
          :model-value="value"
          :label="isPassword ? '密码，可直接编辑' : '用户名，可直接编辑'"
          @update:model-value="onEdit"
        />

        <div class="actions">
          <button class="icon" title="重新生成" aria-label="重新生成" @click="refresh">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" />
            </svg>
          </button>
          <button class="copy" :disabled="!value" @click="copy()">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
      </div>

      <!-- 密码看强度；用户名是公开的，熵没有意义，改看长度和站点兼容性 -->
      <div v-if="isPassword" class="meter">
        <div class="track">
          <div class="fill" :style="{ width: strength.percent + '%', background: strength.color }" />
        </div>
        <span class="meter-label" :style="{ color: strength.color }">{{ strength.label }}</span>
        <span
          class="bits"
          :title="strength.exact
            ? '由密码学随机数均匀生成，此为精确熵值'
            : '手工编辑后只能按字符构成估算，这是上限；人工挑选的密码实际强度通常远低于此'"
        >{{ strength.exact ? '' : '≤' }}{{ strength.bits }} bits<template v-if="!strength.exact"> · 估算</template></span>
      </div>
      <div v-else class="meter">
        <span class="dim">{{ nameInfo.length }} 字符</span>
        <span v-if="nameInfo.notes.length" class="notes">{{ nameInfo.notes.join('；') }}</span>
        <span v-else class="ok">兼容性良好</span>
      </div>

      <PasswordOptions v-if="isPassword" :password="state.password" />
      <UsernameOptions v-else :username="state.username" />

      <div class="bar">
        <button class="link" @click="resetCurrent">恢复默认</button>
        <button class="link" :disabled="!currentHistory.length" @click="showHistory = !showHistory">
          历史 {{ currentHistory.length ? `(${currentHistory.length})` : '' }}
        </button>
      </div>

      <ul v-if="showHistory && currentHistory.length" class="history">
        <li v-for="v in currentHistory" :key="v">
          <code>{{ v }}</code>
          <button title="复制" aria-label="复制这条" @click="copy(v)">复制</button>
        </li>
        <li class="clear"><button class="link" @click="history[state.tool] = []">清空历史</button></li>
      </ul>
    </div>

    <footer>本地生成 · 不联网 · 不保存结果</footer>
  </main>
</template>

<style scoped>
/*
 * 固定的头尾 + 中间滚动区。滚动条必须落在 .scroll 上而不是文档上，
 * 否则弹窗会被 Chrome 横向拉宽 —— 详见 style.css 里那段注释。
 */
main {
  display: flex;
  flex-direction: column;
  max-height: 600px;
}

.scroll {
  flex: 1 1 auto;
  min-height: 0; /* 缺了它 flex 项不肯收缩，滚动条又会跑回文档上 */
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ---- 顶层工具切换 ---- */
.tools {
  flex: none;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
  margin: 12px 12px 0;
  padding: 2px;
  background: var(--bg-soft);
  border-radius: 8px;
}
.tools button {
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 6px 0;
  color: var(--text-dim);
  transition: background 0.15s, color 0.15s;
}
.tools button.on {
  background: var(--bg);
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
}

/* ---- 结果区 ---- */
.output {
  flex: none;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.error {
  margin: 0;
  min-height: 42px;
  color: #ef4444;
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
}
.icon {
  display: grid;
  place-items: center;
  width: 32px;
  padding: 0;
}
.copy {
  flex: 1;
  background: var(--accent);
  color: var(--accent-text);
  border-color: transparent;
  font-weight: 600;
}

/* ---- 强度 / 兼容性 ---- */
.meter {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 18px;
}
.track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--track);
  overflow: hidden;
}
.fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.2s, background 0.2s;
}
.meter-label {
  font-weight: 600;
}
.bits {
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
  cursor: help;
}
.notes {
  flex: 1;
  min-width: 0;
  color: #f59e0b;
  font-size: 11px;
  line-height: 1.3;
}
.ok {
  flex: 1;
  color: #22c55e;
  font-size: 11px;
}

/* ---- 底部 ---- */
.bar {
  flex: none;
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.history {
  flex: none;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.history li {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.history code {
  flex: 1 1 0;
  min-width: 0;
  padding: 4px 6px;
  border-radius: 6px;
  background: var(--bg-inset);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.history li button {
  flex: none;
  padding: 3px 7px;
  font-size: 11px;
}
.history .clear {
  justify-content: center;
  padding-top: 2px;
}

footer {
  flex: none;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 11px;
  text-align: center;
}
</style>

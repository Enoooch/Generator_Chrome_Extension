<script setup>
import { computed, reactive, ref, watch, onMounted } from 'vue'
import { DEFAULTS, MODES, PIN_PRESETS, generate, withDefaults, GenerateError } from './lib/modes.js'
import { SEPARATORS, MIN_WORDS, MAX_WORDS, WORDLIST_SIZE } from './lib/passphrase.js'
import { estimate, estimateFromString } from './lib/strength.js'
import { loadOptions, saveOptions } from './lib/storage.js'

const MAX_MANUAL_LEN = 512
const HISTORY_LIMIT = 10

const state = reactive(withDefaults(null))
const password = ref('')
const edited = ref(false) // 手工改过，强度只能估算
const error = ref('')
const copied = ref(false)
const history = ref([]) // 仅存内存，popup 关闭即消失
const showHistory = ref(false)
const ready = ref(false)

const TYPES = [
  { key: 'upper', label: 'A-Z' },
  { key: 'lower', label: 'a-z' },
  { key: 'digit', label: '0-9' },
  { key: 'symbol', label: '!@#$' },
]

const strength = computed(() =>
  edited.value ? estimateFromString(password.value) : estimate(state)
)

// 按字符类别着色。textarea 无法上色，所以下面用一层等宽镜像 <pre> 承载颜色。
const segments = computed(() =>
  [...password.value].map((c) => ({
    c,
    type: /\d/.test(c) ? 'digit' : /[a-zA-Z]/.test(c) ? 'letter' : 'symbol',
  }))
)

function regenerate() {
  try {
    password.value = generate(state)
    error.value = ''
  } catch (e) {
    if (!(e instanceof GenerateError)) throw e
    password.value = ''
    error.value = e.message
  }
  edited.value = false
  copied.value = false
}

function remember(value) {
  if (!value || history.value[0] === value) return
  history.value = [value, ...history.value.filter((v) => v !== value)].slice(0, HISTORY_LIMIT)
}

/** 手动刷新：把即将被覆盖的那条存进历史，避免手滑点掉刚生成的好密码 */
function refresh() {
  remember(password.value)
  regenerate()
}

function onInput(e) {
  // 换行在密码里没有意义，粘贴多行时直接抹平
  password.value = e.target.value.replace(/[\r\n]+/g, '').slice(0, MAX_MANUAL_LEN)
  edited.value = true
  copied.value = false
  error.value = ''
}

let copyTimer
async function copy(value = password.value) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    remember(value)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copied.value = false), 1500)
  } catch {
    error.value = '复制失败，请手动选中密码'
  }
}

/** 只重置当前模式的参数，不动其他模式，也不动已生成的密码 */
function resetCurrentMode() {
  Object.assign(state[state.mode], DEFAULTS[state.mode])
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
</script>

<template>
  <main>
    <nav class="tabs">
      <button
        v-for="m in MODES"
        :key="m.key"
        :class="{ on: state.mode === m.key }"
        @click="state.mode = m.key"
      >
        {{ m.label }}
      </button>
    </nav>

    <div class="output">
      <p v-if="error" class="error">{{ error }}</p>
      <!-- 镜像层负责着色和撑开高度，透明 textarea 覆在上面负责编辑 -->
      <div v-else class="editor">
        <pre class="mirror" aria-hidden="true"><span
          v-for="(s, i) in segments" :key="i" :class="s.type">{{ s.c }}</span></pre>
        <textarea
          :value="password"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          aria-label="密码，可直接编辑"
          @input="onInput"
        />
      </div>

      <div class="actions">
        <button class="icon" title="重新生成" aria-label="重新生成" @click="refresh">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
        <button class="copy" :disabled="!password" @click="copy()">
          {{ copied ? '已复制' : '复制' }}
        </button>
      </div>
    </div>

    <div class="meter">
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

    <section v-if="state.mode === 'random'">
      <label class="row">
        <span>长度</span>
        <output>{{ state.random.length }}</output>
      </label>
      <input v-model.number="state.random.length" type="range" min="4" max="64" />

      <div class="types">
        <label v-for="t in TYPES" :key="t.key" class="chip" :class="{ on: state.random[t.key] }">
          <input v-model="state.random[t.key]" type="checkbox" />
          <span>{{ t.label }}</span>
        </label>
      </div>

      <label class="row toggle">
        <input v-model="state.random.excludeAmbiguous" type="checkbox" />
        <span>排除易混淆字符 <em>O0oIl1|</em></span>
      </label>

      <label class="row toggle">
        <input v-model="state.random.noRepeat" type="checkbox" />
        <span>字符不重复</span>
      </label>

      <label class="row stack">
        <span class="dim">排除指定字符</span>
        <input v-model="state.random.customExclude" type="text" placeholder="例如 &lt;&gt;&amp;" spellcheck="false" autocomplete="off" />
      </label>
    </section>

    <section v-else-if="state.mode === 'phrase'">
      <label class="row">
        <span>词数</span>
        <output>{{ state.phrase.words }}</output>
      </label>
      <input v-model.number="state.phrase.words" type="range" :min="MIN_WORDS" :max="MAX_WORDS" />

      <label class="row">
        <span>分隔符</span>
        <span class="seps">
          <button
            v-for="s in SEPARATORS"
            :key="s.value"
            class="sep"
            :class="{ on: state.phrase.separator === s.value }"
            @click="state.phrase.separator = s.value"
          >{{ s.label }}</button>
        </span>
      </label>

      <label class="row toggle">
        <input v-model="state.phrase.capitalize" type="checkbox" />
        <span>首字母大写</span>
      </label>

      <label class="row toggle">
        <input v-model="state.phrase.addNumber" type="checkbox" />
        <span>末尾追加一位数字</span>
      </label>

      <p class="hint">词库 {{ WORDLIST_SIZE }} 词，每词约 10.3 bits。分隔符与大小写不增加强度。</p>
    </section>

    <section v-else>
      <label class="row">
        <span>位数</span>
        <output>{{ state.pin.length }}</output>
      </label>
      <input v-model.number="state.pin.length" type="range" min="3" max="12" />
      <div class="presets">
        <button
          v-for="n in PIN_PRESETS"
          :key="n"
          class="sep"
          :class="{ on: state.pin.length === n }"
          @click="state.pin.length = n"
        >{{ n }} 位</button>
      </div>
      <p class="hint">纯数字强度很低，仅适合有锁定次数限制的场景（手机、门禁）。</p>
    </section>

    <div class="bar">
      <button class="link" @click="resetCurrentMode">恢复默认</button>
      <button class="link" :disabled="!history.length" @click="showHistory = !showHistory">
        历史 {{ history.length ? `(${history.length})` : '' }}
      </button>
    </div>

    <ul v-if="showHistory && history.length" class="history">
      <li v-for="v in history" :key="v">
        <code>{{ v }}</code>
        <button title="复制" aria-label="复制这条" @click="copy(v)">复制</button>
      </li>
      <li class="clear"><button class="link" @click="history = []">清空历史</button></li>
    </ul>

    <footer>本地生成 · 不联网 · 不保存密码</footer>
  </main>
</template>

<style scoped>
main {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ---- 模式切换 ---- */
.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 2px;
  background: var(--bg-soft);
  border-radius: 8px;
}
.tabs button {
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 5px 0;
  color: var(--text-dim);
  transition: background 0.15s, color 0.15s;
}
.tabs button.on {
  background: var(--bg);
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
}

/* ---- 密码框 ---- */
.output {
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.editor {
  position: relative;
  min-height: 42px;
}
/* 镜像层与 textarea 的排版属性必须逐条一致，否则光标会和字符错位 */
.mirror,
.editor textarea {
  margin: 0;
  padding: 0;
  border: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 15px;
  line-height: 1.45;
  letter-spacing: 0.02em;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-wrap: break-word;
}
.mirror {
  min-height: 42px;
  color: var(--text);
}
.mirror .digit { color: #0ea5e9; }
.mirror .symbol { color: #f43f5e; }

.editor textarea {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  resize: none;
  overflow: hidden;
  background: transparent;
  color: transparent; /* 字形由下面的镜像层显示 */
  caret-color: var(--text);
  outline: none;
}
.editor textarea::selection {
  background: color-mix(in srgb, var(--accent) 35%, transparent);
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

button {
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg);
  padding: 6px 10px;
  transition: filter 0.15s, opacity 0.15s;
}
button:hover:not(:disabled) { filter: brightness(0.96); }
button:disabled { opacity: 0.45; cursor: default; }

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

/* ---- 强度 ---- */
.meter {
  display: flex;
  align-items: center;
  gap: 8px;
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
.meter-label { font-weight: 600; }
.bits {
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
  cursor: help;
}

/* ---- 参数区 ---- */
section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.row.toggle {
  justify-content: flex-start;
  cursor: pointer;
}
.row.stack {
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
}
.row em {
  font-style: normal;
  font-family: ui-monospace, Menlo, monospace;
  color: var(--text-dim);
}
.dim { color: var(--text-dim); }
.hint {
  margin: 0;
  color: var(--text-dim);
  font-size: 11px;
  line-height: 1.4;
}
output {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
input[type='range'] {
  width: 100%;
  margin: 0;
}
input[type='text'] {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-inset);
  color: var(--text);
  font: inherit;
  font-family: ui-monospace, Menlo, monospace;
}
input[type='text']:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.types {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 2px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-inset);
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  color: var(--text-dim);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.chip.on {
  border-color: var(--accent);
  color: var(--text);
}
.chip input {
  margin: 0;
  width: 12px;
  height: 12px;
}

.seps, .presets {
  display: flex;
  gap: 4px;
}
.sep {
  min-width: 30px;
  padding: 3px 7px;
  font-size: 12px;
  background: var(--bg-inset);
  color: var(--text-dim);
}
.sep.on {
  border-color: var(--accent);
  color: var(--text);
  font-weight: 600;
}

/* ---- 底部 ---- */
.bar {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}
.link {
  border: none;
  background: none;
  padding: 0;
  color: var(--text-dim);
  font-size: 12px;
}
.link:hover:not(:disabled) {
  color: var(--accent);
  filter: none;
}

.history {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 168px;
  overflow-y: auto;
}
.history li {
  display: flex;
  align-items: center;
  gap: 6px;
}
.history code {
  flex: 1;
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
  padding: 3px 7px;
  font-size: 11px;
}
.history .clear {
  justify-content: center;
  padding-top: 2px;
}

footer {
  color: var(--text-dim);
  font-size: 11px;
  text-align: center;
}
</style>

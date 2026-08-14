<script setup>
import { MODES, PIN_PRESETS } from '../lib/state.js'
import { SEPARATORS, MIN_WORDS, MAX_WORDS, WORDLIST_SIZE } from '../lib/passphrase.js'

// 直接改 props 上的对象属性：这是父组件 reactive state 的一部分，
// 改动会被父组件的 watch 捕获并触发重新生成 + 存档。
const props = defineProps({
  password: { type: Object, required: true },
})

const TYPES = [
  { key: 'upper', label: 'A-Z' },
  { key: 'lower', label: 'a-z' },
  { key: 'digit', label: '0-9' },
  { key: 'symbol', label: '!@#$' },
]
</script>

<template>
  <nav class="modes seg">
    <button
      v-for="m in MODES"
      :key="m.key"
      :class="{ on: password.mode === m.key }"
      @click="password.mode = m.key"
    >
      {{ m.label }}
    </button>
  </nav>

  <div v-if="password.mode === 'random'" class="panel">
    <label class="row">
      <span>长度</span>
      <output>{{ password.random.length }}</output>
    </label>
    <input v-model.number="password.random.length" type="range" min="4" max="64" />

    <div class="types">
      <label v-for="t in TYPES" :key="t.key" class="chip" :class="{ on: password.random[t.key] }">
        <input v-model="password.random[t.key]" type="checkbox" />
        <span>{{ t.label }}</span>
      </label>
    </div>

    <label class="row toggle">
      <input v-model="password.random.excludeAmbiguous" type="checkbox" />
      <span>排除易混淆字符 <em>O0oIl1|</em></span>
    </label>

    <label class="row toggle">
      <input v-model="password.random.noRepeat" type="checkbox" />
      <span>字符不重复</span>
    </label>

    <label class="row stack">
      <span class="dim">排除指定字符</span>
      <input v-model="password.random.customExclude" type="text" placeholder="例如 &lt;&gt;&amp;" spellcheck="false" autocomplete="off" />
    </label>
  </div>

  <div v-else-if="password.mode === 'phrase'" class="panel">
    <label class="row">
      <span>词数</span>
      <output>{{ password.phrase.words }}</output>
    </label>
    <input v-model.number="password.phrase.words" type="range" :min="MIN_WORDS" :max="MAX_WORDS" />

    <div class="row">
      <span>分隔符</span>
      <span class="seg">
        <button
          v-for="s in SEPARATORS"
          :key="s.value"
          :class="{ on: password.phrase.separator === s.value }"
          @click="password.phrase.separator = s.value"
        >{{ s.label }}</button>
      </span>
    </div>

    <label class="row toggle">
      <input v-model="password.phrase.capitalize" type="checkbox" />
      <span>首字母大写</span>
    </label>

    <label class="row toggle">
      <input v-model="password.phrase.addNumber" type="checkbox" />
      <span>末尾追加一位数字</span>
    </label>

    <p class="hint">词库 {{ WORDLIST_SIZE }} 词，每词约 10.3 bits。分隔符与大小写不增加强度。</p>
  </div>

  <div v-else class="panel">
    <label class="row">
      <span>位数</span>
      <output>{{ password.pin.length }}</output>
    </label>
    <input v-model.number="password.pin.length" type="range" min="3" max="12" />
    <div class="seg">
      <button
        v-for="n in PIN_PRESETS"
        :key="n"
        :class="{ on: password.pin.length === n }"
        @click="password.pin.length = n"
      >{{ n }} 位</button>
    </div>
    <p class="hint">纯数字强度很低，仅适合有锁定次数限制的场景（手机、门禁）。</p>
  </div>
</template>

<style scoped>
.modes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
.types {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
</style>

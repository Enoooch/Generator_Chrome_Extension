<script setup>
import {
  STYLES,
  SEPARATORS,
  CASINGS,
  MAX_LENGTHS,
  MIN_RANDOM_LEN,
  MAX_RANDOM_LEN,
  MIN_NUMBER_LEN,
  MAX_NUMBER_LEN,
  separatorApplies,
  ADJECTIVE_COUNT,
  NOUN_COUNT,
} from '../lib/username.js'

const props = defineProps({
  username: { type: Object, required: true },
})
</script>

<template>
  <nav class="styles seg">
    <button
      v-for="s in STYLES"
      :key="s.key"
      :class="{ on: username.style === s.key }"
      @click="username.style = s.key"
    >
      {{ s.label }}
    </button>
  </nav>

  <div class="panel">
    <template v-if="username.style === 'random'">
      <label class="row">
        <span>长度</span>
        <output>{{ username.length }}</output>
      </label>
      <input
        v-model.number="username.length"
        type="range"
        :min="MIN_RANDOM_LEN"
        :max="MAX_RANDOM_LEN"
      />
    </template>

    <template v-else>
      <div class="row">
        <span :class="{ dim: !separatorApplies(username) }">分隔符</span>
        <span class="seg">
          <button
            v-for="s in SEPARATORS"
            :key="s.value"
            :class="{ on: username.separator === s.value }"
            :disabled="!separatorApplies(username)"
            @click="username.separator = s.value"
          >{{ s.label }}</button>
        </span>
      </div>

      <div class="row">
        <span>大小写</span>
        <span class="seg">
          <button
            v-for="c in CASINGS"
            :key="c.key"
            :class="{ on: username.casing === c.key }"
            @click="username.casing = c.key"
          >{{ c.label }}</button>
        </span>
      </div>

      <label v-if="username.style === 'word'" class="row toggle">
        <input v-model="username.addNumber" type="checkbox" />
        <span>末尾追加数字</span>
      </label>
    </template>

    <template v-if="username.style === 'wordNumber' || (username.style === 'word' && username.addNumber)">
      <label class="row">
        <span>数字位数</span>
        <output>{{ username.numberLength }}</output>
      </label>
      <input
        v-model.number="username.numberLength"
        type="range"
        :min="MIN_NUMBER_LEN"
        :max="MAX_NUMBER_LEN"
      />
    </template>

    <label v-if="username.style === 'random'" class="row toggle">
      <input v-model="username.letterFirst" type="checkbox" />
      <span>首字符必须是字母</span>
    </label>

    <div class="row">
      <span>长度上限</span>
      <span class="seg">
        <button
          v-for="n in MAX_LENGTHS"
          :key="n"
          :class="{ on: username.maxLength === n }"
          @click="username.maxLength = n"
        >{{ n === 0 ? '不限' : n }}</button>
      </span>
    </div>

    <p v-if="username.style === 'word'" class="hint">
      {{ ADJECTIVE_COUNT }} 个形容词 × {{ NOUN_COUNT }} 个名词。用户名是公开的，
      不需要强度 —— 好念、好拼、符合站点规则才是目标。
    </p>
    <p v-else-if="username.style === 'wordNumber'" class="hint">
      {{ NOUN_COUNT }} 个名词加随机数字，比双词形式短，适合有长度限制的站点。
    </p>
    <p v-else class="hint">
      纯小写字母和数字，兼容性最好，但不好记也不好口述。
    </p>
  </div>
</template>

<style scoped>
.styles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
</style>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  maxLength: { type: Number, default: 512 },
  label: { type: String, default: '结果，可直接编辑' },
})
const emit = defineEmits(['update:modelValue'])

// 按字符类别着色。textarea 无法给自己的文字上色，所以下面用一层等宽镜像 <pre> 承载颜色。
const segments = computed(() =>
  [...props.modelValue].map((c) => ({
    c,
    type: /\d/.test(c) ? 'digit' : /[a-zA-Z]/.test(c) ? 'letter' : 'symbol',
  }))
)

function onInput(e) {
  // 换行在密码和用户名里都没有意义，粘贴多行时直接抹平
  emit('update:modelValue', e.target.value.replace(/[\r\n]+/g, '').slice(0, props.maxLength))
}
</script>

<template>
  <div class="editor">
    <pre class="mirror" aria-hidden="true"><span
      v-for="(s, i) in segments" :key="i" :class="s.type">{{ s.c }}</span></pre>
    <textarea
      :value="modelValue"
      :aria-label="label"
      spellcheck="false"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
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
</style>

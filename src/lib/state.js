// 配置的唯一来源：默认值、存档校验、以及「按当前配置生成」的分发。
// popup 和 service worker 都走这里，两条路径不会漂移。

import { generatePassword, GenerateError } from './generator.js'
import { generatePassphrase, passphraseBits, SEPARATORS as PHRASE_SEPARATORS } from './passphrase.js'
import {
  generateUsername,
  STYLES,
  CASINGS,
  MAX_LENGTHS,
  SEPARATORS as NAME_SEPARATORS,
} from './username.js'

export const TOOLS = [
  { key: 'password', label: '密码' },
  { key: 'username', label: '用户名' },
]

export const MODES = [
  { key: 'random', label: '随机密码' },
  { key: 'phrase', label: '易记词组' },
  { key: 'pin', label: 'PIN' },
]

export const PIN_PRESETS = [4, 6, 8]

export const DEFAULTS = Object.freeze({
  tool: 'password',
  password: Object.freeze({
    mode: 'random',
    random: Object.freeze({
      length: 16,
      lower: true,
      upper: true,
      digit: true,
      symbol: true,
      excludeAmbiguous: false,
      noRepeat: false,
      customExclude: '',
    }),
    phrase: Object.freeze({
      words: 4,
      separator: '-',
      capitalize: false,
      addNumber: false,
    }),
    pin: Object.freeze({ length: 6 }),
  }),
  username: Object.freeze({
    style: 'word',
    separator: '-',
    casing: 'lower',
    addNumber: false,
    numberLength: 3,
    letterFirst: true,
    maxLength: 0,
    length: 10,
  }),
})

/** 按当前配置生成，抛 GenerateError 表示参数组合不合法 */
export function generate(state) {
  if (state.tool === 'username') return generateUsername(state.username)
  if (state.tool !== 'password') throw new GenerateError(`未知工具：${state.tool}`)

  const p = state.password
  switch (p.mode) {
    case 'phrase':
      return generatePassphrase(p.phrase)
    case 'pin':
      return generatePassword({ ...p.pin, lower: false, upper: false, symbol: false, digit: true })
    case 'random':
      return generatePassword(p.random)
    default:
      throw new GenerateError(`未知模式：${p.mode}`)
  }
}

// ---------- 存档校验 ----------
//
// 存档可能来自旧版本，也可能被手工改坏。三层防线缺一不可：
//   1. 类型必须与默认值一致  —— 挡住 length: "999"
//   2. 枚举字段必须在白名单里 —— 挡住 mode: "evil"（typeof 检查放它过）
//   3. 数值必须落在合法区间   —— 挡住 length: 1e9，否则弹窗一开就是报错状态

const enumOf = (list, key = 'key') => list.map((x) => x[key])

const ENUMS = {
  tool: enumOf(TOOLS),
  mode: enumOf(MODES),
  style: enumOf(STYLES),
  casing: enumOf(CASINGS),
}

const RANGES = {
  'password.random.length': [4, 64],
  'password.phrase.words': [3, 10],
  'password.pin.length': [3, 12],
  'username.length': [4, 20],
  'username.numberLength': [1, 4],
}

function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback
}

/** 合并一组扁平配置。`allowed` 给出该组内枚举字段的白名单 */
function mergeGroup(defaults, src, path, allowed = {}) {
  const out = { ...defaults }
  if (!src || typeof src !== 'object') return out

  for (const [key, def] of Object.entries(defaults)) {
    const v = src[key]
    if (typeof v !== typeof def) continue
    if (typeof v === 'number' && !Number.isFinite(v)) continue

    if (allowed[key]) {
      if (!allowed[key].includes(v)) continue
    } else if (typeof v === 'number') {
      const range = RANGES[`${path}.${key}`]
      if (range && (v < range[0] || v > range[1])) continue
    }
    out[key] = v
  }
  return out
}

export function withDefaults(saved) {
  const s = saved && typeof saved === 'object' ? saved : {}
  const p = s.password && typeof s.password === 'object' ? s.password : {}

  return {
    tool: pickEnum(s.tool, ENUMS.tool, DEFAULTS.tool),
    password: {
      mode: pickEnum(p.mode, ENUMS.mode, DEFAULTS.password.mode),
      random: mergeGroup(DEFAULTS.password.random, p.random, 'password.random'),
      phrase: mergeGroup(DEFAULTS.password.phrase, p.phrase, 'password.phrase', {
        separator: PHRASE_SEPARATORS.map((x) => x.value),
      }),
      pin: mergeGroup(DEFAULTS.password.pin, p.pin, 'password.pin'),
    },
    username: mergeGroup(DEFAULTS.username, s.username, 'username', {
      style: ENUMS.style,
      casing: ENUMS.casing,
      separator: NAME_SEPARATORS.map((x) => x.value),
      maxLength: MAX_LENGTHS,
    }),
  }
}

export { passphraseBits, GenerateError }

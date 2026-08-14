// 三种生成模式的统一入口。popup 和 service worker 都用这里，保证行为一致。

import { generatePassword, GenerateError } from './generator.js'
import { generatePassphrase, passphraseBits } from './passphrase.js'

export const MODES = [
  { key: 'random', label: '随机密码' },
  { key: 'phrase', label: '易记词组' },
  { key: 'pin', label: 'PIN' },
]

export const PIN_PRESETS = [4, 6, 8]

/** 所有默认值的唯一来源；恢复默认、首次启动、存档补字段都读它 */
export const DEFAULTS = Object.freeze({
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
})

/** 按当前模式生成，抛 GenerateError 表示参数不合法 */
export function generate(state) {
  switch (state.mode) {
    case 'phrase':
      return generatePassphrase(state.phrase)
    case 'pin':
      return generatePassword({
        ...state.pin,
        lower: false,
        upper: false,
        symbol: false,
        digit: true,
      })
    case 'random':
      return generatePassword(state.random)
    default:
      throw new GenerateError(`未知模式：${state.mode}`)
  }
}

/**
 * 深合并存档与默认值。
 *
 * 只接受默认值里已存在的键，且类型必须一致 —— 存档可能来自旧版本，也可能被手工改坏，
 * 让脏数据流进生成器会导致抛错或静默生成弱密码。
 */
export function withDefaults(saved) {
  const out = {
    mode: DEFAULTS.mode,
    random: { ...DEFAULTS.random },
    phrase: { ...DEFAULTS.phrase },
    pin: { ...DEFAULTS.pin },
  }
  if (!saved || typeof saved !== 'object') return out

  if (MODES.some((m) => m.key === saved.mode)) out.mode = saved.mode

  for (const group of ['random', 'phrase', 'pin']) {
    const src = saved[group]
    if (!src || typeof src !== 'object') continue
    for (const [k, def] of Object.entries(DEFAULTS[group])) {
      const v = src[k]
      if (typeof v === typeof def && !(typeof v === 'number' && !Number.isFinite(v))) {
        out[group][k] = v
      }
    }
  }
  return out
}

export { passphraseBits, GenerateError }

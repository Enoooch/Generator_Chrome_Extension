// 纯函数密码生成器：不依赖 DOM / Vue / Chrome API，可单独测试。

export const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digit: '0123456789',
  symbol: '!@#$%^&*()-_=+[]{};:,.<>?/~',
}

// 视觉上容易混淆的字符
export const AMBIGUOUS = 'O0oIl1|`\'";:.,'

/**
 * 无模偏的 [0, max) 随机整数。
 *
 * 直接用 `getRandomValues() % max` 会让前 (2^32 % max) 个值多出现一次，
 * 字符集长度不是 2 的幂时（比如 26、62、88）就存在可测的分布偏移。
 * 这里用拒绝采样：落进尾部残缺区间的样本直接丢弃重抽。
 */
export function randomInt(max) {
  if (max <= 0) throw new RangeError('max must be > 0')
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  let v
  do {
    crypto.getRandomValues(buf)
    v = buf[0]
  } while (v >= limit)
  return v % max
}

/** Fisher-Yates 洗牌，同样使用 CSPRNG */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 按选项组装最终可用的字符池。
 * @returns {{ pools: string[], all: string }} pools 为每个启用类别过滤后的子集
 */
export function buildPools(options) {
  const {
    lower = true,
    upper = true,
    digit = true,
    symbol = true,
    excludeAmbiguous = false,
    customExclude = '',
  } = options

  const excluded = new Set(
    (excludeAmbiguous ? AMBIGUOUS : '') + customExclude
  )
  const filter = (s) => [...s].filter((c) => !excluded.has(c)).join('')

  const enabled = { lower, upper, digit, symbol }
  const pools = Object.keys(CHARSETS)
    .filter((k) => enabled[k])
    .map((k) => filter(CHARSETS[k]))
    .filter((s) => s.length > 0) // 某个类别被排除光了就整体丢弃

  return { pools, all: pools.join('') }
}

export class GenerateError extends Error {}

/**
 * 生成密码。
 *
 * 保证：每个启用且非空的字符类别在结果中至少出现一次。做法是先从每个池各取
 * 一个字符占位，剩余长度从合并池取，最后整体洗牌 —— 这样既满足约束，位置又
 * 不可预测（不会出现「符号总在末尾」这类模式）。
 *
 * @param {object} options
 * @param {number} options.length 目标长度
 * @param {boolean} [options.noRepeat] 结果中不出现重复字符
 * @returns {string}
 */
export function generatePassword(options = {}) {
  const { length = 16, noRepeat = false } = options
  const { pools, all } = buildPools(options)

  if (pools.length === 0) {
    throw new GenerateError('至少需要选择一种字符类型')
  }
  if (length < pools.length) {
    throw new GenerateError(`长度至少为 ${pools.length}，才能容纳所有已选类型`)
  }
  if (noRepeat && length > all.length) {
    throw new GenerateError(`可用字符仅 ${all.length} 个，无法生成不重复的 ${length} 位密码`)
  }

  const used = new Set()
  const pick = (pool) => {
    if (!noRepeat) return pool[randomInt(pool.length)]
    const avail = [...pool].filter((c) => !used.has(c))
    // 上面的长度校验只保证了合并池够用，单个类别仍可能被先耗尽
    if (avail.length === 0) throw new GenerateError('可用字符不足，无法生成不重复的密码')
    const c = avail[randomInt(avail.length)]
    used.add(c)
    return c
  }

  const chars = pools.map(pick)
  while (chars.length < length) chars.push(pick(all))

  return shuffle(chars).join('')
}

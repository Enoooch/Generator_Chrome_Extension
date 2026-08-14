import { buildPools } from './generator.js'
import { passphraseBits } from './passphrase.js'

const LEVELS = [
  { min: 0, key: 'weak', label: '弱', color: '#ef4444' },
  { min: 45, key: 'fair', label: '中', color: '#f59e0b' },
  { min: 70, key: 'strong', label: '强', color: '#22c55e' },
  { min: 100, key: 'best', label: '极强', color: '#06b6d4' },
]

const CAP_BITS = 128 // 进度条满格对应的熵

function levelFor(bits) {
  let level = LEVELS[0]
  for (const l of LEVELS) if (bits >= l.min) level = l
  return level
}

function pack(bits, extra = {}) {
  return {
    bits: Math.round(bits),
    percent: Math.min(100, Math.round((bits / CAP_BITS) * 100)),
    ...levelFor(bits),
    ...extra,
  }
}

/**
 * 已知生成参数时的**精确**熵值。
 *
 * 因为密码由 CSPRNG 均匀抽样产生，log2(空间大小) 就是攻击者的真实猜测成本，
 * 不存在「看起来复杂但其实可猜」的问题。
 */
export function estimate(state) {
  if (state.mode === 'phrase') {
    return pack(passphraseBits(state.phrase), { exact: true })
  }
  const opts =
    state.mode === 'pin'
      ? { ...state.pin, lower: false, upper: false, symbol: false, digit: true }
      : state.random
  const { all } = buildPools(opts)
  const bits = all.length > 1 ? (opts.length ?? 0) * Math.log2(all.length) : 0
  return pack(bits, { exact: true })
}

const ASCII_SYMBOLS = 33 // 可打印 ASCII 中的标点符号数量

/** log2(C(n, k))，用连乘累加算，避免阶乘溢出 */
function log2Binom(n, k) {
  if (k <= 0 || k >= n) return 0
  let acc = 0
  for (let i = 1; i <= k; i++) acc += Math.log2((n - k + i) / i)
  return acc
}

/**
 * 手工编辑后只能对着字符串**估算**，且结果是上限而非真实强度。
 *
 * 任何基于字符串的评估都无法知道它是怎么来的："Password123!" 和随机 12 位在字符构成上
 * 完全一致，但前者在字典攻击下瞬间破解。这里取两个上界里的较小值：
 *
 *   1. 类别空间：len × log2(池大小)
 *   2. 实际用到的字符种类 k：len × log2(k) + log2(C(池大小, k))
 *      —— 即「先从池里选出哪 k 个字符，再用这 k 个排出长度 len 的串」
 *
 * 第二项专门用来压掉 "aaaaaaaa" 这类退化输入（k=1 时它退化为 log2(26)≈4.7 bits，
 * 正好等于 26 个候选串的真实熵）。必须带上 log2(C(池,k)) 这一项：漏掉它就变成纯粹的
 * len × log2(k)，会把随机密码也误判 —— 16 位随机串天然只有约 16 种字符，log2(16)=4
 * 远小于 log2(95)=6.6，强度会被凭空砍掉三分之一。
 *
 * 而且第二项只在 k ≤ len/2 时才启用。它是退化检测器，不该干预正常输入：8 位随机串里
 * 偶然出现一两个重复字符是常态（"Xq)S)3bq" 就有两处），无条件套用会让它比生成时的
 * 精确熵还低几 bits，用户看到「刚生成的密码一编辑就掉分」只会困惑。
 *
 * 对人工挑选的密码仍然偏高（不做字典检测），所以 UI 必须标成「估算上限」。
 */
export function estimateFromString(str) {
  if (!str) return pack(0, { exact: false })

  const chars = [...str]
  const len = chars.length
  let pool = 0
  if (/[a-z]/.test(str)) pool += 26
  if (/[A-Z]/.test(str)) pool += 26
  if (/\d/.test(str)) pool += 10
  if (/[!-/:-@[-`{-~]/.test(str)) pool += ASCII_SYMBOLS
  // 非 ASCII 字符按实际出现的种类数计入，避免给 emoji 之类凭空塞一个大池
  const exotic = new Set(chars.filter((c) => c.charCodeAt(0) > 126))
  pool += exotic.size

  const distinct = new Set(chars).size
  let bits = len * Math.log2(Math.max(pool, 2))

  if (distinct * 2 <= len) {
    bits = Math.min(bits, len * Math.log2(distinct) + log2Binom(pool, distinct))
  }

  return pack(bits, { exact: false })
}

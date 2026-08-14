import { randomInt, GenerateError } from './generator.js'
import { ADJECTIVES, NOUNS } from './username-words.js'

export const STYLES = [
  { key: 'word', label: '形容词+名词' },
  { key: 'wordNumber', label: '单词+数字' },
  { key: 'random', label: '随机字符' },
]

// 用户名不能含空格，所以这里的分隔符集合和词组密码的不同
export const SEPARATORS = [
  { value: '', label: '无' },
  { value: '-', label: '-' },
  { value: '_', label: '_' },
  { value: '.', label: '.' },
]

export const CASINGS = [
  { key: 'lower', label: '全小写' },
  { key: 'capital', label: '首字母大写' },
  { key: 'camel', label: 'camelCase' },
]

/** 0 表示不限制。常见站点的上限集中在 15/20/30 */
export const MAX_LENGTHS = [0, 15, 20, 30]

export const MIN_RANDOM_LEN = 4
export const MAX_RANDOM_LEN = 20
export const MIN_NUMBER_LEN = 1
export const MAX_NUMBER_LEN = 4

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
const ALNUM = LETTERS + '0123456789'

/** 两张词表里最短的词，用于给「另一个词」留出长度预算 */
const MIN_ADJ = Math.min(...ADJECTIVES.map((w) => w.length))
const MIN_NOUN = Math.min(...NOUNS.map((w) => w.length))

function pick(pool) {
  return pool[randomInt(pool.length)]
}

/** 从池中抽一个长度不超过 maxLen 的词；maxLen 为 null 表示不限 */
function pickFitting(pool, maxLen, what) {
  if (maxLen == null) return pick(pool)
  const fit = pool.filter((w) => w.length <= maxLen)
  if (fit.length === 0) {
    throw new GenerateError(`长度上限太小，放不下一个${what}`)
  }
  return fit[randomInt(fit.length)]
}

function digits(n) {
  let out = ''
  for (let i = 0; i < n; i++) out += String(randomInt(10))
  return out
}

function applyCasing(words, casing) {
  const cap = (w) => w[0].toUpperCase() + w.slice(1)
  switch (casing) {
    case 'capital':
      return words.map(cap)
    case 'camel':
      return words.map((w, i) => (i === 0 ? w : cap(w)))
    default:
      return words
  }
}

/**
 * 生成用户名。
 *
 * 与密码不同，用户名是公开的，熵不是目标 —— 好念、好拼、符合站点规则才是。所以这里
 * 不做「每类字符至少一个」之类的约束，长度上限也用**缩小候选池**的方式满足，而不是
 * 生成后截断：截断会把 swift-otter 砍成 swift-ot，可读性正是这个模式唯一的价值。
 *
 * @param {object} o
 * @param {'word'|'wordNumber'|'random'} [o.style]
 * @param {string} [o.separator]
 * @param {'lower'|'capital'|'camel'} [o.casing]
 * @param {boolean} [o.addNumber] 仅 word 风格：末尾追加数字
 * @param {number} [o.numberLength] 追加数字的位数
 * @param {boolean} [o.letterFirst] 首字符必须是字母（大量站点的硬性规则）
 * @param {number} [o.maxLength] 0 表示不限
 * @param {number} [o.length] 仅 random 风格：总长度
 */
export function generateUsername(o = {}) {
  const {
    style = 'word',
    separator = '-',
    casing = 'lower',
    addNumber = false,
    numberLength = 3,
    letterFirst = true,
    maxLength = 0,
    length = 10,
  } = o

  const cap = maxLength > 0 ? maxLength : null

  if (style === 'random') {
    const want = cap == null ? length : Math.min(length, cap)
    if (want < MIN_RANDOM_LEN) {
      throw new GenerateError(`长度上限太小，至少需要 ${MIN_RANDOM_LEN} 个字符`)
    }
    let out = letterFirst ? pick([...LETTERS]) : pick([...ALNUM])
    while (out.length < want) out += pick([...ALNUM])
    return out
  }

  if (style === 'wordNumber') {
    const num = digits(numberLength)
    const budget = cap == null ? null : cap - num.length
    if (budget != null && budget < MIN_NOUN) {
      throw new GenerateError('长度上限太小，放不下一个单词加数字')
    }
    const [noun] = applyCasing([pickFitting(NOUNS, budget, '名词')], casing)
    return noun + num
  }

  if (style !== 'word') throw new GenerateError(`未知风格：${style}`)

  const num = addNumber ? digits(numberLength) : ''
  // camelCase 的全部意义就是在没有分隔符的情况下标出词边界，两者同时存在自相矛盾
  // （会生成 cozy-Ring 这种四不像），所以这里让大小写风格覆盖分隔符。
  const sep = casing === 'camel' ? '' : separator
  // 两个词加分隔符和数字后必须落在上限内，所以先给形容词留出名词的最小长度
  const wordBudget = cap == null ? null : cap - num.length - sep.length
  if (wordBudget != null && wordBudget < MIN_ADJ + MIN_NOUN) {
    throw new GenerateError('长度上限太小，放不下两个单词')
  }
  const adj = pickFitting(ADJECTIVES, wordBudget == null ? null : wordBudget - MIN_NOUN, '形容词')
  const noun = pickFitting(NOUNS, wordBudget == null ? null : wordBudget - adj.length, '名词')

  return applyCasing([adj, noun], casing).join(sep) + num
}

/** camelCase 下分隔符不生效，界面据此把分隔符按钮置灰 */
export function separatorApplies({ style = 'word', casing = 'lower' } = {}) {
  return style === 'word' && casing !== 'camel'
}

/** 组合总数，用于在界面上说明这个配置有多少种可能 */
export function usernameCombos({ style = 'word', numberLength = 3, addNumber = false, length = 10 } = {}) {
  switch (style) {
    case 'random':
      return 26 * Math.pow(36, Math.max(0, length - 1))
    case 'wordNumber':
      return NOUNS.length * Math.pow(10, numberLength)
    default:
      return ADJECTIVES.length * NOUNS.length * (addNumber ? Math.pow(10, numberLength) : 1)
  }
}

/**
 * 站点兼容性提示。用户名不需要强度条 —— 它是公开的，熵没有意义 ——
 * 真正会让人卡住的是各家站点五花八门的字符和长度规则。
 */
export function describeUsername(name) {
  const notes = []
  if (!name) return { length: 0, notes }

  if (/^[^a-zA-Z]/.test(name)) notes.push('以非字母开头，部分站点不接受')
  if (/[.]/.test(name)) notes.push('含点号，部分站点不接受')
  if (/[-]/.test(name)) notes.push('含连字符，部分站点不接受')
  if (name.length > 20) notes.push('超过 20 字符，部分站点会截断')
  else if (name.length < 4) notes.push('少于 4 字符，多数站点要求更长')

  return { length: name.length, notes }
}

export const ADJECTIVE_COUNT = ADJECTIVES.length
export const NOUN_COUNT = NOUNS.length

export { GenerateError }

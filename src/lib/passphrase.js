import { WORDS } from './wordlist.js'
import { randomInt, GenerateError } from './generator.js'

export const SEPARATORS = [
  { value: '-', label: '-' },
  { value: '.', label: '.' },
  { value: '_', label: '_' },
  { value: ' ', label: '空格' },
  { value: '', label: '无' },
]

export const MIN_WORDS = 3
export const MAX_WORDS = 10

/**
 * 生成 Diceware 风格的易记词组，如 acid-lunar-crop-9。
 *
 * 每个词独立均匀抽取（允许重复）—— 这是刻意的：一旦禁止重复，后续每个词的
 * 候选集就会缩小，实际熵反而低于 words × log2(WORDS.length)，而且强度条会高估。
 *
 * @param {object} o
 * @param {number} [o.words] 词数
 * @param {string} [o.separator] 分隔符
 * @param {boolean} [o.capitalize] 每词首字母大写
 * @param {boolean} [o.addNumber] 末尾追加一位数字
 */
export function generatePassphrase(o = {}) {
  const {
    words = 4,
    separator = '-',
    capitalize = false,
    addNumber = false,
  } = o

  if (!Number.isInteger(words) || words < MIN_WORDS || words > MAX_WORDS) {
    throw new GenerateError(`词数需在 ${MIN_WORDS}-${MAX_WORDS} 之间`)
  }

  const parts = Array.from({ length: words }, () => {
    const w = WORDS[randomInt(WORDS.length)]
    return capitalize ? w[0].toUpperCase() + w.slice(1) : w
  })

  if (addNumber) parts.push(String(randomInt(10)))

  return parts.join(separator)
}

/**
 * 词组熵：words × log2(词库大小)，追加数字再加 log2(10)。
 *
 * 分隔符和首字母大写都不计入 —— 它们是固定变换，攻击者已知生成规则时不增加猜测难度。
 */
export function passphraseBits({ words = 4, addNumber = false } = {}) {
  return words * Math.log2(WORDS.length) + (addNumber ? Math.log2(10) : 0)
}

export const WORDLIST_SIZE = WORDS.length

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WORDS } from '../src/lib/wordlist.js'
import { generatePassphrase, passphraseBits } from '../src/lib/passphrase.js'
import { DEFAULTS, generate, withDefaults, GenerateError } from '../src/lib/modes.js'
import { estimate, estimateFromString } from '../src/lib/strength.js'

const REPEAT = 200

// ---------- 词库 ----------

test('词库无重复、无非法字符、无连字符', () => {
  assert.equal(new Set(WORDS).size, WORDS.length, '存在重复词会静默降低熵')
  assert.ok(WORDS.every((w) => /^[a-z]{3,5}$/.test(w)))
  assert.ok(WORDS.length >= 1024, `词库仅 ${WORDS.length} 词，太小`)
})

// ---------- 词组 ----------

test('词组结构正确', () => {
  for (let i = 0; i < REPEAT; i++) {
    const pw = generatePassphrase({ words: 4, separator: '-' })
    const parts = pw.split('-')
    assert.equal(parts.length, 4, pw)
    assert.ok(parts.every((p) => WORDS.includes(p)), pw)
  }
})

test('首字母大写与追加数字', () => {
  const pw = generatePassphrase({ words: 3, separator: '.', capitalize: true, addNumber: true })
  const parts = pw.split('.')
  assert.equal(parts.length, 4)
  assert.ok(parts.slice(0, 3).every((p) => /^[A-Z][a-z]{2,4}$/.test(p)), pw)
  assert.match(parts[3], /^\d$/, pw)
})

test('空分隔符下词组仍是纯小写字母', () => {
  const pw = generatePassphrase({ words: 5, separator: '' })
  assert.match(pw, /^[a-z]+$/, pw)
})

test('词数越界抛错', () => {
  assert.throws(() => generatePassphrase({ words: 2 }), GenerateError)
  assert.throws(() => generatePassphrase({ words: 11 }), GenerateError)
  assert.throws(() => generatePassphrase({ words: 4.5 }), GenerateError)
})

test('词组允许重复词（禁止重复会高估熵）', () => {
  // 3 词里出现重复的概率约 0.23%，抽 8000 次几乎必然命中（漏检概率 ~1e-8）。
  // 如果实现悄悄做了去重，这里会挂。
  let sawRepeat = false
  for (let i = 0; i < 8000 && !sawRepeat; i++) {
    const parts = generatePassphrase({ words: 3, separator: ' ' }).split(' ')
    if (new Set(parts).size < parts.length) sawRepeat = true
  }
  assert.ok(sawRepeat, '未观察到重复词，实现可能错误地做了去重')
})

test('词组熵值与词库规模一致', () => {
  const bits = passphraseBits({ words: 4 })
  assert.ok(Math.abs(bits - 4 * Math.log2(WORDS.length)) < 1e-9)
  // 追加数字应恰好多出 log2(10)
  const withNum = passphraseBits({ words: 4, addNumber: true })
  assert.ok(Math.abs(withNum - bits - Math.log2(10)) < 1e-9)
})

// ---------- 模式分发 ----------

test('三种模式都能生成', () => {
  const s = withDefaults(null)
  assert.equal(generate({ ...s, mode: 'random' }).length, 16)
  assert.match(generate({ ...s, mode: 'pin' }), /^\d{6}$/)
  assert.equal(generate({ ...s, mode: 'phrase' }).split('-').length, 4)
})

test('PIN 只含数字且长度可变', () => {
  for (const length of [3, 4, 6, 12]) {
    for (let i = 0; i < 50; i++) {
      const pin = generate({ ...withDefaults(null), mode: 'pin', pin: { length } })
      assert.match(pin, new RegExp(`^\\d{${length}}$`), pin)
    }
  }
})

test('未知模式抛 GenerateError', () => {
  assert.throws(() => generate({ ...withDefaults(null), mode: 'nope' }), GenerateError)
})

// ---------- 存档合并 ----------

test('withDefaults 补齐缺失字段', () => {
  const s = withDefaults({ mode: 'pin', random: { length: 30 } })
  assert.equal(s.mode, 'pin')
  assert.equal(s.random.length, 30)
  assert.equal(s.random.symbol, DEFAULTS.random.symbol)
  assert.deepEqual(s.phrase, { ...DEFAULTS.phrase })
})

test('withDefaults 拒绝脏数据', () => {
  const dirty = withDefaults({
    mode: 'evil',
    random: { length: '999', symbol: 'yes', bogus: 1 },
    phrase: null,
    pin: { length: NaN },
  })
  assert.equal(dirty.mode, DEFAULTS.mode)
  assert.equal(dirty.random.length, DEFAULTS.random.length, '字符串长度不该被接受')
  assert.equal(dirty.random.symbol, DEFAULTS.random.symbol)
  assert.ok(!('bogus' in dirty.random), '未知字段不该混入')
  assert.equal(dirty.pin.length, DEFAULTS.pin.length, 'NaN 不该被接受')
  // 合并结果必须可以直接喂给生成器
  assert.doesNotThrow(() => generate(dirty))
})

test('withDefaults 不会被调用方改坏默认值', () => {
  const s = withDefaults(null)
  s.random.length = 99
  assert.equal(DEFAULTS.random.length, 16, 'DEFAULTS 被写穿了')
})

// ---------- 强度 ----------

test('精确熵：随机与词组', () => {
  const s = withDefaults(null)
  const rnd = estimate({ ...s, mode: 'random' })
  assert.ok(rnd.exact)
  assert.equal(rnd.bits, Math.round(16 * Math.log2(26 + 26 + 10 + 27)))

  const ph = estimate({ ...s, mode: 'phrase' })
  assert.ok(ph.exact)
  assert.equal(ph.bits, Math.round(4 * Math.log2(WORDS.length)))
})

test('字符串估算：标为非精确，且压制退化输入', () => {
  // 16 位四类混合，不该被「字符种类少」的上界误伤
  const strong = estimateFromString('K9#mQ2$vL7@xR4!z')
  assert.equal(strong.exact, false)
  assert.ok(strong.bits > 100, `实际 ${strong.bits}`)

  // 只有一种字符：按类别算是 8×log2(26)≈38 bits，子集上界应压到 log2(26)≈4.7
  const degenerate = estimateFromString('aaaaaaaa')
  assert.ok(degenerate.bits <= 5, `实际 ${degenerate.bits}`)
  assert.equal(degenerate.key, 'weak')

  assert.equal(estimateFromString('').bits, 0)
})

test('字符串估算对随机密码不低于其真实熵', () => {
  // 上界必须真的是上界：随机生成的密码，估算值不应低于生成时的精确熵
  const s = withDefaults(null)
  for (const length of [8, 12, 16, 24, 32]) {
    s.random.length = length
    const exact = estimate({ ...s, mode: 'random' }).bits
    for (let i = 0; i < 30; i++) {
      const pw = generate({ ...s, mode: 'random' })
      const guess = estimateFromString(pw).bits
      assert.ok(guess >= exact, `len=${length} 估算 ${guess} < 精确 ${exact}：${pw}`)
    }
  }
})

test('强度分级单调不降', () => {
  let last = -1
  for (const len of [4, 8, 12, 16, 24, 40, 64]) {
    const s = withDefaults(null)
    s.random.length = len
    const bits = estimate({ ...s, mode: 'random' }).bits
    assert.ok(bits > last)
    last = bits
  }
})

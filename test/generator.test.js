import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generatePassword,
  buildPools,
  randomInt,
  GenerateError,
  AMBIGUOUS,
} from '../src/lib/generator.js'

const REPEAT = 300

test('长度符合要求', () => {
  for (const length of [4, 8, 16, 33, 64]) {
    assert.equal(generatePassword({ length }).length, length)
  }
})

test('每个启用的字符类型至少出现一次', () => {
  const opts = { length: 4, lower: true, upper: true, digit: true, symbol: true }
  for (let i = 0; i < REPEAT; i++) {
    const pw = generatePassword(opts)
    assert.match(pw, /[a-z]/, pw)
    assert.match(pw, /[A-Z]/, pw)
    assert.match(pw, /\d/, pw)
    assert.match(pw, /[^a-zA-Z0-9]/, pw)
  }
})

test('未启用的字符类型不出现', () => {
  for (let i = 0; i < REPEAT; i++) {
    const pw = generatePassword({ length: 20, upper: false, symbol: false })
    assert.match(pw, /^[a-z0-9]+$/, pw)
  }
})

test('排除易混淆字符生效', () => {
  const banned = new Set(AMBIGUOUS)
  for (let i = 0; i < REPEAT; i++) {
    const pw = generatePassword({ length: 30, excludeAmbiguous: true })
    assert.ok([...pw].every((c) => !banned.has(c)), pw)
  }
})

test('自定义排除生效', () => {
  for (let i = 0; i < REPEAT; i++) {
    const pw = generatePassword({ length: 30, customExclude: 'abcXYZ123' })
    assert.ok([...pw].every((c) => !'abcXYZ123'.includes(c)), pw)
  }
})

test('不重复模式无重复字符', () => {
  for (let i = 0; i < REPEAT; i++) {
    const pw = generatePassword({ length: 40, noRepeat: true })
    assert.equal(new Set(pw).size, 40, pw)
  }
})

test('无效参数抛 GenerateError', () => {
  assert.throws(
    () => generatePassword({ lower: false, upper: false, digit: false, symbol: false }),
    GenerateError
  )
  // 长度 3 装不下 4 个类型
  assert.throws(() => generatePassword({ length: 3 }), GenerateError)
  // 只有 10 个数字，凑不出 20 位不重复
  assert.throws(
    () => generatePassword({ length: 20, noRepeat: true, lower: false, upper: false, symbol: false }),
    GenerateError
  )
})

test('某一类被自定义排除清空后不再计入必选', () => {
  const { pools } = buildPools({ customExclude: '0123456789' })
  assert.equal(pools.length, 3)
  const pw = generatePassword({ length: 3, customExclude: '0123456789' })
  assert.equal(pw.length, 3)
})

test('randomInt 覆盖全值域且无越界', () => {
  const max = 7
  const seen = new Set()
  for (let i = 0; i < 5000; i++) {
    const v = randomInt(max)
    assert.ok(Number.isInteger(v) && v >= 0 && v < max)
    seen.add(v)
  }
  assert.equal(seen.size, max)
})

test('randomInt 分布无明显偏移', () => {
  // 62 不是 2 的幂，取模法在这里会露出偏移；拒绝采样应当均匀。
  const max = 62
  const n = 62_000
  const counts = new Array(max).fill(0)
  for (let i = 0; i < n; i++) counts[randomInt(max)]++
  const expected = n / max
  // 卡方检验，df=61，p=0.001 的临界值约 112
  const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0)
  assert.ok(chi2 < 112, `chi2=${chi2.toFixed(1)} 偏离过大`)
})

test('同样参数不会生成相同密码', () => {
  const set = new Set()
  for (let i = 0; i < 200; i++) set.add(generatePassword({ length: 16 }))
  assert.equal(set.size, 200)
})

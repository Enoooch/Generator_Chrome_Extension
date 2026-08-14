import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADJECTIVES, NOUNS } from '../src/lib/username-words.js'
import {
  generateUsername,
  describeUsername,
  usernameCombos,
  separatorApplies,
  MAX_LENGTHS,
  GenerateError,
} from '../src/lib/username.js'
import { GenerateError as GE } from '../src/lib/generator.js'

const REPEAT = 200

// ---------- 词表 ----------

test('词表无重复、形状合法、无粘连', () => {
  for (const [name, list] of [['形容词', ADJECTIVES], ['名词', NOUNS]]) {
    assert.equal(new Set(list).size, list.length, `${name}存在重复`)
    assert.ok(list.every((w) => /^[a-z]{3,8}$/.test(w)), `${name}含非法词：${list.filter((w) => !/^[a-z]{3,8}$/.test(w))}`)
    assert.ok(list.length >= 200, `${name}只有 ${list.length} 个，太少`)
  }
})

test('词表不含空串（折行拼接漏空格会产生）', () => {
  assert.ok(!ADJECTIVES.includes(''))
  assert.ok(!NOUNS.includes(''))
})

// ---------- word 风格 ----------

test('word 风格是 形容词+分隔符+名词', () => {
  for (let i = 0; i < REPEAT; i++) {
    const name = generateUsername({ style: 'word', separator: '-' })
    const [adj, noun, ...rest] = name.split('-')
    assert.equal(rest.length, 0, name)
    assert.ok(ADJECTIVES.includes(adj), name)
    assert.ok(NOUNS.includes(noun), name)
  }
})

test('大小写变换', () => {
  const lower = generateUsername({ style: 'word', separator: '-', casing: 'lower' })
  assert.match(lower, /^[a-z]+-[a-z]+$/, lower)

  const capital = generateUsername({ style: 'word', separator: '', casing: 'capital' })
  assert.match(capital, /^[A-Z][a-z]+[A-Z][a-z]+$/, capital)

  const camel = generateUsername({ style: 'word', separator: '', casing: 'camel' })
  assert.match(camel, /^[a-z]+[A-Z][a-z]+$/, camel)
})

test('追加数字位数正确', () => {
  for (const numberLength of [1, 2, 3, 4]) {
    const name = generateUsername({ style: 'word', separator: '-', addNumber: true, numberLength })
    assert.match(name, new RegExp(`^[a-z]+-[a-z]+\\d{${numberLength}}$`), name)
  }
})

// ---------- wordNumber 风格 ----------

test('wordNumber 是单个名词加数字', () => {
  for (let i = 0; i < REPEAT; i++) {
    const name = generateUsername({ style: 'wordNumber', numberLength: 3 })
    const m = name.match(/^([a-z]+)(\d{3})$/)
    assert.ok(m, name)
    assert.ok(NOUNS.includes(m[1]), name)
  }
})

// ---------- random 风格 ----------

test('random 风格长度与字符集正确', () => {
  for (const length of [4, 8, 12, 20]) {
    for (let i = 0; i < 30; i++) {
      const name = generateUsername({ style: 'random', length, letterFirst: false })
      assert.equal(name.length, length, name)
      assert.match(name, /^[a-z0-9]+$/, name)
    }
  }
})

test('letterFirst 保证首字符是字母', () => {
  // 关掉时应当能观察到数字开头，否则这个开关等于没生效
  let sawDigitFirst = false
  for (let i = 0; i < 500; i++) {
    assert.match(generateUsername({ style: 'random', length: 8, letterFirst: true }), /^[a-z]/)
    if (/^\d/.test(generateUsername({ style: 'random', length: 8, letterFirst: false }))) {
      sawDigitFirst = true
    }
  }
  assert.ok(sawDigitFirst, 'letterFirst=false 时从未出现数字开头，开关可能没接上')
})

// ---------- 长度上限 ----------

test('所有风格都遵守长度上限', () => {
  for (const maxLength of MAX_LENGTHS.filter((n) => n > 0)) {
    for (const style of ['word', 'wordNumber', 'random']) {
      for (let i = 0; i < 60; i++) {
        const name = generateUsername({
          style,
          maxLength,
          separator: '-',
          addNumber: true,
          numberLength: 3,
          length: 20,
        })
        assert.ok(name.length <= maxLength, `${style} maxLength=${maxLength} 生成了 ${name.length} 字符：${name}`)
      }
    }
  }
})

test('上限内仍然是完整单词，不是被截断的', () => {
  // 截断会把 swift-otter 砍成 swift-ot，可读性正是这个模式唯一的价值
  for (let i = 0; i < REPEAT; i++) {
    const name = generateUsername({ style: 'word', separator: '-', maxLength: 15 })
    const [adj, noun] = name.split('-')
    assert.ok(ADJECTIVES.includes(adj), `形容词被截断：${name}`)
    assert.ok(NOUNS.includes(noun), `名词被截断：${name}`)
  }
})

test('上限过小时抛 GenerateError 而不是死循环或返回残缺结果', () => {
  assert.throws(() => generateUsername({ style: 'word', maxLength: 5, separator: '-' }), GE)
  assert.throws(() => generateUsername({ style: 'random', maxLength: 2, length: 10 }), GE)
  assert.throws(
    () => generateUsername({ style: 'wordNumber', maxLength: 4, numberLength: 4 }),
    GE
  )
})

test('未知风格抛 GenerateError', () => {
  assert.throws(() => generateUsername({ style: 'nope' }), GE)
})

// ---------- 组合数与提示 ----------

test('组合数与词表规模一致', () => {
  assert.equal(usernameCombos({ style: 'word' }), ADJECTIVES.length * NOUNS.length)
  assert.equal(
    usernameCombos({ style: 'word', addNumber: true, numberLength: 2 }),
    ADJECTIVES.length * NOUNS.length * 100
  )
  assert.equal(usernameCombos({ style: 'wordNumber', numberLength: 3 }), NOUNS.length * 1000)
})

test('兼容性提示命中该命中的情况', () => {
  assert.deepEqual(describeUsername('').notes, [])
  assert.equal(describeUsername('swiftotter').notes.length, 0, '干净的用户名不该有提示')

  assert.ok(describeUsername('9lives').notes.some((n) => n.includes('非字母开头')))
  assert.ok(describeUsername('swift.otter').notes.some((n) => n.includes('点号')))
  assert.ok(describeUsername('swift-otter').notes.some((n) => n.includes('连字符')))
  assert.ok(describeUsername('a'.repeat(25)).notes.some((n) => n.includes('截断')))
  assert.ok(describeUsername('ab').notes.some((n) => n.includes('少于')))
  assert.equal(describeUsername('swiftotter').length, 10)
})

test('GenerateError 是同一个类，跨模块 instanceof 成立', () => {
  assert.equal(GenerateError, GE)
})

test('camelCase 覆盖分隔符（两者同时存在会生成 cozy-Ring 这种四不像）', () => {
  for (let i = 0; i < REPEAT; i++) {
    const name = generateUsername({ style: 'word', separator: '-', casing: 'camel' })
    assert.match(name, /^[a-z]+[A-Z][a-z]+$/, name)
    assert.ok(!name.includes('-'), name)
  }
  // 其他大小写风格不受影响
  assert.match(
    generateUsername({ style: 'word', separator: '-', casing: 'capital' }),
    /^[A-Z][a-z]+-[A-Z][a-z]+$/
  )
  assert.equal(separatorApplies({ style: 'word', casing: 'camel' }), false)
  assert.equal(separatorApplies({ style: 'word', casing: 'lower' }), true)
  assert.equal(separatorApplies({ style: 'wordNumber', casing: 'lower' }), false)
})

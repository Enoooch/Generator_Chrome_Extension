// 只持久化「生成参数」，绝不持久化密码本身。
// 非扩展环境（比如 vite dev 直接开页面）降级到 localStorage，方便调试。

// 结构变更时换 key，而不是写迁移逻辑：存的只是几个生成参数，丢掉的代价就是回到默认值一次。
//   v2  扁平结构 -> { mode, random, phrase, pin }
//   v3  加入用户名工具 -> { tool, password: {...}, username: {...} }
const KEY = 'pwgen:options:v3'

const hasChrome = typeof chrome !== 'undefined' && chrome.storage?.local

export async function loadOptions() {
  try {
    if (hasChrome) return (await chrome.storage.local.get(KEY))[KEY] ?? null
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function saveOptions(options) {
  try {
    if (hasChrome) await chrome.storage.local.set({ [KEY]: options })
    else localStorage.setItem(KEY, JSON.stringify(options))
  } catch {
    // 存不上就算了，不影响生成
  }
}

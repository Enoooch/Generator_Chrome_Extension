// Service worker：只负责右键菜单。没有常驻逻辑，空闲时会被浏览器回收，
// 所以事件监听必须在顶层同步注册，不能放进异步回调里。

import { generate, withDefaults, GenerateError } from './lib/modes.js'
import { loadOptions } from './lib/storage.js'

const ROOT = 'pwgen-root'
const ITEMS = [
  { id: 'pwgen-random', title: '随机密码', mode: 'random' },
  { id: 'pwgen-phrase', title: '易记词组', mode: 'phrase' },
  { id: 'pwgen-pin', title: 'PIN 数字', mode: 'pin' },
]
const MODE_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i.mode]))

chrome.runtime.onInstalled.addListener(() => {
  // 先清空：重装/更新时重复 create 同一个 id 会报错
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: ROOT,
      title: '生成密码并填入',
      contexts: ['editable'], // 只在可输入元素上出现
    })
    for (const { id, title } of ITEMS) {
      chrome.contextMenus.create({ id, parentId: ROOT, title, contexts: ['editable'] })
    }
  })
})

/**
 * 注入到页面里执行 —— 必须是自包含的：executeScript 会把函数序列化后在目标页
 * 重新求值，闭包变量、外部 import 都拿不到。
 */
function fillFocusedField(value) {
  const el = document.activeElement
  if (!el) return

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // React 在元素原型上劫持了 value 的 setter 来追踪变更，直接 el.value = x
    // 会绕过它，导致界面显示了新值但组件 state 还是旧的、提交时又变回空。
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set
    if (setter) setter.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  } else if (el.isContentEditable) {
    el.textContent = value
    el.dispatchEvent(new InputEvent('input', { bubbles: true }))
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const mode = MODE_BY_ID[info.menuItemId]
  if (!mode || !tab?.id) return

  let value
  try {
    value = generate({ ...withDefaults(await loadOptions()), mode })
  } catch (e) {
    // 存档里的参数组合不合法（比如随机模式把所有字符类型都关了），无声跳过；
    // 没有 notifications 权限，这里没法提示，用户打开 popup 就会看到报错原因。
    if (e instanceof GenerateError) return
    throw e
  }

  try {
    await chrome.scripting.executeScript({
      // activeTab 权限由这次右键点击授予，只覆盖当前标签页，且用完即失效
      target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
      func: fillFocusedField,
      args: [value],
    })
  } catch {
    // chrome:// 、扩展商店等受保护页面禁止注入
  }
})

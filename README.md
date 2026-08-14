# 生成器 · Chrome 扩展

本地生成密码和用户名。不联网、不上传、不保存结果。

- **密码** —— 随机密码 / 易记词组（Diceware）/ PIN 数字
- **用户名** —— 形容词+名词 / 单词+数字 / 随机字符

## 开发

```bash
npm install
npm run build      # 产物在 dist/
npm run dev        # watch 模式，改完在扩展页点一次刷新即可
npm test           # 单元测试（45 项）
npm run icons      # 重新生成图标（改了 scripts/gen-icons.mjs 才需要）
```

## 加载到 Chrome

1. 打开 `chrome://extensions`
2. 右上角开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选择 **`dist/`** 目录（不是项目根目录）

## 为什么必须构建

MV3 扩展页面的 CSP 是 `script-src 'self'`，禁止 `eval` / `new Function`。
Vue 的浏览器全量版（`vue.global.js`）编译模板正是依赖 `new Function`，直接引入会在
运行时报错。构建步骤把模板预编译成 render 函数，产物用的是 runtime-only 版本，无 eval。

## 结构

```
popup.html               扩展弹窗入口
src/App.vue              整体布局、结果区、历史、状态
src/background.js        service worker，只负责右键菜单
src/components/          可编辑结果框、密码参数面板、用户名参数面板
src/lib/state.js         默认值 + 存档校验 + 按配置分发生成
src/lib/generator.js     随机密码（纯函数）
src/lib/passphrase.js    Diceware 词组
src/lib/wordlist.js      EFF 短词表 1295 词（CC BY 3.0 US）
src/lib/username.js      用户名生成
src/lib/username-words.js 形容词 312 + 名词 364（名词源自 corpora，CC0）
src/lib/strength.js      熵值计算
src/lib/storage.js       仅持久化生成参数
scripts/gen-icons.mjs    程序化生成图标，无依赖
public/manifest.json     MV3 清单
test/                    node --test
```

## 安全设计

- 随机源为 `crypto.getRandomValues()`，**不使用** `Math.random()`
- 用拒绝采样消除取模偏移。直接 `random % 62` 会让前若干个字符出现概率偏高，
  这个偏移可测量（`test/generator.test.js` 里有卡方检验）
- 随机模式保证每个已选字符类型至少出现一次，位置经 Fisher-Yates 洗牌，
  不会出现「符号固定在末尾」这类可预测模式
- 词组模式**允许重复词**。禁止重复会让后续每个词的候选集缩小，实际熵低于
  `词数 × log2(词库)`，反而导致强度条高估 —— 有专门的测试守着这条
- `chrome.storage` 只写生成参数，**不写密码**；历史记录仅存内存，关闭弹窗即消失
- 权限：`storage` `contextMenus` `activeTab` `scripting`。没有 host permissions，
  没有常驻 content script —— 页面注入只在你点击右键菜单时发生，且仅限当前标签页

## 强度计算的两种口径

| 情况 | 口径 | 显示 |
|---|---|---|
| 直接生成的密码 | **精确**熵，`log2(生成空间)` | `104 bits` |
| 手工编辑过 | **估算上限**，见下 | `≤72 bits · 估算` |

密码由 CSPRNG 均匀抽样时，`log2(空间大小)` 就是攻击者的真实猜测成本，没有误差。

一旦手工改过，就只能对着字符串反推，而字符串本身不携带来源信息 ——
`Password123!` 和随机 12 位在字符构成上完全一致，但前者秒破。所以取两个上界的较小值：

1. 类别空间：`len × log2(池大小)`
2. 字符子集：`len × log2(k) + log2(C(池大小, k))`，k 为实际用到的字符种类数

第 2 项用来压制 `aaaaaaaa` 这类退化输入（k=1 时结果是 `log2(26)≈4.7 bits`，正好等于
26 个候选串的真实熵）。两个细节都是踩过坑才定下来的：

- `log2(C(池,k))` 不能省。只用 `len × log2(k)` 会把随机密码也误判 —— 16 位随机串天然
  只有约 16 种字符，`log2(16)=4` 远小于 `log2(95)=6.6`，强度会被凭空砍掉三分之一。
- 第 2 项只在 `k ≤ len/2` 时启用。它是退化检测器，不该干预正常输入：8 位随机串里偶然
  出现一两个重复字符是常态，无条件套用会让估算值比生成时的精确熵还低几 bits，
  用户看到「刚生成的密码一编辑就掉分」只会困惑。

有测试断言「随机生成的密码，估算值不低于其精确熵」守这两点。

不做字典检测，所以对人工挑选的密码仍会高估，UI 因此明确标注为估算上限。

## 右键菜单填充

在网页的输入框上右键 →「生成并填入」→ 选随机密码 / 易记词组 / PIN / 用户名。
每一项都写死自己的类型，不跟随弹窗当前停在哪个 tab —— 菜单点的是哪个就生成哪个，
其余参数（长度、字符集、分隔符……）沿用你在弹窗里存下的配置。

填充时会走 `HTMLInputElement.prototype` 上的原生 value setter 再派发 `input`/`change`
事件。直接 `el.value = x` 会绕过 React 劫持的 setter，导致界面显示了新值但组件 state
仍是旧的，提交时又变回空。

已知限制：靠 `document.activeElement` 定位目标输入框（Chrome 右键会聚焦表单控件）。
少数自绘输入控件的站点可能定位不到，此时不会有任何反应。要更可靠就得常驻
content script 监听 `contextmenu`，但那需要全站 host permissions，权衡后没有采用。

## 用户名为什么不显示强度

用户名是公开的，熵没有意义，显示强度条反而会让人误解这个功能的用途。真正让人卡住的是
各家站点五花八门的规则，所以那一栏改成字符数加兼容性提示（含点号、非字母开头、超长等）。

长度上限用**缩小候选池**的方式满足，不是生成后截断 —— 截断会把 `swift-otter` 砍成
`swift-ot`，而可读性正是这个模式唯一的价值。放不下就抛错，不返回残缺结果。

`camelCase` 会覆盖分隔符设置：它的全部意义就是在没有分隔符的情况下标出词边界，
两者同时生效会得到 `cozy-Ring` 这种四不像。

形容词表是手工挑的，没有直接用 corpora 的 `adjs.json` —— 那份表混着非形容词
（confuse、prank、process）和一批负面或带冒犯色彩的词（diseased、razed、swarthy）。
这些词会挂在用户的身份上，靠黑名单过滤是打地鼠。

## popup 的尺寸约束

`src/style.css` 里 `html`/`body` 那几条 overflow 规则是在修一个具体 bug，别随手删：
文档一旦自己滚动，Chrome 会重算 popup 宽度并把它拉宽到最多 800px，而 `body` 仍是
340px，右侧留下大片空白。现在滚动交给内层 `.scroll` 容器，文档永不滚动。

## 已知范围

未实现：i18n（当前仅中文）、历史持久化（刻意不做）、密码强度的字典检测、
用户名可用性检查（需要联网，与「不上传」原则冲突）。

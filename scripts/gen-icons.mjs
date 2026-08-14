// 无依赖图标生成：程序化绘制一把锁，4x 超采样抗锯齿，手写 PNG 编码。
// 用法：npm run icons  ->  public/icons/icon{16,32,48,128}.png

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons')
const SIZES = [16, 32, 48, 128]
const SS = 4 // 超采样倍数

// ---------- 几何 ----------

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a, b, t) => a + (b - a) * t

/** 圆角矩形的有符号距离场，返回 <0 表示在内部 */
function sdRoundRect(x, y, x0, y0, x1, y1, r) {
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const hx = (x1 - x0) / 2 - r
  const hy = (y1 - y0) / 2 - r
  const dx = Math.abs(x - cx) - hx
  const dy = Math.abs(y - cy) - hy
  const ox = Math.max(dx, 0)
  const oy = Math.max(dy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r
}

/** 锁梁：上半圆环 */
function inShackle(x, y, cx, cy, rOuter, rInner) {
  if (y > cy) return false
  const d = Math.hypot(x - cx, y - cy)
  return d <= rOuter && d >= rInner
}

/** 锁孔：圆 + 向下收窄的槽 */
function inKeyhole(x, y) {
  if (Math.hypot(x - 0.5, y - 0.595) <= 0.052) return true
  if (y >= 0.595 && y <= 0.715) {
    const t = (y - 0.595) / 0.12
    const halfW = lerp(0.018, 0.032, t)
    return Math.abs(x - 0.5) <= halfW
  }
  return false
}

// ---------- 着色 ----------

const BG_TOP = [99, 102, 241] // indigo-500
const BG_BOTTOM = [139, 92, 246] // violet-500
const LOCK = [255, 255, 255]

/** 单个采样点的颜色，返回 [r,g,b,a] */
function sample(x, y) {
  const inBg = sdRoundRect(x, y, 0, 0, 1, 1, 0.22) <= 0
  if (!inBg) return [0, 0, 0, 0]

  const bg = BG_TOP.map((c, i) => Math.round(lerp(c, BG_BOTTOM[i], y)))

  const onLock =
    inShackle(x, y, 0.5, 0.475, 0.17, 0.107) ||
    sdRoundRect(x, y, 0.255, 0.435, 0.745, 0.8, 0.055) <= 0

  if (onLock && !inKeyhole(x, y)) return [...LOCK, 255]
  return [...bg, 255]
}

// ---------- 渲染 ----------

function render(size) {
  const px = Buffer.alloc(size * size * 4)
  const inv = 1 / (size * SS)
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [sr, sg, sb, sa] = sample(
            (pxi * SS + sx + 0.5) * inv,
            (py * SS + sy + 0.5) * inv
          )
          const w = sa / 255
          r += sr * w; g += sg * w; b += sb * w; a += sa
        }
      }
      const n = SS * SS
      const alpha = a / n
      const i = (py * size + pxi) * 4
      // 直通 alpha：颜色按不透明采样点的权重平均，避免边缘发黑
      const wsum = a / 255 || 1
      px[i] = Math.round(clamp01(r / wsum / 255) * 255)
      px[i + 1] = Math.round(clamp01(g / wsum / 255) * 255)
      px[i + 2] = Math.round(clamp01(b / wsum / 255) * 255)
      px[i + 3] = Math.round(alpha)
    }
  }
  return px
}

// ---------- PNG 编码 ----------

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, px) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // 10..12 = compression / filter / interlace，全部为 0

  // 每行前置一个 filter 字节（0 = None）
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT, { recursive: true })
for (const size of SIZES) {
  const file = `${OUT}/icon${size}.png`
  writeFileSync(file, encodePng(size, render(size)))
  console.log(`✓ icon${size}.png`)
}

/**
 * 编码探测与解码（平台无关的纯函数，主进程与单测共用）。
 *
 * 策略与《开发框架.md》5.1 / 6.7 一致：
 *   BOM → 严格 UTF-8 校验 → GB18030 回退 → 都不可靠时交给用户在弹框里选（带预览）
 */

export type SupportedEncoding = 'utf-8' | 'gb18030' | 'gbk' | 'big5' | 'utf-16le' | 'utf-16be'

export const SUPPORTED_ENCODINGS: SupportedEncoding[] = [
  'utf-8',
  'gb18030',
  'gbk',
  'big5',
  'utf-16le',
  'utf-16be',
]

export interface DecodeOutcome {
  text: string
  encoding: SupportedEncoding
  replacementRatio: number
  suspicious: boolean
}

const BOM_UTF8 = [0xef, 0xbb, 0xbf]
const BOM_UTF16LE = [0xff, 0xfe]
const BOM_UTF16BE = [0xfe, 0xff]

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false
  return prefix.every((b, i) => bytes[i] === b)
}

/** 返回 BOM 指示的编码与需跳过的字节数 */
export function detectBom(bytes: Uint8Array): { encoding: SupportedEncoding; offset: number } | null {
  if (startsWith(bytes, BOM_UTF8)) return { encoding: 'utf-8', offset: 3 }
  if (startsWith(bytes, BOM_UTF16LE)) return { encoding: 'utf-16le', offset: 2 }
  if (startsWith(bytes, BOM_UTF16BE)) return { encoding: 'utf-16be', offset: 2 }
  return null
}

/** 严格解码：出现非法字节即抛错，返回 null 表示「不是这个编码」 */
export function decodeStrict(bytes: Uint8Array, encoding: SupportedEncoding): string | null {
  try {
    const decoder = new TextDecoder(encoding, { fatal: true })
    return decoder.decode(bytes)
  } catch {
    return null
  }
}

/** 宽松解码：非法字节替换为 U+FFFD，并统计替换占比 */
export function decodeLossy(
  bytes: Uint8Array,
  encoding: SupportedEncoding,
): { text: string; replacementRatio: number } {
  const text = new TextDecoder(encoding, { fatal: false }).decode(bytes)
  let replacements = 0
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0xfffd) replacements++
  }
  const ratio = text.length === 0 ? 0 : replacements / text.length
  return { text, replacementRatio: ratio }
}

/**
 * 文本合理度：正常中文小说的字符几乎全部落在汉字 / ASCII 可见字符 / 常用标点 / 空白内。
 * 编码猜错时会出现大量生僻区字符与控制字符，据此判定「解码不可信」。
 */
export function textSanity(text: string): number {
  if (text.length === 0) return 0
  let good = 0
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    const isCjk = c >= 0x4e00 && c <= 0x9fff
    const isCjkExt = c >= 0x3400 && c <= 0x4dbf
    const isAsciiPrintable = c >= 0x20 && c <= 0x7e
    const isWhitespace = c === 0x09 || c === 0x0a || c === 0x0d || c === 0x20 || c === 0x3000
    const isPunct =
      (c >= 0x3001 && c <= 0x303f) || // 中文标点
      (c >= 0xff01 && c <= 0xff65) || // 全角标点
      (c >= 0x2000 && c <= 0x206f) || // 通用标点
      (c >= 0x00a0 && c <= 0x00ff) // 拉丁补充（常见于引号/破折号）
    if (isCjk || isCjkExt || isAsciiPrintable || isWhitespace || isPunct) good++
  }
  return good / text.length
}

/** 前 1024 字节中 NUL 占比：用于识别「无 BOM 的 UTF-16」 */
function nulRatio(bytes: Uint8Array): number {
  const window = bytes.subarray(0, Math.min(1024, bytes.length))
  if (window.length === 0) return 0
  let nuls = 0
  for (const b of window) if (b === 0) nuls++
  return nuls / window.length
}

/**
 * 自动判定编码并解码。判定顺序：BOM → 无 BOM 的 UTF-16（NUL 比例）→ 严格 UTF-8 → GB18030。
 * 任何一步出现替换字符或合理度过低，都标记 suspicious=true，由 UI 让用户选。
 */
export function decodeAuto(bytes: Uint8Array): DecodeOutcome {
  const bom = detectBom(bytes)
  if (bom) {
    const body = bytes.subarray(bom.offset)
    const strict = decodeStrict(body, bom.encoding)
    if (strict !== null) {
      return { text: strict, encoding: bom.encoding, replacementRatio: 0, suspicious: false }
    }
    const lossy = decodeLossy(body, bom.encoding)
    return {
      text: lossy.text,
      encoding: bom.encoding,
      replacementRatio: lossy.replacementRatio,
      suspicious: true,
    }
  }

  const nuls = nulRatio(bytes)
  if (nuls > 0.2) {
    // 无 BOM 的 UTF-16：按 NUL 出现的奇偶位置猜字节序
    const utf16: SupportedEncoding = bytes[1] === 0 ? 'utf-16le' : 'utf-16be'
    const strict = decodeStrict(bytes, utf16)
    if (strict !== null) {
      return { text: strict, encoding: utf16, replacementRatio: 0, suspicious: false }
    }
  }

  const strictUtf8 = decodeStrict(bytes, 'utf-8')
  if (strictUtf8 !== null) {
    // 严格 UTF-8 通过还要看合理度：全 0x00-0x7f 之外的乱码也可能「合法」
    if (textSanity(strictUtf8) >= 0.95) {
      return { text: strictUtf8, encoding: 'utf-8', replacementRatio: 0, suspicious: false }
    }
  }

  const gb = decodeLossy(bytes, 'gb18030')
  const sane = textSanity(gb.text)
  const clean = gb.replacementRatio === 0 && sane >= 0.95
  return {
    text: gb.text,
    encoding: 'gb18030',
    replacementRatio: gb.replacementRatio,
    suspicious: !clean,
  }
}

/** 生成编码候选列表（按可信度排序），供弹框预览与切换 */
export function buildCandidates(
  bytes: Uint8Array,
  limit = 200,
): { encoding: SupportedEncoding; preview: string; replacementRatio: number }[] {
  const rows = SUPPORTED_ENCODINGS.map((encoding) => {
    const { text, replacementRatio } = decodeLossy(bytes, encoding)
    const sane = textSanity(text)
    // 排序键：替换率 + 合理度惩罚
    const penalty = replacementRatio + (1 - sane) * 0.5
    return { encoding, preview: text.slice(0, limit), replacementRatio, sane, penalty }
  })
  rows.sort((a, b) => a.penalty - b.penalty)
  return rows.map(({ encoding, preview, replacementRatio }) => ({
    encoding,
    preview,
    replacementRatio,
  }))
}

/** 按指定编码解码（用户手动选择后使用） */
export function decodeWith(bytes: Uint8Array, encoding: SupportedEncoding): DecodeOutcome {
  const bom = detectBom(bytes)
  const bomMatches = bom && bom.encoding === encoding
  const body = bomMatches ? bytes.subarray(bom.offset) : bytes
  const strict = decodeStrict(body, encoding)
  if (strict !== null) {
    return { text: strict, encoding, replacementRatio: 0, suspicious: false }
  }
  const lossy = decodeLossy(body, encoding)
  return {
    text: lossy.text,
    encoding,
    replacementRatio: lossy.replacementRatio,
    suspicious: lossy.replacementRatio > 0,
  }
}

export function isSupportedEncoding(value: string): value is SupportedEncoding {
  return (SUPPORTED_ENCODINGS as string[]).includes(value)
}

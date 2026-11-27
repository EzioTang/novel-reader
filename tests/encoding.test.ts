import { describe, expect, it } from 'vitest'
import {
  buildCandidates,
  decodeAuto,
  decodeLossy,
  decodeStrict,
  decodeWith,
  detectBom,
  isSupportedEncoding,
  textSanity,
} from '../shared/encoding'

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)
/** GBK：中 = D6 D0，文 = CE C4 */
const GBK_ZHONG_WEN = new Uint8Array([0xd6, 0xd0, 0xce, 0xc4])

describe('detectBom', () => {
  it('识别 UTF-8 BOM', () => {
    expect(detectBom(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toEqual({
      encoding: 'utf-8',
      offset: 3,
    })
  })

  it('识别 UTF-16LE / BE BOM', () => {
    expect(detectBom(new Uint8Array([0xff, 0xfe, 0x41, 0x00]))?.encoding).toBe('utf-16le')
    expect(detectBom(new Uint8Array([0xfe, 0xff, 0x00, 0x41]))?.encoding).toBe('utf-16be')
  })

  it('无 BOM 时返回 null', () => {
    expect(detectBom(utf8('中文'))).toBeNull()
  })
})

describe('decodeAuto', () => {
  it('带 BOM 的 UTF-8', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('第一章')])
    const result = decodeAuto(bytes)
    expect(result.text).toBe('第一章')
    expect(result.encoding).toBe('utf-8')
    expect(result.suspicious).toBe(false)
  })

  it('不带 BOM 的 UTF-8', () => {
    const result = decodeAuto(utf8('第一章 风起\n正文'))
    expect(result.text).toBe('第一章 风起\n正文')
    expect(result.encoding).toBe('utf-8')
    expect(result.suspicious).toBe(false)
  })

  it('GBK 中文自动回退到 gb18030 且不标记可疑', () => {
    const result = decodeAuto(GBK_ZHONG_WEN)
    expect(result.text).toBe('中文')
    expect(result.encoding).toBe('gb18030')
    expect(result.suspicious).toBe(false)
  })

  it('UTF-16LE（带 BOM）', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x2d, 0x4e, 0x87, 0x65])
    const result = decodeAuto(bytes)
    expect(result.text).toBe('中文')
    expect(result.encoding).toBe('utf-16le')
  })

  it('乱码无法判定时标记 suspicious', () => {
    const result = decodeAuto(new Uint8Array([0xff, 0xff, 0xff, 0x41]))
    expect(result.suspicious).toBe(true)
  })
})

describe('decodeWith', () => {
  it('按用户指定编码解码 GBK 字节', () => {
    const result = decodeWith(GBK_ZHONG_WEN, 'gb18030')
    expect(result.text).toBe('中文')
    expect(result.suspicious).toBe(false)
  })

  it('用错编码时替换字符暴露问题', () => {
    const result = decodeWith(GBK_ZHONG_WEN, 'utf-8')
    expect(result.suspicious).toBe(true)
    expect(result.text).not.toBe('中文')
  })
})

describe('buildCandidates', () => {
  it('把能正确解出预览的编码排在前面', () => {
    const candidates = buildCandidates(GBK_ZHONG_WEN)
    expect(candidates.length).toBeGreaterThanOrEqual(4)
    expect(candidates[0].encoding === 'gb18030' || candidates[0].encoding === 'gbk').toBe(true)
    expect(candidates[0].preview).toBe('中文')
  })
})

describe('工具函数', () => {
  it('decodeStrict 对非法字节返回 null', () => {
    expect(decodeStrict(new Uint8Array([0xff, 0xff]), 'utf-8')).toBeNull()
  })

  it('decodeLossy 统计替换字符占比', () => {
    const { replacementRatio } = decodeLossy(new Uint8Array([0xff, 0xff]), 'utf-8')
    expect(replacementRatio).toBeGreaterThan(0)
  })

  it('textSanity 对正常中文接近 1，对控制字符很低', () => {
    expect(textSanity('第一章 风起，正文。')).toBeGreaterThan(0.95)
    expect(textSanity('\u0001\u0002\u0003')).toBeLessThan(0.2)
  })

  it('isSupportedEncoding 只认白名单', () => {
    expect(isSupportedEncoding('gbk')).toBe(true)
    expect(isSupportedEncoding('utf-32')).toBe(false)
  })
})

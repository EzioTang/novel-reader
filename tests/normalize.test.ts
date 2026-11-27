import { describe, expect, it } from 'vitest'
import {
  looksLikeHeading,
  normalizeText,
  splitLines,
  stripDecoration,
} from '../src/core/text/normalize'

describe('normalizeText', () => {
  it('去掉 BOM、统一换行、全角空格转半角', () => {
    const raw = '\uFEFF　第一章　风起\r\n\r\n正文\r\n'
    expect(normalizeText(raw)).toBe(' 第一章 风起\n\n正文')
  })

  it('去掉首尾空行与行尾空白', () => {
    expect(normalizeText('\n\n第一段   \n第二段\n\n')).toBe('第一段\n第二段')
  })
})

describe('splitLines', () => {
  it('保留每行在全文中的偏移', () => {
    const text = '第一章\n正文一\n正文二'
    const lines = splitLines(text)
    expect(lines.map((l) => l.text)).toEqual(['第一章', '正文一', '正文二'])
    expect(lines[0].start).toBe(0)
    expect(lines[1].start).toBe(4)
    expect(lines[2].start).toBe(8)
    expect(lines[2].end).toBe(11)
  })

  it('文本以换行结尾时不产生零长度幽灵行', () => {
    expect(splitLines('a\nb\n')).toHaveLength(2)
  })
})

describe('stripDecoration', () => {
  it.each([
    ['★ 第一章 风起', '第一章 风起'],
    ['【第一章 风起】', '第一章 风起'],
    ['●第一章', '第一章'],
    ['《第一章》', '第一章'],
    ['第 1 章', '第 1 章'],
  ])('%s → %s', (input, expected) => {
    expect(stripDecoration(input)).toBe(expected)
  })
})

describe('looksLikeHeading', () => {
  it('接受独立的短标题行', () => {
    expect(looksLikeHeading('第一章 风起')).toBe(true)
    expect(looksLikeHeading('楔子')).toBe(true)
  })

  it('拒绝正文句子、对话与超长行', () => {
    expect(looksLikeHeading('他说第一章的时候，我还在想别的事。')).toBe(false)
    expect(looksLikeHeading('“第一章 风起”')).toBe(false)
    expect(looksLikeHeading('第一章 ' + '很长的标题'.repeat(20))).toBe(false)
  })
})

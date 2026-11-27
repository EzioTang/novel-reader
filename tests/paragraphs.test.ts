import { describe, expect, it } from 'vitest'
import { paragraphsOf } from '../src/modules/reader/paragraphs'

const TEXT = '第一章 风起\n\n第一段正文。\n第二段正文。\n\n第二章 雨落\n\n第三段正文。'

describe('paragraphsOf', () => {
  it('跳过章节标题行，只返回正文段落', () => {
    const start = TEXT.indexOf('第一章')
    const end = TEXT.indexOf('第二章')
    const paragraphs = paragraphsOf(TEXT, start, end, '第一章 风起')
    expect(paragraphs.map((p) => p.text)).toEqual(['第一段正文。', '第二段正文。'])
  })

  it('偏移是全文绝对偏移，可直接用于锚点定位', () => {
    const start = TEXT.indexOf('第一章')
    const end = TEXT.indexOf('第二章')
    const [first] = paragraphsOf(TEXT, start, end, '第一章 风起')
    expect(first.offset).toBe(TEXT.indexOf('第一段正文。'))
  })

  it('标题带装饰符号时也能识别并跳过', () => {
    const text = '★ 第一章 风起\n\n正文。'
    const paragraphs = paragraphsOf(text, 0, text.length, '第一章 风起')
    expect(paragraphs.map((p) => p.text)).toEqual(['正文。'])
  })

  it('不传标题时保留全部非空行（校正页需要看到标题行）', () => {
    const text = '第一章\n正文。'
    expect(paragraphsOf(text, 0, text.length).map((p) => p.text)).toEqual(['第一章', '正文。'])
  })
})

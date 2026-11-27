import { describe, expect, it } from 'vitest'
import {
  FONT_FAMILIES,
  LINE_HEIGHT,
  PAGE_MARGIN,
  PARAGRAPH_SPACING,
  applyFontSizeWithLineHeight,
  clampLineHeight,
  clampPageMargin,
  clampParagraphSpacing,
  effectiveFontSize,
  normalizeFontFamily,
  resolveFontStack,
} from '../src/core/settings/typography'
import { DEFAULT_READER_SETTINGS } from '../src/core/types'

describe('字体族', () => {
  it('只认四个 key，历史值回退默认', () => {
    expect(normalizeFontFamily('kai')).toBe('kai')
    expect(normalizeFontFamily('system-ui')).toBe('serif')
    expect(normalizeFontFamily(undefined)).toBe('serif')
  })

  it('每个 key 都能解析出带回退栈的 font-family', () => {
    for (const family of FONT_FAMILIES) {
      const stack = resolveFontStack(family.value)
      expect(stack.length).toBeGreaterThan(0)
      expect(stack).toContain(family.stack.split(',')[0].trim())
    }
    expect(resolveFontStack('serif')).toContain('Songti')
  })
})

describe('排版参数边界', () => {
  it('行距夹在 1.2–3.0', () => {
    expect(clampLineHeight(1)).toBe(1.2)
    expect(clampLineHeight(9)).toBe(3)
    expect(clampLineHeight(1.85)).toBe(1.85)
    expect(clampLineHeight(Number.NaN)).toBe(LINE_HEIGHT.default)
  })

  it('段距夹在 0–2em，页边距夹在 8–96px', () => {
    expect(clampParagraphSpacing(-1)).toBe(PARAGRAPH_SPACING.min)
    expect(clampParagraphSpacing(5)).toBe(PARAGRAPH_SPACING.max)
    expect(clampPageMargin(-10)).toBe(PAGE_MARGIN.min)
    expect(clampPageMargin(999)).toBe(PAGE_MARGIN.max)
  })
})

describe('字号与行距联动', () => {
  it('自动模式下改字号会重新派生行距', () => {
    const next = applyFontSizeWithLineHeight(DEFAULT_READER_SETTINGS, 30)
    expect(next.fontSize).toBe(30)
    expect(next.lineHeightAuto).toBe(true)
    expect(next.lineHeight).not.toBe(DEFAULT_READER_SETTINGS.lineHeight)
  })

  it('手动模式下改字号不动行距', () => {
    const manual = { ...DEFAULT_READER_SETTINGS, lineHeightAuto: false, lineHeight: 1.5 }
    const next = applyFontSizeWithLineHeight(manual, 32)
    expect(next.fontSize).toBe(32)
    expect(next.lineHeight).toBe(1.5)
  })
})

describe('单书字号', () => {
  it('有覆盖时优先用单书值，没有则回落全局', () => {
    const settings = { ...DEFAULT_READER_SETTINGS, fontSize: 20, fontSizeByBook: { a: 28 } }
    expect(effectiveFontSize(settings, 'a')).toBe(28)
    expect(effectiveFontSize(settings, 'b')).toBe(20)
    expect(effectiveFontSize(settings)).toBe(20)
  })

  it('覆盖值越界会被夹回 12–48', () => {
    const settings = { ...DEFAULT_READER_SETTINGS, fontSize: 20, fontSizeByBook: { a: 99 } }
    expect(effectiveFontSize(settings, 'a')).toBe(48)
  })
})

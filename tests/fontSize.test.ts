import { describe, expect, it } from 'vitest'
import {
  applyFontSize,
  canDecrease,
  canIncrease,
  clampFontSize,
  deriveLineHeight,
  readerMaxWidth,
  stepFontSize,
} from '../src/core/settings/fontSize'
import { DEFAULT_READER_SETTINGS, FONT_SIZE } from '../src/core/types'

describe('字号边界', () => {
  it('夹在 12–48 之间', () => {
    expect(clampFontSize(5)).toBe(12)
    expect(clampFontSize(60)).toBe(48)
    expect(clampFontSize(20.4)).toBe(20)
    expect(clampFontSize(Number.NaN)).toBe(FONT_SIZE.default)
  })

  it('步进调整到边界后不再变化', () => {
    expect(stepFontSize(20, 'increase')).toBe(21)
    expect(stepFontSize(20, 'decrease')).toBe(19)
    expect(stepFontSize(48, 'increase')).toBe(48)
    expect(stepFontSize(12, 'decrease')).toBe(12)
    expect(stepFontSize(33, 'reset')).toBe(FONT_SIZE.default)
  })

  it('可增/可减判断与边界一致', () => {
    expect(canIncrease(47)).toBe(true)
    expect(canIncrease(48)).toBe(false)
    expect(canDecrease(13)).toBe(true)
    expect(canDecrease(12)).toBe(false)
  })
})

describe('行距与排版派生', () => {
  it('行距落在 1.5–2.2 倍之间并随字号变大', () => {
    expect(deriveLineHeight(12)).toBe(1.5)
    expect(deriveLineHeight(20)).toBeGreaterThan(1.5)
    expect(deriveLineHeight(48)).toBe(2.2)
    expect(deriveLineHeight(40)).toBeGreaterThan(deriveLineHeight(24))
  })

  it('字号 ≥ 28px 时收窄正文宽度', () => {
    expect(readerMaxWidth(20)).toBe(760)
    expect(readerMaxWidth(28)).toBe(640)
  })
})

describe('applyFontSize', () => {
  it('只改字号并同步派生行距，不写入单书覆盖', () => {
    const next = applyFontSize(DEFAULT_READER_SETTINGS, 30)
    expect(next.fontSize).toBe(30)
    expect(next.lineHeight).toBe(deriveLineHeight(30))
    expect(next.fontSizeByBook).toBeUndefined()
    expect(next.pageMode).toBe('scroll')
  })
})

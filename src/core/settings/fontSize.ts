/** 字号与行距规则（《开发框架.md》7.3）。 */

import { FONT_SIZE, type ReaderSettings } from '../types'

export type FontSizeAction = 'increase' | 'decrease' | 'reset'

/** 夹到 12–48 区间 */
export function clampFontSize(size: number): number {
  if (!Number.isFinite(size)) return FONT_SIZE.default
  return Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, Math.round(size)))
}

/** 步进调整；越界时保持在边界 */
export function stepFontSize(current: number, action: FontSizeAction): number {
  switch (action) {
    case 'increase':
      return clampFontSize(current + FONT_SIZE.step)
    case 'decrease':
      return clampFontSize(current - FONT_SIZE.step)
    case 'reset':
      return FONT_SIZE.default
  }
}

/**
 * 行距随字号派生：`clamp(字号 × 0.085, 1.5, 2.2)`。
 * 文档写的是「字号 × 1.7」并 clamp 到 1.5–2.2，量纲上其实是 px 值；
 * 这里换算成 CSS 的倍数值（20px × 0.085 ≈ 1.7 倍），保证视觉行距与文档一致。
 */
export function deriveLineHeight(fontSize: number): number {
  const ratio = clampFontSize(fontSize) * 0.085
  return Math.min(2.2, Math.max(1.5, Math.round(ratio * 100) / 100))
}

/** 字号 ≥ 28px 时收窄正文最大宽度，避免一行过长 */
export function readerMaxWidth(fontSize: number): number {
  return fontSize >= 28 ? 640 : 760
}

export function canIncrease(size: number): boolean {
  return size < FONT_SIZE.max
}

export function canDecrease(size: number): boolean {
  return size > FONT_SIZE.min
}

/** 应用字号：同步派生行距，返回新的设置副本（不写入单书覆盖） */
export function applyFontSize(settings: ReaderSettings, size: number): ReaderSettings {
  const fontSize = clampFontSize(size)
  return { ...settings, fontSize, lineHeight: deriveLineHeight(fontSize) }
}

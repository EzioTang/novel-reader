/** 排版参数：字体族、行距、段距、页边距的取值与换算（纯函数）。 */

import type { FontFamilyKey, ReaderSettings } from '../types'
import { FONT_SIZE } from '../types'
import { clampFontSize, deriveLineHeight } from './fontSize'

export interface FontFamilyOption {
  value: FontFamilyKey
  label: string
  stack: string
}

export const FONT_FAMILIES: FontFamilyOption[] = [
  {
    value: 'serif',
    label: '宋体',
    stack: '"Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif',
  },
  {
    value: 'sans',
    label: '黑体',
    stack: '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif',
  },
  {
    value: 'kai',
    label: '楷体',
    stack: '"Kaiti SC", "STKaiti", "KaiTi", "楷体", serif',
  },
  {
    value: 'system',
    label: '系统默认',
    stack: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
]

/** 未知/历史值（如 v0.1 的 'system-ui'）一律回退到默认字体 */
export function resolveFontStack(key: string | undefined): string {
  const found = FONT_FAMILIES.find((f) => f.value === key)
  return (found ?? FONT_FAMILIES[0]).stack
}

export function normalizeFontFamily(key: string | undefined): FontFamilyKey {
  return FONT_FAMILIES.some((f) => f.value === key) ? (key as FontFamilyKey) : 'serif'
}

export const LINE_HEIGHT = {
  min: 1.2,
  max: 3,
  step: 0.05,
  default: 1.9,
} as const

export const PARAGRAPH_SPACING = {
  min: 0,
  max: 2,
  step: 0.1,
  default: 0.6,
} as const

export const PAGE_MARGIN = {
  min: 8,
  max: 96,
  step: 4,
  default: 32,
} as const

export function clampLineHeight(value: number): number {
  if (!Number.isFinite(value)) return LINE_HEIGHT.default
  return Math.min(LINE_HEIGHT.max, Math.max(LINE_HEIGHT.min, Math.round(value * 100) / 100))
}

export function clampParagraphSpacing(value: number): number {
  if (!Number.isFinite(value)) return PARAGRAPH_SPACING.default
  return Math.min(
    PARAGRAPH_SPACING.max,
    Math.max(PARAGRAPH_SPACING.min, Math.round(value * 100) / 100),
  )
}

export function clampPageMargin(value: number): number {
  if (!Number.isFinite(value)) return PAGE_MARGIN.default
  return Math.min(PAGE_MARGIN.max, Math.max(PAGE_MARGIN.min, Math.round(value)))
}

/** 字号变化时：自动模式重新派生行距，手动模式保留用户设定 */
export function applyFontSizeWithLineHeight(
  settings: ReaderSettings,
  size: number,
): ReaderSettings {
  const fontSize = clampFontSize(size)
  return {
    ...settings,
    fontSize,
    lineHeight: settings.lineHeightAuto ? deriveLineHeight(fontSize) : settings.lineHeight,
  }
}

/** 取某本书实际生效的字号（单书覆盖优先） */
export function effectiveFontSize(settings: ReaderSettings, bookId?: string): number {
  if (bookId) {
    const override = settings.fontSizeByBook?.[bookId]
    if (typeof override === 'number' && Number.isFinite(override)) return clampFontSize(override)
  }
  return clampFontSize(settings.fontSize)
}

export { FONT_SIZE }

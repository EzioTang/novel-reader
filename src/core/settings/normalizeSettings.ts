/** 设置迁移与校验：把历史版本（v0.1.x）或损坏的 localStorage 内容校正为合法设置。 */

import { DEFAULT_READER_SETTINGS, FONT_SIZE, type ReaderSettings } from '../types'
import { clampFontSize } from './fontSize'
import {
  clampLineHeight,
  clampPageMargin,
  clampParagraphSpacing,
  normalizeFontFamily,
} from './typography'

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function sanitizeBookFontSizes(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, size]) => key.length > 0 && typeof size === 'number' && Number.isFinite(size))
    .map(([key, size]) => [key, clampFontSize(size as number)] as const)
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/**
 * 兼容 v0.1.x 的已存数据：
 * - `fontFamily` 曾经存的是 CSS 值（如 `system-ui`），现在存 key；
 * - v0.1 没有 lineHeightAuto / paragraphSpacing / pageMargin / immersive* 字段；
 * - `pageMode` 恒为 scroll（横向分页在 v0.2 仍未启用）。
 */
export function normalizeSettings(input: unknown): ReaderSettings {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<ReaderSettings> & {
    fontFamily?: string
    lineHeight?: number
    paragraphSpacing?: number
    pageMargin?: number
  }

  const fontSize = clampFontSize(toNumber(raw.fontSize, FONT_SIZE.default))
  const theme = raw.theme
  const normalizedTheme =
    theme === 'light' || theme === 'dark' || theme === 'eye-care' || theme === 'system'
      ? theme
      : DEFAULT_READER_SETTINGS.theme

  return {
    fontFamily: normalizeFontFamily(raw.fontFamily),
    fontSize,
    lineHeight: clampLineHeight(toNumber(raw.lineHeight, DEFAULT_READER_SETTINGS.lineHeight)),
    lineHeightAuto: toBoolean(raw.lineHeightAuto, DEFAULT_READER_SETTINGS.lineHeightAuto),
    paragraphSpacing: clampParagraphSpacing(
      toNumber(raw.paragraphSpacing, DEFAULT_READER_SETTINGS.paragraphSpacing),
    ),
    pageMargin: clampPageMargin(toNumber(raw.pageMargin, DEFAULT_READER_SETTINGS.pageMargin)),
    theme: normalizedTheme,
    pageMode: 'scroll',
    immersiveReading: toBoolean(raw.immersiveReading, DEFAULT_READER_SETTINGS.immersiveReading),
    // 旧的 immersiveAutoReveal（默认 true = 自动隐藏）语义已反转，不再读取；
    // 新默认是「工具栏常驻」，需要隐藏的用户显式打开 immersiveAutoHide。
    immersiveAutoHide: toBoolean(
      raw.immersiveAutoHide,
      DEFAULT_READER_SETTINGS.immersiveAutoHide,
    ),
    autoNextChapter: toBoolean(raw.autoNextChapter, DEFAULT_READER_SETTINGS.autoNextChapter),
    fontSizeByBook: sanitizeBookFontSizes(raw.fontSizeByBook),
  }
}

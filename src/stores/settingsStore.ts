/** 阅读设置 store：字号/主题/排版/沉浸模式，写入 localStorage。 */

import { create } from 'zustand'
import type { ReaderSettings } from '../core/types'
import { clampFontSize } from '../core/settings/fontSize'
import { applyFontSizeWithLineHeight, clampLineHeight, clampPageMargin, clampParagraphSpacing } from '../core/settings/typography'
import { settingsRepository } from '../storage/db'

interface SettingsState {
  settings: ReaderSettings
  hydrate: () => void
  /** 全局字号（不改单书覆盖） */
  setFontSize: (size: number) => void
  setTheme: (theme: ReaderSettings['theme']) => void
  setFontFamily: (family: ReaderSettings['fontFamily']) => void
  setLineHeight: (value: number, auto?: boolean) => void
  setParagraphSpacing: (value: number) => void
  setPageMargin: (value: number) => void
  setImmersive: (immersive: boolean) => void
  setImmersiveAutoHide: (autoHide: boolean) => void
  setAutoNextChapter: (enabled: boolean) => void
  /** 单书字号覆盖 */
  setBookFontSize: (bookId: string, size: number) => void
  clearBookFontSize: (bookId: string) => void
  reset: () => void
}

function persist(settings: ReaderSettings): void {
  settingsRepository.save(settings)
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const patch = (next: ReaderSettings): void => {
    persist(next)
    set({ settings: next })
  }

  return {
    settings: { ...settingsRepository.load() },

    hydrate: () => set({ settings: { ...settingsRepository.load() } }),

    setFontSize: (size) => patch(applyFontSizeWithLineHeight(get().settings, size)),

    setTheme: (theme) => patch({ ...get().settings, theme }),

    setFontFamily: (family) => patch({ ...get().settings, fontFamily: family }),

    setLineHeight: (value, auto = false) =>
      patch({
        ...get().settings,
        lineHeight: auto ? get().settings.lineHeight : clampLineHeight(value),
        lineHeightAuto: auto,
      }),

    setParagraphSpacing: (value) =>
      patch({ ...get().settings, paragraphSpacing: clampParagraphSpacing(value) }),

    setPageMargin: (value) => patch({ ...get().settings, pageMargin: clampPageMargin(value) }),

    setImmersive: (immersive) => patch({ ...get().settings, immersiveReading: immersive }),

    setImmersiveAutoHide: (autoHide) =>
      patch({ ...get().settings, immersiveAutoHide: autoHide }),

    setAutoNextChapter: (enabled) => patch({ ...get().settings, autoNextChapter: enabled }),

    setBookFontSize: (bookId, size) => {
      const settings = get().settings
      const fontSize = clampFontSize(size)
      patch({
        ...settings,
        fontSizeByBook: { ...(settings.fontSizeByBook ?? {}), [bookId]: fontSize },
      })
    },

    clearBookFontSize: (bookId) => {
      const settings = get().settings
      if (!settings.fontSizeByBook || !(bookId in settings.fontSizeByBook)) return
      const next = { ...settings.fontSizeByBook }
      delete next[bookId]
      patch({ ...settings, fontSizeByBook: next })
    },

    reset: () => set({ settings: settingsRepository.load() }),
  }
})

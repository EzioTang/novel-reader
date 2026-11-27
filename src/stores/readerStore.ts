/** 阅读器 store：正文、章节、当前进度。进度节流写入由页面负责触发。 */

import { create } from 'zustand'
import type { Book, ChapterSection } from '../core/types'
import {
  bookRepository,
  progressRepository,
  sectionRepository,
  type SectionMeta,
} from '../storage/db'

interface ReaderState {
  book: Book | null
  text: string
  sections: ChapterSection[]
  meta?: SectionMeta
  sectionIndex: number
  /** 章内字符偏移 */
  offset: number
  loading: boolean
  error: string | null
  load: (bookId: string) => Promise<void>
  goToSection: (index: number) => void
  setProgress: (sectionIndex: number, offset: number) => void
  flushProgress: () => Promise<void>
  reset: () => void
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  book: null,
  text: '',
  sections: [],
  meta: undefined,
  sectionIndex: 0,
  offset: 0,
  loading: false,
  error: null,

  load: async (bookId) => {
    set({ loading: true, error: null })
    try {
      const book = await bookRepository.get(bookId)
      if (!book) {
        set({ loading: false, error: '书籍不存在或已被删除' })
        return
      }
      const text = (await bookRepository.getText(bookId)) ?? ''
      const record = await sectionRepository.getRecord(bookId)
      const progress = await progressRepository.get(bookId)
      const sections = record.sections
      const sectionIndex =
        progress && progress.sectionIndex >= 0 && progress.sectionIndex < sections.length
          ? progress.sectionIndex
          : 0
      set({
        book,
        text,
        sections,
        meta: record.meta,
        sectionIndex,
        offset: progress?.offset ?? 0,
        loading: false,
        error: null,
      })
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : String(error) })
    }
  },

  goToSection: (index) => {
    const { sections } = get()
    if (index < 0 || index >= sections.length) return
    set({ sectionIndex: index, offset: 0 })
    void get().flushProgress()
  },

  setProgress: (sectionIndex, offset) => {
    set({ sectionIndex, offset })
  },

  flushProgress: async () => {
    const { book, sectionIndex, offset } = get()
    if (!book) return
    await progressRepository.save({
      bookId: book.id,
      sectionIndex,
      offset,
      updatedAt: Date.now(),
    })
  },

  reset: () =>
    set({
      book: null,
      text: '',
      sections: [],
      meta: undefined,
      sectionIndex: 0,
      offset: 0,
      loading: false,
      error: null,
    }),
}))

/** 书架 store：书籍列表、导入、删除。 */

import { create } from 'zustand'
import type { Book } from '../core/types'
import { bookRepository } from '../storage/db'
import { importBooksFromDialog, type ImportReport } from '../modules/importer/importService'

interface BookshelfState {
  books: Book[]
  loading: boolean
  importing: boolean
  error: string | null
  load: () => Promise<void>
  importBooks: () => Promise<ImportReport>
  removeBook: (id: string) => Promise<void>
  /** 导入 / 校章完成后刷新列表 */
  refresh: () => Promise<void>
}

export const useBookshelfStore = create<BookshelfState>((set, get) => ({
  books: [],
  loading: false,
  importing: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const books = await bookRepository.list()
      set({ books, loading: false })
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : String(error) })
    }
  },

  importBooks: async () => {
    set({ importing: true, error: null })
    try {
      const report = await importBooksFromDialog()
      await get().refresh()
      const failed = report.failures.length > 0
      set({
        importing: false,
        error: failed ? report.failures.map((f) => `${f.fileName}：${f.reason}`).join('；') : null,
      })
      return report
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ importing: false, error: message })
      return { imported: [], failures: [], needsEncoding: [] }
    }
  },

  removeBook: async (id) => {
    await bookRepository.remove(id)
    await get().refresh()
  },

  refresh: async () => {
    const books = await bookRepository.list()
    set({ books })
  },
}))

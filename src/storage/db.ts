/**
 * IndexedDB 封装。UI / store 一律经仓储层访问，不直连 IndexedDB。
 * 正文只存一份（texts），章节只存偏移区间，不复制正文。
 */

import type {
  Book,
  ChapterSection,
  ReadingProgress,
  ReaderSettings,
  RecognizeStrategy,
} from '../core/types'
import { DEFAULT_READER_SETTINGS } from '../core/types'
import { normalizeSettings } from '../core/settings/normalizeSettings'

const DB_NAME = 'novel-reader'
const DB_VERSION = 1

export const STORE_BOOKS = 'books'
export const STORE_TEXTS = 'texts'
export const STORE_SECTIONS = 'sections'
export const STORE_PROGRESS = 'progress'

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_BOOKS)) db.createObjectStore(STORE_BOOKS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE_TEXTS)) db.createObjectStore(STORE_TEXTS, { keyPath: 'bookId' })
      if (!db.objectStoreNames.contains(STORE_SECTIONS)) db.createObjectStore(STORE_SECTIONS, { keyPath: 'bookId' })
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) db.createObjectStore(STORE_PROGRESS, { keyPath: 'bookId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('打开数据库失败'))
  })
  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('数据库请求失败'))
  })
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const request = fn(tx.objectStore(store))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('数据库请求失败'))
    tx.onerror = () => reject(tx.error ?? new Error('数据库事务失败'))
  })
}

/** 测试用：丢弃连接缓存，便于重新打开（配合 fake-indexeddb） */
export async function closeDatabase(): Promise<void> {
  if (!dbPromise) return
  const db = await dbPromise.catch(() => null)
  db?.close()
  dbPromise = null
}

/** 测试用：清空所有业务数据 */
export async function clearAll(): Promise<void> {
  for (const store of [STORE_BOOKS, STORE_TEXTS, STORE_SECTIONS, STORE_PROGRESS]) {
    await withStore(store, 'readwrite', (s) => s.clear())
  }
}

// ---------------------------------------------------------------- BookRepository

export interface BookRepository {
  list(): Promise<Book[]>
  get(id: string): Promise<Book | undefined>
  save(book: Book): Promise<void>
  remove(id: string): Promise<void>
  getText(bookId: string): Promise<string | undefined>
  saveText(bookId: string, text: string): Promise<void>
}

export const bookRepository: BookRepository = {
  async list() {
    const books = await withStore<Book[]>(STORE_BOOKS, 'readonly', (s) => s.getAll())
    return books.sort((a, b) => b.updatedAt - a.updatedAt)
  },
  async get(id) {
    return withStore<Book | undefined>(STORE_BOOKS, 'readonly', (s) => s.get(id))
  },
  async save(book) {
    await withStore(STORE_BOOKS, 'readwrite', (s) => s.put(book))
  },
  async remove(id) {
    await withStore(STORE_BOOKS, 'readwrite', (s) => s.delete(id))
    await withStore(STORE_TEXTS, 'readwrite', (s) => s.delete(id))
    await withStore(STORE_SECTIONS, 'readwrite', (s) => s.delete(id))
    await withStore(STORE_PROGRESS, 'readwrite', (s) => s.delete(id))
  },
  async getText(bookId) {
    const row = await withStore<{ bookId: string; text: string } | undefined>(
      STORE_TEXTS,
      'readonly',
      (s) => s.get(bookId),
    )
    return row?.text
  },
  async saveText(bookId, text) {
    await withStore(STORE_TEXTS, 'readwrite', (s) => s.put({ bookId, text }))
  },
}

// ------------------------------------------------------------- SectionRepository

export interface SectionMeta {
  strategy: RecognizeStrategy
  score: number
  warnings: string[]
}

export interface SectionRecord {
  sections: ChapterSection[]
  meta?: SectionMeta
}

export interface SectionRepository {
  get(bookId: string): Promise<ChapterSection[]>
  getRecord(bookId: string): Promise<SectionRecord>
  save(bookId: string, sections: ChapterSection[], meta?: SectionMeta): Promise<void>
}

export const sectionRepository: SectionRepository = {
  async get(bookId) {
    const record = await sectionRepository.getRecord(bookId)
    return record.sections
  },
  async getRecord(bookId) {
    const row = await withStore<SectionRecord | undefined>(STORE_SECTIONS, 'readonly', (s) =>
      s.get(bookId),
    )
    return row ?? { sections: [] }
  },
  async save(bookId, sections, meta) {
    await withStore(STORE_SECTIONS, 'readwrite', (s) => s.put({ bookId, sections, meta }))
  },
}

// ------------------------------------------------------------ ProgressRepository

export interface ProgressRepository {
  get(bookId: string): Promise<ReadingProgress | undefined>
  save(progress: ReadingProgress): Promise<void>
}

export const progressRepository: ProgressRepository = {
  async get(bookId) {
    return withStore<ReadingProgress | undefined>(STORE_PROGRESS, 'readonly', (s) => s.get(bookId))
  },
  async save(progress) {
    await withStore(STORE_PROGRESS, 'readwrite', (s) => s.put(progress))
  },
}

// ------------------------------------------------------------ SettingsRepository

const SETTINGS_KEY = 'reader.settings'
const FONT_SIZE_KEY = 'reader.fontSize'

export interface SettingsRepository {
  load(): ReaderSettings
  save(settings: ReaderSettings): void
  loadFontSize(): number
  saveFontSize(size: number): void
}

export const settingsRepository: SettingsRepository = {
  load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (!raw) return { ...DEFAULT_READER_SETTINGS }
      // 兼容 v0.1.x 的旧字段（fontFamily 存的是 CSS 值、缺少排版字段）
      return normalizeSettings(JSON.parse(raw))
    } catch {
      return { ...DEFAULT_READER_SETTINGS }
    }
  },
  save(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    localStorage.setItem(FONT_SIZE_KEY, String(settings.fontSize))
  },
  loadFontSize() {
    const raw = localStorage.getItem(FONT_SIZE_KEY)
    const value = raw === null ? Number.NaN : Number(raw)
    return Number.isFinite(value) ? value : DEFAULT_READER_SETTINGS.fontSize
  },
  saveFontSize(size) {
    localStorage.setItem(FONT_SIZE_KEY, String(size))
    try {
      const settings = normalizeSettings({ ...this.load(), fontSize: size })
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* localStorage 不可用时忽略 */
    }
  },
}

export { openDatabase, requestToPromise }

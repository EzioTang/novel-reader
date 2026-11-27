import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'

/** Node 环境没有 localStorage，给设置仓储一个内存桩 */
class MemoryStorage {
  private map = new Map<string, string>()
  get length(): number {
    return this.map.size
  }
  clear(): void {
    this.map.clear()
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
})

const { bookRepository, sectionRepository, progressRepository, settingsRepository, clearAll } =
  await import('../src/storage/db')

import type { Book, ChapterSection } from '../src/core/types'

function makeBook(id: string, updatedAt: number): Book {
  return {
    id,
    title: `书 ${id}`,
    author: '无名',
    format: 'txt',
    encoding: 'utf-8',
    byteSize: 1024,
    charCount: 500,
    createdAt: updatedAt,
    updatedAt,
  }
}

beforeEach(async () => {
  await clearAll()
})

describe('BookRepository', () => {
  it('保存、按更新时间倒序列出、按 id 取回', async () => {
    await bookRepository.save(makeBook('a', 1000))
    await bookRepository.save(makeBook('b', 2000))
    const list = await bookRepository.list()
    expect(list.map((b) => b.id)).toEqual(['b', 'a'])
    expect((await bookRepository.get('a'))?.title).toBe('书 a')
  })

  it('正文单独存放且可读回', async () => {
    await bookRepository.save(makeBook('a', 1))
    await bookRepository.saveText('a', '第一章\n正文')
    expect(await bookRepository.getText('a')).toBe('第一章\n正文')
  })

  it('删除书籍会级联清掉正文、章节与进度', async () => {
    await bookRepository.save(makeBook('a', 1))
    await bookRepository.saveText('a', '正文')
    await sectionRepository.save('a', [], { strategy: 'single', score: 0.1, warnings: [] })
    await progressRepository.save({ bookId: 'a', sectionIndex: 0, offset: 0, updatedAt: 1 })

    await bookRepository.remove('a')

    expect(await bookRepository.get('a')).toBeUndefined()
    expect(await bookRepository.getText('a')).toBeUndefined()
    expect(await sectionRepository.get('a')).toEqual([])
    expect(await progressRepository.get('a')).toBeUndefined()
  })
})

describe('SectionRepository', () => {
  it('保存章节与识别元信息', async () => {
    const sections: ChapterSection[] = [
      {
        index: 0,
        title: '第一章',
        start: 0,
        end: 10,
        charCount: 10,
        level: 1,
        source: 'auto',
        confidence: 0.9,
      },
    ]
    await sectionRepository.save('a', sections, {
      strategy: 'chapter-regex',
      score: 0.88,
      warnings: ['测试'],
    })
    const record = await sectionRepository.getRecord('a')
    expect(record.sections).toHaveLength(1)
    expect(record.meta?.strategy).toBe('chapter-regex')
    expect(record.meta?.warnings).toEqual(['测试'])
  })

  it('未导入的书籍返回空记录', async () => {
    expect(await sectionRepository.getRecord('missing')).toEqual({ sections: [] })
  })
})

describe('ProgressRepository', () => {
  it('按书籍保存与读取进度', async () => {
    await progressRepository.save({ bookId: 'a', sectionIndex: 3, offset: 120, updatedAt: 42 })
    const progress = await progressRepository.get('a')
    expect(progress).toMatchObject({ sectionIndex: 3, offset: 120 })
  })
})

describe('SettingsRepository', () => {
  it('未设置时返回默认值，保存后可读回', () => {
    const defaults = settingsRepository.load()
    expect(defaults.fontSize).toBe(20)
    expect(defaults.pageMode).toBe('scroll')

    settingsRepository.saveFontSize(28)
    expect(settingsRepository.loadFontSize()).toBe(28)
    expect(settingsRepository.load().fontSize).toBe(28)
  })

  it('localStorage 内容损坏时回退默认值', () => {
    localStorage.setItem('reader.settings', '{not json')
    expect(settingsRepository.load().fontSize).toBe(20)
  })
})

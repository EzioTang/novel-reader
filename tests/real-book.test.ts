/**
 * 真实书库体检（本地有书才运行；文件不入库）。
 * 用来验证：大体积编码解码、百万字级文本切章、10MB 级性能。
 *
 * 指定样本的方式（二选一）：
 *   1. 设置环境变量 REAL_BOOK_PATH=<绝对路径>
 *   2. 把书放到项目根目录并命名为 local-book.txt（已在 .gitignore 中）
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { decodeAuto } from '../shared/encoding'
import { recognize } from '../src/core/recognizer'
import { normalizeText } from '../src/core/text/normalize'
import { parseTxt } from '../src/parsers/txt'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const bookPath = process.env.REAL_BOOK_PATH ?? join(projectRoot, 'local-book.txt')
const hasBook = existsSync(bookPath)

describe.skipIf(!hasBook)('真实书库体检', () => {
  it('解码、元数据、切章与性能（10MB 级文本）', () => {
    const bytes = new Uint8Array(readFileSync(bookPath))
    expect(statSync(bookPath).size).toBeGreaterThan(10 * 1024 * 1024)

    const decoded = decodeAuto(bytes)
    expect(decoded.suspicious).toBe(false)

    const text = normalizeText(decoded.text)
    const fileName = bookPath.split(/[\\/]/).pop() ?? 'local-book.txt'
    const parsed = parseTxt(decoded.text, fileName)
    expect(parsed.title.length).toBeGreaterThan(0)
    expect(parsed.charCount).toBeGreaterThan(1_000_000)

    const started = performance.now()
    const result = recognize(text)
    const elapsed = performance.now() - started

    console.log(
      [
        `样本：${fileName}`,
        `编码：${decoded.encoding} · 字数：${parsed.charCount}`,
        `策略：${result.strategy}  得分：${result.score}`,
        `章节：${result.sections.length}  耗时：${elapsed.toFixed(0)}ms`,
        `前 3 章：${result.sections
          .slice(0, 3)
          .map((s) => s.title)
          .join(' / ')}`,
      ].join('\n'),
    )

    // 结构完整性：区间不重叠、覆盖到文末
    expect(result.sections.length).toBeGreaterThan(500)
    for (let i = 1; i < result.sections.length; i++) {
      expect(result.sections[i].start).toBeGreaterThanOrEqual(result.sections[i - 1].end)
    }
    expect(result.sections.at(-1)?.end).toBe(text.length)

    // 性能目标：10MB 文本 < 300ms（《开发框架.md》6.2）
    expect(elapsed).toBeLessThan(300)
  })
})

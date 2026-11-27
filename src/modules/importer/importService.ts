/**
 * 导入编排：读文件 → 编码判定（可疑则交用户选）→ 解析元数据 → 切章 → 落库。
 */

import type { Book } from '../../core/types'
import type { EncodingCandidate } from '../../../shared/ipc'
import { parseTxt } from '../../parsers/txt'
import { bookRepository, sectionRepository } from '../../storage/db'
import { recognizeAsync } from '../../workers/recognizerClient'
import { newId } from '../../core/id'

export interface ImportFailure {
  fileName: string
  reason: string
}

/** 需要用户选编码的文件：候选与预览由主进程解码后给出 */
export interface NeedEncoding {
  path: string
  fileName: string
  candidates: EncodingCandidate[]
}

export interface ImportReport {
  imported: Book[]
  failures: ImportFailure[]
  needsEncoding: NeedEncoding[]
}

function fileNameOf(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

/** 解析 + 切章 + 落库（编码已确定时调用） */
export async function persistDecodedBook(
  fileName: string,
  text: string,
  encoding: string,
  byteSize: number,
): Promise<Book> {
  const parsed = parseTxt(text, fileName)
  const id = newId()
  const now = Date.now()
  const recognition = await recognizeAsync(parsed.text, { bookId: id })

  const book: Book = {
    id,
    title: parsed.title || fileNameOf(fileName),
    author: parsed.author,
    format: 'txt',
    encoding,
    byteSize,
    charCount: parsed.charCount,
    createdAt: now,
    updatedAt: now,
  }

  await bookRepository.save(book)
  await bookRepository.saveText(id, parsed.text)
  await sectionRepository.save(id, recognition.sections, {
    strategy: recognition.strategy,
    score: recognition.score,
    warnings: recognition.warnings,
  })
  return book
}

/** 导入单个文件；编码可疑时不落库，交给 UI 弹框 */
export async function importFile(path: string): Promise<ImportReport> {
  const fileName = fileNameOf(path)
  try {
    const result = await window.api.file.readText(path)
    if (result.suspicious) {
      return {
        imported: [],
        failures: [],
        needsEncoding: [{ path, fileName, candidates: result.candidates }],
      }
    }
    const book = await persistDecodedBook(fileName, result.text, result.encoding, result.byteSize)
    return { imported: [book], failures: [], needsEncoding: [] }
  } catch (error) {
    return {
      imported: [],
      failures: [{ fileName, reason: error instanceof Error ? error.message : String(error) }],
      needsEncoding: [],
    }
  }
}

/** 用户选好编码后重读并落库 */
export async function importFileWithEncoding(
  need: Pick<NeedEncoding, 'path' | 'fileName'>,
  encoding: string,
): Promise<Book> {
  const result = await window.api.file.readText(need.path, encoding)
  return persistDecodedBook(need.fileName, result.text, result.encoding, result.byteSize)
}

/** 弹文件选择框并逐个导入 */
export async function importBooksFromDialog(): Promise<ImportReport> {
  const paths = await window.api.dialog.openBooks()
  const report: ImportReport = { imported: [], failures: [], needsEncoding: [] }
  for (const path of paths) {
    const single = await importFile(path)
    report.imported.push(...single.imported)
    report.failures.push(...single.failures)
    report.needsEncoding.push(...single.needsEncoding)
  }
  return report
}

/** 拖拽导入（HTML5 File 拿不到绝对路径，这里用 Electron 的 webUtils；不可用时提示手动导入） */
export async function importDroppedPaths(paths: string[]): Promise<ImportReport> {
  const report: ImportReport = { imported: [], failures: [], needsEncoding: [] }
  for (const path of paths) {
    const single = await importFile(path)
    report.imported.push(...single.imported)
    report.failures.push(...single.failures)
    report.needsEncoding.push(...single.needsEncoding)
  }
  return report
}

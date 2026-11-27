/** TXT 解析：归一化 + 元数据推测（书名 / 作者 / 字数）。平台无关。 */

import { normalizeText } from '../core/text/normalize'
import { CHAPTER_RULES } from '../core/recognizer/rules'

export interface ParsedBook {
  title: string
  author?: string
  /** 归一化后的全文 */
  text: string
  charCount: number
}

const AUTHOR_PATTERNS: RegExp[] = [
  /作者[：:]\s*([^\s]{1,20})/,
  /^\s*作\s*者\s*[：:]\s*([^\s]{1,20})/m,
  /^\s*by\s+([^\n]{1,20})$/im,
  /^\s*著\s*[：:]\s*([^\s]{1,20})/m,
]

/** 文件名里的进度尾巴：`至第3866章`、`-至第1234章` */
const PROGRESS_SUFFIX = /\s*[-—_]?\s*至第[0-9零一二三四五六七八九十百千两]+章.*$/

/** 首行若是【内容简介】这类栏目标记，不能当书名 */
const META_MARKER = /^[【[（(].*[】\]）)]$/

const GENERIC_TITLE = /^(未命名|新建文本文档|unknown|untitled|book|小说|\d+)$/i

interface FileNameParts {
  title: string
  author?: string
}

/** 解析常见的中文电子书文件名：`书名⊙作者⊙至第N章.txt`、`书名 - 作者.txt` */
export function parseFileName(fileName: string): FileNameParts {
  const base = fileName.replace(/\.[^.]+$/, '')

  const circled = base.split(/[⊙◎]/).map((s) => s.trim()).filter(Boolean)
  if (circled.length >= 2) {
    const title = circled[0].replace(PROGRESS_SUFFIX, '').trim()
    const second = circled[1].replace(PROGRESS_SUFFIX, '').trim()
    return { title, author: second && !/^至第/.test(second) ? second : undefined }
  }

  const dashed = base.split(/\s+[-—]\s+/)
  if (dashed.length === 2) {
    return { title: dashed[0].trim(), author: dashed[1].replace(PROGRESS_SUFFIX, '').trim() }
  }

  const cleaned = base
    .replace(/《|》/g, '')
    .replace(PROGRESS_SUFFIX, '')
    .replace(/^\s*[【[（(]|[】\]）)]\s*$/g, '')
    .trim()
  return { title: cleaned }
}

/** 从文件名与正文前若干行推测书名与作者 */
export function guessMetadata(fileName: string, text: string): { title: string; author?: string } {
  const fromName = parseFileName(fileName)
  let title = fromName.title
  let author = fromName.author

  const firstLine = text.split('\n', 1)[0]?.trim() ?? ''
  const looksLikeChapter = CHAPTER_RULES.some((r) => r.pattern.test(firstLine))
  const quoted = /^《(.+)》$/.exec(firstLine)

  if (quoted) {
    title = quoted[1].trim()
  } else if (
    (!title || GENERIC_TITLE.test(title)) &&
    firstLine.length > 0 &&
    firstLine.length <= 30 &&
    !looksLikeChapter &&
    !META_MARKER.test(firstLine)
  ) {
    title = firstLine
  }

  if (!author) {
    const head = text.slice(0, 2000)
    for (const pattern of AUTHOR_PATTERNS) {
      const m = pattern.exec(head)
      if (m && m[1]) {
        author = m[1].trim()
        break
      }
    }
  }

  return { title: title || '未命名', author }
}

/** 解析 TXT 文本（输入为已按编码解码的原始字符串） */
export function parseTxt(rawText: string, fileName: string): ParsedBook {
  const text = normalizeText(rawText)
  const { title, author } = guessMetadata(fileName, text)
  const charCount = text.replace(/\s/g, '').length
  return { title, author, text, charCount }
}

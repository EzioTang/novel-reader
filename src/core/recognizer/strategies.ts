/** 章节区间构造：正则候选 / 卷章两级 / 字数切分 / 空行聚合 / 单章。 */

import type { ChapterSection } from '../types'
import { splitLines } from '../text/normalize'
import type { Candidate } from './scan'

function build(
  text: string,
  ranges: { title: string; start: number; end: number; level: 1 | 2 }[],
): ChapterSection[] {
  const sections: ChapterSection[] = []
  let index = 0
  for (const r of ranges) {
    const start = Math.max(0, Math.min(r.start, text.length))
    const end = Math.max(start, Math.min(r.end, text.length))
    sections.push({
      index: index++,
      title: r.title,
      start,
      end,
      charCount: end - start,
      level: r.level,
      source: 'auto',
      confidence: 0,
    })
  }
  // 未命中任何标题的章节没有意义，过滤掉零长度区间（尾部空行）
  return sections.filter((s) => s.charCount > 0 || sections.length === 1)
}

/** 单层：每个候选行到下一个候选行之间为一章 */
export function sectionsFromCandidates(
  text: string,
  candidates: Candidate[],
  confidence: number,
): ChapterSection[] {
  const ranges = candidates.map((c, i) => ({
    title: c.title || c.rawTitle,
    start: c.offset,
    end: i + 1 < candidates.length ? candidates[i + 1].offset : text.length,
    level: 1 as const,
  }))
  const sections = build(text, ranges)
  return sections.map((s) => ({ ...s, confidence }))
}

/** 两级：卷为 level 1，卷内章为 level 2；卷外的章退化为 level 1 */
export function sectionsFromVolumeChapter(
  text: string,
  volumes: Candidate[],
  chapters: Candidate[],
  confidence: number,
): ChapterSection[] {
  const volumeStarts = volumes.map((v) => v.offset)
  const ranges: { title: string; start: number; end: number; level: 1 | 2 }[] = []

  volumes.forEach((vol, i) => {
    const volEnd = i + 1 < volumes.length ? volumeStarts[i + 1] : text.length
    ranges.push({ title: vol.title || vol.rawTitle, start: vol.offset, end: volEnd, level: 1 })
  })

  const volumeAt = (offset: number): number => {
    let found = -1
    for (let i = 0; i < volumeStarts.length; i++) if (volumeStarts[i] <= offset) found = i
    return found
  }

  chapters.forEach((chap, i) => {
    const volIndex = volumeAt(chap.offset)
    // 章区间止于下一个章，或所属卷末尾
    let end = i + 1 < chapters.length ? chapters[i + 1].offset : text.length
    if (volIndex >= 0) {
      const volEnd = volIndex + 1 < volumes.length ? volumeStarts[volIndex + 1] : text.length
      end = Math.min(end, volEnd)
    }
    if (chap.offset === (volIndex >= 0 ? volumeStarts[volIndex] : -1)) return // 与卷首重叠的行不重复出章
    ranges.push({
      title: chap.title || chap.rawTitle,
      start: chap.offset,
      end,
      level: volIndex >= 0 ? 2 : 1,
    })
  })

  ranges.sort((a, b) => a.start - b.start)
  const sections = build(text, ranges)
  return sections.map((s) => ({ ...s, confidence }))
}

/** 在目标位置附近找一个自然断点（优先段落间空行，其次单换行） */
function findBreak(text: string, from: number, target: number): number {
  const ideal = from + target
  if (ideal >= text.length) return text.length

  const windowStart = Math.max(from + Math.floor(target * 0.85), from + 1)
  const windowEnd = Math.min(from + Math.floor(target * 1.15), text.length)

  const paragraphBreak = text.indexOf('\n\n', windowStart)
  if (paragraphBreak !== -1 && paragraphBreak <= windowEnd) return paragraphBreak

  const lineBreak = text.indexOf('\n', windowStart)
  if (lineBreak !== -1 && lineBreak <= windowEnd) return lineBreak

  return Math.min(ideal, text.length)
}

/** 降级：固定字数切分（默认 3000 字/章） */
export function sectionsByCharCount(text: string, target = 3000): ChapterSection[] {
  const ranges: { title: string; start: number; end: number; level: 1 }[] = []
  let start = 0
  let guard = 0
  while (start < text.length && guard++ < 10_000) {
    // 跳过行首空行
    while (start < text.length && text.charAt(start) === '\n') start++
    if (start >= text.length) break
    const end = findBreak(text, start, target)
    ranges.push({ title: `第 ${ranges.length + 1} 节`, start, end, level: 1 })
    start = end
  }
  return build(text, ranges).map((s) => ({ ...s, confidence: 0.4 }))
}

/** 降级：空行分段聚合 */
export function sectionsByBlankLines(text: string, target = 3000): ChapterSection[] {
  const lines = splitLines(text)
  const ranges: { title: string; start: number; end: number; level: 1 }[] = []
  let cursor: number | null = null
  let lastEnd = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (cursor === null) cursor = line.start
    lastEnd = line.end
    const atBlank = line.text.trim() === ''
    const longEnough = lastEnd - cursor >= target
    if (atBlank && longEnough) {
      ranges.push({ title: `第 ${ranges.length + 1} 段`, start: cursor, end: line.start, level: 1 })
      cursor = null
    }
  }
  if (cursor !== null && lastEnd > cursor) {
    ranges.push({ title: `第 ${ranges.length + 1} 段`, start: cursor, end: text.length, level: 1 })
  }
  return build(text, ranges).map((s) => ({ ...s, confidence: 0.3 }))
}

/** 最终降级：整篇单章 */
export function singleSection(text: string, title = '全文'): ChapterSection[] {
  return [
    {
      index: 0,
      title,
      start: 0,
      end: text.length,
      charCount: text.length,
      level: 1,
      source: 'auto',
      confidence: 1,
    },
  ]
}

/** 候选行扫描：多套规则并行逐行匹配，带权重与序号。 */

import { looksLikeHeading, stripDecoration, type TextLine } from '../text/normalize'
import { CHAPTER_RULES, BLANK_LINE_WEIGHT, type ChapterRule } from './rules'

export interface Candidate {
  /** 行起始偏移（章节正文起点） */
  offset: number
  lineIndex: number
  /** 原始行（仅去首尾空白），用于展示 */
  rawTitle: string
  /** 剥离装饰后的标题，用于匹配与解析序号 */
  title: string
  ruleId: string
  ruleName: string
  weight: number
  /** 1 = 卷级；2 = 章级 */
  level: 1 | 2
  sequence: number | null
}

/**
 * 扫描全部规则命中的候选行。
 * 命中条件：行短、独立成行、无句末标点、非对话（见 looksLikeHeading）。
 */
export function scanCandidates(lines: TextLine[], rules: ChapterRule[] = CHAPTER_RULES): Candidate[] {
  const byOffset = new Map<number, Candidate>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const rawTitle = line.text.trim()
    if (!looksLikeHeading(rawTitle)) continue
    const title = stripDecoration(rawTitle) || rawTitle

    for (const rule of rules) {
      const m = rule.pattern.exec(title)
      if (!m) continue
      const candidate: Candidate = {
        offset: line.start,
        lineIndex: i,
        rawTitle,
        title,
        ruleId: rule.id,
        ruleName: rule.name,
        weight: rule.weight,
        level: rule.level,
        sequence: rule.sequence ? rule.sequence(m) : null,
      }
      const prev = byOffset.get(line.start)
      // 同一行被多套规则命中时保留权重更高的
      if (!prev || prev.weight < candidate.weight) byOffset.set(line.start, candidate)
      break
    }
  }

  return [...byOffset.values()].sort((a, b) => a.offset - b.offset)
}

/**
 * 空行短行启发式：长度 ≤ 20、前后为空行、无句末标点。
 * 权重最低，只在正则方案全部失败时的降级链路中使用。
 */
export function scanBlankLineHeadings(lines: TextLine[]): Candidate[] {
  const out: Candidate[] = []
  for (let i = 1; i < lines.length - 1; i++) {
    const raw = lines[i].text.trim()
    if (raw.length === 0 || raw.length > 20) continue
    const prevBlank = lines[i - 1].text.trim() === ''
    const nextBlank = lines[i + 1].text.trim() === ''
    if (!prevBlank || !nextBlank) continue
    if (!looksLikeHeading(raw, 20, true)) continue
    out.push({
      offset: lines[i].start,
      lineIndex: i,
      rawTitle: raw,
      title: stripDecoration(raw) || raw,
      ruleId: 'blank-line',
      ruleName: '空行短行',
      weight: BLANK_LINE_WEIGHT,
      level: 1,
      sequence: null,
    })
  }
  return out
}

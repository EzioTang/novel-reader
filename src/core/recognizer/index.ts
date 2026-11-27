/**
 * 章节识别入口（纯函数，可在 Web Worker 中调用）。
 * 管线：候选行扫描 → 方案打分 → 决策/降级。
 * 输入必须是已归一化的文本（normalizeText 的结果），偏移以该文本为基准。
 *
 * 说明：单层方案取「所有单层规则命中行的并集」（章/节/回、英文 Chapter、特殊标题、数字标题），
 * 规则权重取并集内出现的最高权重。这样「序章 + 第一章 + 番外」这类混合排版不会被单条规则切掉。
 * 卷规则单独用于「卷 > 章」两级降级方案。
 */

import type { ChapterSection, RecognitionResult, RecognizeStrategy } from '../types'
import { splitLines } from '../text/normalize'
import { CHAPTER_RULES } from './rules'
import { scanBlankLineHeadings, scanCandidates, type Candidate } from './scan'
import { scorePlan } from './score'
import {
  sectionsByCharCount,
  sectionsFromCandidates,
  sectionsFromVolumeChapter,
  singleSection,
} from './strategies'

export interface RecognizeOptions {
  bookId?: string
  /** 降级按字数切分的每章字数，默认 3000 */
  chapterSize?: number
  /** 采纳阈值，默认 0.55 */
  scoreThreshold?: number
  /** 采纳所需最少候选数，默认 3（短篇自动放宽到 1） */
  minCandidates?: number
  /** 两个方案分数差值小于该值时视为并列，默认 0.05 */
  tieThreshold?: number
}

interface Plan {
  ruleId: string
  ruleName: string
  ruleWeight: number
  candidates: Candidate[]
  score: ReturnType<typeof scorePlan>
}

function makeResult(
  bookId: string,
  strategy: RecognizeStrategy,
  score: number,
  sections: ChapterSection[],
  warnings: string[],
  alternatives?: RecognitionResult[],
): RecognitionResult {
  return { bookId, strategy, score, sections, warnings, alternatives }
}

export function recognize(text: string, opts: RecognizeOptions = {}): RecognitionResult {
  const bookId = opts.bookId ?? ''
  const chapterSize = opts.chapterSize ?? 3000
  const threshold = opts.scoreThreshold ?? 0.55
  const tieThreshold = opts.tieThreshold ?? 0.05
  const minCandidates = opts.minCandidates ?? (text.length < chapterSize * 3 ? 1 : 3)

  if (text.trim().length === 0) {
    return makeResult(bookId, 'single', 0, [], ['文件内容为空，请检查原文件'])
  }

  const lines = splitLines(text)
  const all = scanCandidates(lines)

  const volumes = all.filter((c) => c.ruleId === 'volume')
  const singles = all.filter((c) => c.ruleId !== 'volume')
  const unionWeight = singles.reduce((max, c) => Math.max(max, c.weight), 0)

  const plans: Plan[] = []
  for (const rule of CHAPTER_RULES) {
    if (rule.id === 'volume') continue
    const candidates = all.filter((c) => c.ruleId === rule.id)
    if (candidates.length === 0) continue
    plans.push({
      ruleId: rule.id,
      ruleName: rule.name,
      ruleWeight: rule.weight,
      candidates,
      score: scorePlan(candidates, text.length, rule.weight, chapterSize),
    })
  }
  plans.sort((a, b) => b.score.score - a.score.score)

  // 单层主方案：并集
  const unionScore = scorePlan(singles, text.length, unionWeight || 0.9, chapterSize)

  if (singles.length > 0 && unionScore.score >= threshold && unionScore.hits >= minCandidates) {
    const sections = sectionsFromCandidates(text, singles, unionScore.score)
    const warnings: string[] = []
    const alternatives: RecognitionResult[] = []

    // 第一章之前若有整段前言/内容简介，单独成节，避免这部分正文无处可读
    const lead = sections.length > 0 ? sections[0].start : 0
    if (lead > 500) {
      sections.unshift({
        index: 0,
        title: '前言',
        start: 0,
        end: lead,
        charCount: lead,
        level: 1,
        source: 'auto',
        confidence: unionScore.score,
      })
      sections.forEach((section, i) => {
        section.index = i
      })
      warnings.push('第一章之前的内容已单列为「前言」')
    }

    const best = plans[0]
    if (best && best.score.score >= threshold && unionScore.score - best.score.score < tieThreshold) {
      warnings.push(
        `存在接近的备选方案（${best.ruleName} 单规则），如并集结果不理想可采用备选`,
      )
      alternatives.push(
        makeResult(
          bookId,
          'chapter-regex',
          best.score.score,
          sectionsFromCandidates(text, best.candidates, best.score.score),
          [],
        ),
      )
    }
    if (sections.length === 1) warnings.push('仅识别到 1 章，建议人工校正')
    return makeResult(bookId, 'chapter-regex', unionScore.score, sections, warnings, alternatives)
  }

  // 降级 1：卷 + 章两级
  const chapters = all.filter((c) => c.ruleId === 'chapter')
  if (volumes.length >= 2 && chapters.length >= 2) {
    const score = scorePlan(chapters, text.length, 0.9, chapterSize).score
    const sections = sectionsFromVolumeChapter(text, volumes, chapters, score)
    return makeResult(bookId, 'volume-chapter', score, sections, [
      '单层章节结构不明显，已按「卷 > 章」两级切分，可在校正界面调整',
    ])
  }

  // 降级 2：固定字数切分
  if (text.length >= chapterSize) {
    return makeResult(
      bookId,
      'char-count',
      0.3,
      sectionsByCharCount(text, chapterSize),
      [`未识别到章节标题，已自动按每 ${chapterSize} 字切分，可在校正界面调整`],
    )
  }

  // 降级 3：空行分段聚合
  const blankCandidates = scanBlankLineHeadings(lines)
  if (blankCandidates.length >= 3) {
    return makeResult(
      bookId,
      'blank-line',
      0.25,
      sectionsFromCandidates(text, blankCandidates, 0.3),
      ['按空行短行推测章节，准确性有限，建议人工校正'],
    )
  }

  // 最终：单章
  return makeResult(bookId, 'single', 0.1, singleSection(text), [
    '未发现任何章节结构，已整篇作为单章，请在校正界面手动切分',
  ])
}

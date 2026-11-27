/**
 * 方案打分（《开发框架.md》6.4）：
 * score = 0.50 × 规则权重 r
 *       + 0.20 × 覆盖度 c
 *       + 0.20 × 连续性 m
 *       + 0.10 × 分布均匀性 p
 */

import type { Candidate } from './scan'

export interface PlanScore {
  score: number
  rule: number
  coverage: number
  continuity: number
  uniformity: number
  hits: number
}

/** 覆盖度：命中数 / 由字数估算的预期章数，落在合理区间才给满分 */
export function coverageScore(hits: number, charCount: number, chapterSize = 3000): number {
  const expected = Math.max(1, charCount / chapterSize)
  const ratio = hits / expected
  if (ratio <= 0) return 0
  if (ratio < 0.5) return ratio // 命中太少
  if (ratio <= 3) return 1
  return 3 / ratio // 命中过多：多半是误判或广告位
}

/** 连续性：序号单调递增（理想是 +1）的比例 */
export function continuityScore(candidates: Candidate[]): number {
  let good = 0
  let total = 0
  for (let i = 1; i < candidates.length; i++) {
    const prev = candidates[i - 1].sequence
    const cur = candidates[i].sequence
    if (prev === null || cur === null) continue
    total++
    if (cur === prev + 1) good += 1
    else if (cur > prev) good += 0.6 // 跳号仍算结构存在
    // 重号 / 回退 → 0 分
  }
  // 纯中文标题（楔子/番外）没有序号，按中性处理
  return total === 0 ? 0.5 : good / total
}

/** 分布均匀性：集中在前 5% 的命中视为噪声（如页首广告位） */
export function uniformityScore(candidates: Candidate[], charCount: number): number {
  if (charCount === 0 || candidates.length === 0) return 0
  const head = charCount * 0.05
  const inHead = candidates.filter((c) => c.offset < head).length
  const headRatio = inHead / candidates.length
  return Math.max(0, 1 - headRatio)
}

export function scorePlan(
  candidates: Candidate[],
  charCount: number,
  ruleWeight: number,
  chapterSize = 3000,
): PlanScore {
  const hits = candidates.length
  const coverage = coverageScore(hits, charCount, chapterSize)
  const continuity = continuityScore(candidates)
  const uniformity = uniformityScore(candidates, charCount)
  const score = 0.5 * ruleWeight + 0.2 * coverage + 0.2 * continuity + 0.1 * uniformity
  return {
    score: Math.round(score * 1000) / 1000,
    rule: ruleWeight,
    coverage: Math.round(coverage * 1000) / 1000,
    continuity: Math.round(continuity * 1000) / 1000,
    uniformity: Math.round(uniformity * 1000) / 1000,
    hits,
  }
}

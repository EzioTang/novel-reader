/** 章节识别规则库：以数据结构表达，支持后续增删改（为 v0.3 书源复用）。 */

import { sequenceOf } from './number'

export interface ChapterRule {
  id: string
  name: string
  /** 规则权重 r，参与评分 0.5 × r */
  weight: number
  /** 1 = 卷级，2 = 卷下的章级；单层识别时统一按 1 输出 */
  level: 1 | 2
  pattern: RegExp
  /** 从匹配结果提取序号，用于连续性评分 */
  sequence?: (m: RegExpMatchArray) => number | null
}

export const CHAPTER_RULES: ChapterRule[] = [
  {
    id: 'volume',
    name: '卷',
    weight: 0.5,
    level: 1,
    pattern: /^第([零〇一二两三四五六七八九十百千0-9]+)卷[ ]*(.*)$/,
    sequence: (m) => sequenceOf(m[1]),
  },
  {
    id: 'chapter',
    name: '章/节/回',
    weight: 0.9,
    level: 2,
    pattern: /^第([零〇一二两三四五六七八九十百千万0-9]+)[章节回][ ]*(.*)$/,
    sequence: (m) => sequenceOf(m[1]),
  },
  {
    id: 'english-chapter',
    name: '英文 Chapter',
    weight: 0.9,
    level: 1,
    pattern: /^(Chapter|CHAPTER)\s+([0-9]+|[IVXLCDM]+)(?![A-Za-z0-9])\s*(.*)$/,
    sequence: (m) => sequenceOf(m[2]),
  },
  {
    id: 'special',
    name: '特殊标题',
    weight: 0.85,
    level: 1,
    pattern: /^(序章|楔子|引子|前言|序言|尾声|后记|番外|终章|完结)([\s·:：—-].{0,20})?$/,
    sequence: () => null,
  },
  {
    id: 'numeric',
    name: '数字标题',
    weight: 0.6,
    level: 1,
    pattern: /^\s*([0-9]{1,4})[、.．:：]\s*\S.{0,30}$/,
    sequence: (m) => sequenceOf(m[1]),
  },
]

/** 空行短行启发式（权重 0.3），不作为主规则参与竞争，只在降级时使用 */
export const BLANK_LINE_WEIGHT = 0.3

export function ruleById(id: string): ChapterRule | undefined {
  return CHAPTER_RULES.find((r) => r.id === id)
}

import { describe, expect, it } from 'vitest'
import { recognize } from '../src/core/recognizer'
import { coverageScore, continuityScore, scorePlan, uniformityScore } from '../src/core/recognizer/score'
import { scanCandidates, type Candidate } from '../src/core/recognizer/scan'
import { sectionsFromVolumeChapter } from '../src/core/recognizer/strategies'
import { parseChapterNumber } from '../src/core/recognizer/number'
import { normalizeText, splitLines } from '../src/core/text/normalize'

function candidate(offset: number, sequence: number | null, weight = 0.9): Candidate {
  return {
    offset,
    lineIndex: 0,
    rawTitle: `第${sequence ?? 0}章`,
    title: `第${sequence ?? 0}章`,
    ruleId: 'chapter',
    ruleName: '章/节/回',
    weight,
    level: 2,
    sequence,
  }
}

function body(chapters: number, charsPerChapter = 120): string {
  const parts: string[] = []
  for (let i = 1; i <= chapters; i++) {
    parts.push(`第${i}章 标题${i}\n\n${'正文内容。'.repeat(charsPerChapter / 5)}`)
  }
  return parts.join('\n\n')
}

describe('章节序号解析', () => {
  it.each([
    ['一', 1],
    ['三', 3],
    ['十', 10],
    ['十二', 12],
    ['二十', 20],
    ['二十一', 21],
    ['一百零五', 105],
    ['一千零一', 1001],
    ['IV', 4],
    ['XII', 12],
    ['7', 7],
  ])('%s → %i', (input, expected) => {
    expect(parseChapterNumber(input)).toBe(expected)
  })

  it('无法解析的标题返回 null', () => {
    expect(parseChapterNumber('楔子')).toBeNull()
    expect(parseChapterNumber('')).toBeNull()
  })
})

describe('候选行扫描', () => {
  it('识别章标题并记录偏移与序号', () => {
    const text = normalizeText(body(3))
    const candidates = scanCandidates(splitLines(text))
    expect(candidates).toHaveLength(3)
    expect(candidates[0].sequence).toBe(1)
    expect(candidates[1].offset).toBe(text.indexOf('第2章'))
  })

  it('正文里引用的「第一章」不会被误判', () => {
    const text = normalizeText('他说第一章写得不错。\n\n第二章 正式\n\n正文。')
    const candidates = scanCandidates(splitLines(text))
    expect(candidates).toHaveLength(1)
    expect(candidates[0].title).toContain('第二章')
  })
})

describe('评分模型', () => {
  it('覆盖度：命中数接近预期给满分，过多则扣分', () => {
    expect(coverageScore(5, 15000)).toBe(1)
    expect(coverageScore(20, 3000)).toBeLessThan(0.2)
    expect(coverageScore(0, 3000)).toBe(0)
  })

  it('连续性：递增 +1 满分，重号为 0', () => {
    expect(continuityScore([candidate(0, 1), candidate(100, 2), candidate(200, 3)])).toBe(1)
    expect(continuityScore([candidate(0, 1), candidate(100, 1), candidate(200, 1)])).toBe(0)
  })

  it('均匀性：全部集中在前 5% 视为噪声', () => {
    const headOnly = [candidate(0, 1), candidate(10, 2), candidate(20, 3)]
    expect(uniformityScore(headOnly, 10000)).toBe(0)
  })

  it('总分符合 0.5r + 0.2c + 0.2m + 0.1p 的加权', () => {
    const plan = scorePlan([candidate(0, 1), candidate(3000, 2), candidate(6000, 3)], 9000, 0.9)
    expect(plan.score).toBeCloseTo(0.5 * 0.9 + 0.2 * plan.coverage + 0.2 * plan.continuity + 0.1 * plan.uniformity, 2)
    expect(plan.score).toBeGreaterThan(0.85)
  })
})

describe('recognize 决策与降级', () => {
  it('标准「第X章」走 chapter-regex', () => {
    const text = normalizeText(body(5))
    const result = recognize(text, { bookId: 'b1' })
    expect(result.strategy).toBe('chapter-regex')
    expect(result.bookId).toBe('b1')
    expect(result.sections).toHaveLength(5)
    expect(result.sections[0].title).toBe('第1章 标题1')
    expect(result.sections[0].start).toBe(0)
    expect(result.sections[1].start).toBe(text.indexOf('第2章'))
  })

  it('序章 / 番外等特殊标题与章标题合并成同一方案', () => {
    const text = normalizeText(
      ['序章', '开篇正文。', '第一章 起', '正文。', '第二章 承', '正文。', '尾声', '收束。'].join('\n\n'),
    )
    const result = recognize(text)
    expect(result.strategy).toBe('chapter-regex')
    expect(result.sections.map((s) => s.title)).toEqual(['序章', '第一章 起', '第二章 承', '尾声'])
  })

  it('无标题长文本降级为按字数切分', () => {
    const text = '这是一段没有章节标题的正文。'.repeat(400)
    const result = recognize(text)
    expect(result.strategy).toBe('char-count')
    expect(result.sections.length).toBeGreaterThan(1)
    expect(result.sections[0].start).toBe(0)
    expect(result.sections.at(-1)?.end).toBe(text.length)
    expect(result.warnings.join()).toContain('每 3000 字')
  })

  it('空行短行降级为 blank-line', () => {
    const text = normalizeText(
      ['开头一句话。', '', '雨夜', '', '第一段正文。', '', '旧信', '', '第二段正文。', '', '长街', '', '第三段正文。'].join(
        '\n',
      ),
    )
    const result = recognize(text)
    expect(result.strategy).toBe('blank-line')
    expect(result.sections.map((s) => s.title)).toEqual(['雨夜', '旧信', '长街'])
  })

  it('完全无结构时退化为单章', () => {
    const result = recognize('只有一句话。')
    expect(result.strategy).toBe('single')
    expect(result.sections).toHaveLength(1)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('空文本返回空章节并给出提示', () => {
    const result = recognize('   \n\n ')
    expect(result.sections).toHaveLength(0)
    expect(result.warnings[0]).toContain('为空')
  })
})

describe('卷 > 章两级构造', () => {
  it('卷为 level 1，卷内章为 level 2 且区间止于卷末', () => {
    const text = normalizeText(
      ['第一卷 山雨', '第一章 起', '正文。', '第二章 承', '正文。', '第二卷 长夜', '第一章 起', '正文。'].join(
        '\n\n',
      ),
    )
    const all = scanCandidates(splitLines(text))
    const volumes = all.filter((c) => c.ruleId === 'volume')
    const chapters = all.filter((c) => c.ruleId === 'chapter')
    const sections = sectionsFromVolumeChapter(text, volumes, chapters, 0.8)

    expect(sections).toHaveLength(5)
    expect(sections[0]).toMatchObject({ title: '第一卷 山雨', level: 1 })
    expect(sections[1]).toMatchObject({ title: '第一章 起', level: 2 })
    expect(sections[2]).toMatchObject({ title: '第二章 承', level: 2 })
    expect(sections[3]).toMatchObject({ title: '第二卷 长夜', level: 1 })
    expect(sections[3].start).toBe(text.indexOf('第二卷'))
    expect(sections[2].end).toBe(sections[3].start)
  })
})

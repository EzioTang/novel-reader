/**
 * M2 样例库验收：对 resources/samples 下每本书跑一遍识别，统计切章准确率。
 * 指标：召回（预期标题被识别出来的比例）与精度（识别结果落在预期标题内的比例）。
 * 目标：≥ 95%（《开发框架.md》6.1）。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { decodeAuto } from '../shared/encoding'
import { recognize } from '../src/core/recognizer'
import { normalizeText } from '../src/core/text/normalize'

interface SampleEntry {
  file: string
  style: string
  headings: string[]
  volumes?: string[]
  expectStrategy?: string
}

interface Manifest {
  samples: SampleEntry[]
}

const samplesDir = fileURLToPath(new URL('../resources/samples/', import.meta.url))
const manifest = JSON.parse(readFileSync(`${samplesDir}manifest.json`, 'utf8')) as Manifest

function readSample(file: string): string {
  const bytes = new Uint8Array(readFileSync(`${samplesDir}${file}`))
  return normalizeText(decodeAuto(bytes).text)
}

describe('M2 样例库切章验收', () => {
  it('样例库至少 10 本且风格不重复', () => {
    expect(manifest.samples.length).toBeGreaterThanOrEqual(10)
    const styles = new Set(manifest.samples.map((s) => s.style))
    expect(styles.size).toBe(manifest.samples.length)
  })

  it('每本样例都能产出章节结构，且策略符合预期', () => {
    for (const sample of manifest.samples) {
      const text = readSample(sample.file)
      const result = recognize(text)
      expect(result.sections.length, `${sample.file} 未产出章节`).toBeGreaterThan(0)
      if (sample.expectStrategy) {
        expect(result.strategy, `${sample.file} 策略不符`).toBe(sample.expectStrategy)
      }
      // 章节必须首尾相接、互不重叠
      for (let i = 0; i < result.sections.length; i++) {
        const s = result.sections[i]
        expect(s.end).toBeGreaterThan(s.start)
        if (i > 0) expect(s.start).toBeGreaterThanOrEqual(result.sections[i - 1].end)
      }
    }
  })

  it('整体切章准确率 ≥ 95%', () => {
    let expectedTotal = 0
    let recallHit = 0
    let recognizedTotal = 0
    let precisionHit = 0
    const rows: string[] = []

    for (const sample of manifest.samples) {
      if (sample.headings.length === 0) continue
      const text = readSample(sample.file)
      const result = recognize(text)
      const expected = new Set(sample.headings)
      const titles = result.sections.map((s) => s.title)

      const hit = sample.headings.filter((h) => titles.includes(h)).length
      const matched = titles.filter((t) => expected.has(t)).length

      expectedTotal += sample.headings.length
      recallHit += hit
      recognizedTotal += titles.length
      precisionHit += matched

      rows.push(
        `${sample.file}: 预期 ${sample.headings.length}，识别 ${titles.length}，命中 ${hit}（${sample.style}）`,
      )
    }

    const recall = recallHit / expectedTotal
    const precision = precisionHit / recognizedTotal
    // 输出便于在 CI 日志里看到 M2 指标
    console.log(rows.join('\n'))
    console.log(
      `召回 ${(recall * 100).toFixed(1)}% (${recallHit}/${expectedTotal}) · 精度 ${(precision * 100).toFixed(1)}% (${precisionHit}/${recognizedTotal})`,
    )

    expect(recall).toBeGreaterThanOrEqual(0.95)
    expect(precision).toBeGreaterThanOrEqual(0.95)
  })
})

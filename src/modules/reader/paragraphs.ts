/** 段落视图：把章节文本切成带绝对偏移的段落，用于滚动锚点与位置保持。 */

import { stripDecoration } from '../../core/text/normalize'

export interface Paragraph {
  offset: number
  text: string
}

function sameHeading(a: string, b: string): boolean {
  return stripDecoration(a) === stripDecoration(b)
}

/**
 * 切出章节正文段落。
 * 传入章节标题时，会跳过开头那行标题本身 —— 否则阅读页会先渲染 <h2> 标题、
 * 再把同一行当正文段落重复显示一次。
 */
export function paragraphsOf(
  text: string,
  start: number,
  end: number,
  sectionTitle?: string,
): Paragraph[] {
  const slice = text.slice(start, end)
  const out: Paragraph[] = []
  let cursor = 0
  let awaitingTitle = Boolean(sectionTitle)

  for (const line of slice.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length > 0) {
      const isTitleLine = awaitingTitle && sectionTitle !== undefined && sameHeading(trimmed, sectionTitle)
      awaitingTitle = false
      if (!isTitleLine) out.push({ offset: start + cursor, text: trimmed })
    }
    cursor += line.length + 1
  }
  return out
}

/** 取当前视口顶部所在的段落偏移，作为重排锚点 */
export function captureAnchor(container: HTMLElement): number | null {
  const containerTop = container.getBoundingClientRect().top
  const nodes = container.querySelectorAll<HTMLElement>('[data-offset]')
  for (const node of Array.from(nodes)) {
    const rect = node.getBoundingClientRect()
    if (rect.bottom > containerTop + 4) return Number(node.dataset.offset)
  }
  return null
}

/** 重排后把同一字符偏移重新对齐到视口顶部 */
export function restoreAnchor(container: HTMLElement, offset: number): void {
  const node = container.querySelector<HTMLElement>(`[data-offset="${offset}"]`)
  if (!node) return
  const delta = node.getBoundingClientRect().top - container.getBoundingClientRect().top
  if (Math.abs(delta) < 1) return
  container.scrollTop += delta
}

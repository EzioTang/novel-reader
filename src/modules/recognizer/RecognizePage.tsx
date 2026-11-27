import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Book, ChapterSection, RecognitionResult } from '../../core/types'
import { bookRepository, sectionRepository, type SectionMeta } from '../../storage/db'
import { recognizeAsync } from '../../workers/recognizerClient'
import { BackIcon, BookIcon } from '../../ui/icons'
import styles from './RecognizePage.module.css'

const STRATEGY_LABEL: Record<string, string> = {
  'chapter-regex': '正则切章',
  'volume-chapter': '卷 · 章两级',
  'char-count': '按字数切分',
  'blank-line': '空行分段',
  single: '单章',
}

function normalize(sections: ChapterSection[], textLength: number): ChapterSection[] {
  const sorted = [...sections].sort((a, b) => a.start - b.start)
  return sorted
    .map((s) => ({ ...s, end: Math.min(s.end, textLength), charCount: Math.max(0, s.end - s.start) }))
    .filter((s) => s.charCount > 0 || sorted.length === 1)
    .map((s, i) => ({ ...s, index: i }))
}

export function RecognizePage(): JSX.Element {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()

  const [book, setBook] = useState<Book | null>(null)
  const [text, setText] = useState('')
  const [sections, setSections] = useState<ChapterSection[]>([])
  const [meta, setMeta] = useState<SectionMeta | undefined>(undefined)
  const [selected, setSelected] = useState(0)
  const [splitAt, setSplitAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!bookId) return
    void (async () => {
      const found = await bookRepository.get(bookId)
      const body = (await bookRepository.getText(bookId)) ?? ''
      const record = await sectionRepository.getRecord(bookId)
      setBook(found ?? null)
      setText(body)
      setSections(record.sections)
      setMeta(record.meta)
    })()
  }, [bookId])

  const current = sections[selected]

  const previewParagraphs = useMemo(() => {
    if (!current) return []
    const out: { offset: number; text: string }[] = []
    let cursor = 0
    const slice = text.slice(current.start, current.end)
    for (const line of slice.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) out.push({ offset: current.start + cursor, text: trimmed })
      cursor += line.length + 1
      if (out.length >= 120) break
    }
    return out
  }, [current, text])

  const startsSet = useMemo(() => new Set(sections.map((s) => s.start)), [sections])

  function commit(next: ChapterSection[], note?: string): void {
    setSections(normalize(next, text.length))
    setDirty(true)
    if (note) setMessage(note)
  }

  function rename(index: number, title: string): void {
    const next = sections.map((s, i) =>
      i === index ? { ...s, title, source: 'manual' as const, confidence: 1 } : s,
    )
    commit(next)
  }

  function mergeWithNext(index: number): void {
    if (index >= sections.length - 1) return
    const next = sections.map((s) => ({ ...s }))
    next[index].end = next[index + 1].end
    next[index].source = 'manual'
    next[index].confidence = 1
    next.splice(index + 1, 1)
    commit(next, '已与下一章合并')
    setSplitAt(null)
  }

  function splitHere(): void {
    if (!current || splitAt === null) return
    if (splitAt <= current.start || splitAt >= current.end) return
    const head: ChapterSection = { ...current, end: splitAt, source: 'manual', confidence: 1 }
    const tail: ChapterSection = {
      ...current,
      start: splitAt,
      end: current.end,
      title: '新章节',
      source: 'manual',
      confidence: 1,
    }
    const next = [...sections]
    next.splice(selected, 1, head, tail)
    commit(next, '已从选中位置拆分')
    setSplitAt(null)
  }

  function removeSection(index: number): void {
    if (sections.length <= 1) return
    const next = sections.map((s) => ({ ...s }))
    if (index > 0) {
      next[index - 1].end = next[index].end
      next[index - 1].source = 'manual'
    }
    next.splice(index, 1)
    commit(next, '已删除该章节，正文并入上一章')
    setSelected(Math.max(0, index - 1))
    setSplitAt(null)
  }

  async function rerun(): Promise<void> {
    if (!bookId) return
    setBusy(true)
    try {
      const manualSections = sections.filter((s) => s.source === 'manual')
      const result: RecognitionResult = await recognizeAsync(text, { bookId })
      if (manualSections.length > 0) {
        // 保留人工结果：以人工与自动的边界并集重建章节，人工标题优先
        const manualTitles = new Map(manualSections.map((s) => [s.start, s.title]))
        const boundaries = new Set<number>([0])
        for (const s of [...result.sections, ...manualSections]) boundaries.add(s.start)
        const ordered = [...boundaries].sort((a, b) => a - b)
        const rebuilt: ChapterSection[] = ordered.map((start, i) => {
          const end = i + 1 < ordered.length ? ordered[i + 1] : text.length
          const title = manualTitles.get(start) ?? `第 ${i + 1} 章`
          return {
            index: i,
            title,
            start,
            end,
            charCount: Math.max(0, end - start),
            level: 1,
            source: manualTitles.has(start) ? 'manual' : 'auto',
            confidence: manualTitles.has(start) ? 1 : result.score,
          }
        })
        setSections(normalize(rebuilt, text.length))
        setMessage('已重跑识别，人工调整的章节已保留')
      } else {
        setSections(result.sections)
        setMessage('已重跑识别（全部重算）')
      }
      setMeta({ strategy: result.strategy, score: result.score, warnings: result.warnings })
      setDirty(true)
      setSelected(0)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  async function save(): Promise<void> {
    if (!bookId) return
    setBusy(true)
    try {
      const finalSections = normalize(
        sections.map((s) => ({ ...s })),
        text.length,
      )
      await sectionRepository.save(bookId, finalSections, meta)
      setDirty(false)
      navigate(`/reader/${bookId}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
      setBusy(false)
    }
  }

  if (!book) {
    return <div className={styles.loading}>正在读取书籍…</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className="btn btn-ghost" onClick={() => navigate('/')} title="返回书架">
          <BackIcon />
        </button>
        <span className={styles.bookIcon}>
          <BookIcon size={16} />
        </span>
        <div className={styles.headText}>
          <h1>{book.title}</h1>
          <p>
            {sections.length} 章 · {STRATEGY_LABEL[meta?.strategy ?? 'single']}
            {meta ? ` · 置信度 ${(meta.score * 100).toFixed(0)}%` : ''}
          </p>
        </div>
        <div className={styles.headActions}>
          <button className="btn" onClick={() => void rerun()} disabled={busy}>
            {busy ? '处理中…' : '重跑识别'}
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={busy || !dirty}>
            {dirty ? '保存并阅读' : '已保存'}
          </button>
        </div>
      </header>

      {meta?.warnings.length ? (
        <div className={styles.warnings}>
          {meta.warnings.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
      ) : null}
      {message ? <div className={styles.message}>{message}</div> : null}

      <div className={styles.body}>
        <section className={styles.listPane}>
          <div className={styles.paneHead}>
            <span>识别结果</span>
            <span className={styles.paneHint}>标题可直接编辑</span>
          </div>
          <ol className={styles.list}>
            {sections.map((section, index) => (
              <li key={`${section.start}-${index}`}>
                <div
                  className={`${styles.row} ${index === selected ? styles.rowActive : ''}`}
                  onClick={() => {
                    setSelected(index)
                    setSplitAt(null)
                  }}
                >
                  <span className={styles.rowIndex}>{index + 1}</span>
                  <input
                    className={styles.rowTitle}
                    value={section.title}
                    onChange={(event) => rename(index, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    spellCheck={false}
                  />
                  <span className={styles.rowMeta}>
                    {section.charCount} 字 · 偏移 {section.start}
                  </span>
                  <span
                    className={`${styles.source} ${section.source === 'manual' ? styles.sourceManual : ''}`}
                  >
                    {section.source === 'manual' ? '人工' : `自动 ${(section.confidence * 100).toFixed(0)}%`}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.previewPane}>
          <div className={styles.paneHead}>
            <span>原文预览 · {current?.title}</span>
            <div className={styles.ops}>
              <button
                className="btn btn-ghost"
                onClick={() => mergeWithNext(selected)}
                disabled={selected >= sections.length - 1}
              >
                合并下一章
              </button>
              <button className="btn btn-ghost" onClick={splitHere} disabled={splitAt === null}>
                在此拆分
              </button>
              <button
                className="btn btn-danger"
                onClick={() => removeSection(selected)}
                disabled={sections.length <= 1}
              >
                删除
              </button>
            </div>
          </div>
          <p className={styles.hint}>
            点击任意段落可把它设为新的章节起点，然后点「在此拆分」。高亮行表示它是某个章节的开头。
          </p>
          <div className={styles.preview}>
            {previewParagraphs.map((p) => (
              <p
                key={p.offset}
                className={`${styles.previewPara} ${startsSet.has(p.offset) ? styles.startsWith : ''} ${
                  splitAt === p.offset ? styles.splitTarget : ''
                }`}
                onClick={() => setSplitAt(p.offset)}
              >
                {p.text}
              </p>
            ))}
            {previewParagraphs.length === 0 ? <p className={styles.hint}>本章没有正文内容。</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}

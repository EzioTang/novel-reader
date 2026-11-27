import { useMemo, useState } from 'react'
import type { Book } from '../../core/types'
import { importFileWithEncoding, type NeedEncoding } from './importService'
import styles from './EncodingDialog.module.css'

interface Props {
  need: NeedEncoding
  onResolved: (book: Book) => void
  onSkip: () => void
}

export function EncodingDialog({ need, onResolved, onSkip }: Props): JSX.Element {
  const [selected, setSelected] = useState(() => need.candidates[0]?.encoding ?? 'gb18030')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = useMemo(
    () => need.candidates.find((c) => c.encoding === selected) ?? need.candidates[0],
    [need.candidates, selected],
  )

  async function handleConfirm(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const book = await importFileWithEncoding(need, selected)
      onResolved(book)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="选择文件编码">
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2>这个文件的编码无法自动确认</h2>
          <p>
            <strong>{need.fileName}</strong> 用默认探测解码后出现乱码。请选择一个编码，
            下方预览会跟着变化，看到正常中文即可确认。
          </p>
        </header>

        <div className={styles.body}>
          <ul className={styles.options}>
            {need.candidates.map((candidate) => (
              <li key={candidate.encoding}>
                <label
                  className={`${styles.option} ${selected === candidate.encoding ? styles.optionActive : ''}`}
                >
                  <input
                    type="radio"
                    name="encoding"
                    value={candidate.encoding}
                    checked={selected === candidate.encoding}
                    onChange={() => setSelected(candidate.encoding)}
                  />
                  <span className={styles.optionName}>{candidate.encoding.toUpperCase()}</span>
                  <span className={styles.optionMeta}>
                    {candidate.replacementRatio === 0
                      ? '无替换字符'
                      : `替换字符 ${(candidate.replacementRatio * 100).toFixed(2)}%`}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className={styles.preview}>
            <div className={styles.previewHead}>预览（前 200 字）</div>
            <pre className={styles.previewBody}>{current?.preview || '（无法预览）'}</pre>
          </div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <footer className={styles.footer}>
          <button className="btn btn-ghost" onClick={onSkip} disabled={busy}>
            跳过这个文件
          </button>
          <button className="btn btn-primary" onClick={() => void handleConfirm()} disabled={busy}>
            {busy ? '导入中…' : '用这个编码导入'}
          </button>
        </footer>
      </div>
    </div>
  )
}

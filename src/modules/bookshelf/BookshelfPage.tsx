import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Book } from '../../core/types'
import { useBookshelfStore } from '../../stores/bookshelfStore'
import { BookIcon, ListIcon, PlusIcon, SettingsIcon, TrashIcon } from '../../ui/icons'
import { EncodingDialog } from '../importer/EncodingDialog'
import type { NeedEncoding } from '../importer/importService'
import styles from './BookshelfPage.module.css'

function coverTone(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360
  return `hsl(${hash} 26% 62%)`
}

function formatCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)} 万字`
  return `${count} 字`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function BookshelfPage(): JSX.Element {
  const books = useBookshelfStore((s) => s.books)
  const loading = useBookshelfStore((s) => s.loading)
  const importing = useBookshelfStore((s) => s.importing)
  const error = useBookshelfStore((s) => s.error)
  const load = useBookshelfStore((s) => s.load)
  const importBooks = useBookshelfStore((s) => s.importBooks)
  const removeBook = useBookshelfStore((s) => s.removeBook)
  const navigate = useNavigate()

  const [encodingQueue, setEncodingQueue] = useState<NeedEncoding[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function handleImport(): Promise<void> {
    const report = await importBooks()
    if (report.imported.length > 0) {
      setNotice(`已导入 ${report.imported.length} 本`)
      const last = report.imported[report.imported.length - 1]
      navigate(`/reader/${last.id}`)
      return
    }
    if (report.needsEncoding.length > 0) {
      setEncodingQueue(report.needsEncoding)
      return
    }
    if (report.failures.length > 0) setNotice('导入失败，请查看提示')
    else setNotice('已取消导入')
  }

  async function handleDelete(book: Book): Promise<void> {
    const confirmed = window.confirm(`确定从书架删除《${book.title}》？正文与阅读进度会一并清除。`)
    if (!confirmed) return
    await removeBook(book.id)
    setNotice('已删除')
  }

  function handleEncodingResolved(book: Book): void {
    setEncodingQueue((queue) => queue.slice(1))
    navigate(`/reader/${book.id}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>
            <BookIcon size={20} />
          </span>
          <div>
            <h1 className={styles.title}>书架</h1>
            <p className={styles.subtitle}>
              {loading ? '加载中…' : `共 ${books.length} 本 · 本地 TXT 库`}
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <button className="btn btn-ghost" onClick={() => navigate('/settings')}>
            <SettingsIcon size={16} />
            设置
          </button>
          <button className="btn btn-primary" onClick={() => void handleImport()} disabled={importing}>
            <PlusIcon size={16} />
            {importing ? '导入中…' : '导入书籍'}
          </button>
        </div>
      </header>

      {error ? <div className={styles.errorBar}>{error}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}

      <main className={styles.main}>
        {books.length === 0 && !loading ? (
          <div className={styles.empty}>
            <div className={styles.emptyBook} aria-hidden>
              <BookIcon size={46} />
            </div>
            <h2>书架还是空的</h2>
            <p>
              点击右上角「导入书籍」选择本地 <code>.txt</code> 文件。
              <br />
              导入后会自动识别章节，再进入阅读页调字号。
            </p>
            <button className="btn btn-primary" onClick={() => void handleImport()}>
              <PlusIcon size={16} />
              选一本开始
            </button>
          </div>
        ) : (
          <ul className={styles.grid}>
            {books.map((book) => (
              <li key={book.id}>
                <article
                  className={styles.card}
                  onClick={() => navigate(`/reader/${book.id}`)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') navigate(`/reader/${book.id}`)
                  }}
                >
                  <div
                    className={styles.cover}
                    style={{ background: coverTone(book.title) }}
                    aria-hidden
                  >
                    <span>{book.title.slice(0, 1)}</span>
                  </div>
                  <h3 className={styles.bookTitle} title={book.title}>
                    {book.title}
                  </h3>
                  <p className={styles.bookMeta}>
                    {book.author ? `${book.author} · ` : ''}
                    {formatCount(book.charCount)}
                  </p>
                  <p className={styles.bookSub}>
                    {book.encoding} · {formatDate(book.createdAt)}
                  </p>
                  <div className={styles.cardActions}>
                    <button
                      className={`btn btn-ghost ${styles.smallBtn}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        navigate(`/recognize/${book.id}`)
                      }}
                      title="查看并校正章节"
                    >
                      <ListIcon size={14} />
                      校章
                    </button>
                    <button
                      className={`btn btn-danger ${styles.smallBtn}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDelete(book)
                      }}
                      title="从书架删除"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </main>

      {encodingQueue.length > 0 ? (
        <EncodingDialog
          need={encodingQueue[0]}
          onResolved={handleEncodingResolved}
          onSkip={() => setEncodingQueue((queue) => queue.slice(1))}
        />
      ) : null}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FONT_SIZE } from '../../core/types'
import {
  canDecrease,
  canIncrease,
  readerMaxWidth,
  stepFontSize,
  type FontSizeAction,
} from '../../core/settings/fontSize'
import {
  FONT_FAMILIES,
  LINE_HEIGHT,
  PAGE_MARGIN,
  PARAGRAPH_SPACING,
  effectiveFontSize,
  resolveFontStack,
} from '../../core/settings/typography'
import { useReaderStore } from '../../stores/readerStore'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  BackIcon,
  FontIcon,
  FullscreenIcon,
  ImmersiveIcon,
  ListIcon,
  SettingsIcon,
} from '../../ui/icons'
import { VirtualList } from '../../ui/VirtualList'
import { captureAnchor, paragraphsOf, restoreAnchor } from './paragraphs'
import styles from './ReaderPage.module.css'

const PROGRESS_THROTTLE = 2000
/** 目录条目固定行高，虚拟滚动依赖它 */
const TOC_ITEM_HEIGHT = 34
/** 自动隐藏模式下，鼠标进入窗口顶部这么多像素时浮出工具栏 */
const REVEAL_ZONE = 24
/** 进入工具栏高度范围内保持可见，避免手一抖就收起 */
const REVEAL_KEEP = 64
/** 离开顶部区域后多久收起工具栏 */
const REVEAL_LINGER = 1600
/** 章末越界滚动多少像素触发自动翻章 */
const OVERSCROLL_TRIGGER = 120
/** 两次滚动间隔超过这个时间就重置越界累计 */
const OVERSCROLL_IDLE = 420

export function ReaderPage(): JSX.Element {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()

  const book = useReaderStore((s) => s.book)
  const text = useReaderStore((s) => s.text)
  const sections = useReaderStore((s) => s.sections)
  const meta = useReaderStore((s) => s.meta)
  const sectionIndex = useReaderStore((s) => s.sectionIndex)
  const offset = useReaderStore((s) => s.offset)
  const loading = useReaderStore((s) => s.loading)
  const error = useReaderStore((s) => s.error)
  const load = useReaderStore((s) => s.load)
  const goToSection = useReaderStore((s) => s.goToSection)
  const setProgress = useReaderStore((s) => s.setProgress)
  const flushProgress = useReaderStore((s) => s.flushProgress)
  const reset = useReaderStore((s) => s.reset)

  const settings = useSettingsStore((s) => s.settings)
  const setFontSize = useSettingsStore((s) => s.setFontSize)
  const setBookFontSize = useSettingsStore((s) => s.setBookFontSize)
  const clearBookFontSize = useSettingsStore((s) => s.clearBookFontSize)
  const setImmersive = useSettingsStore((s) => s.setImmersive)
  const setFontFamily = useSettingsStore((s) => s.setFontFamily)
  const setLineHeight = useSettingsStore((s) => s.setLineHeight)
  const setParagraphSpacing = useSettingsStore((s) => s.setParagraphSpacing)
  const setPageMargin = useSettingsStore((s) => s.setPageMargin)

  const fontSize = effectiveFontSize(settings, bookId)
  const perBook = typeof (bookId ? settings.fontSizeByBook?.[bookId] : undefined) === 'number'
  const immersive = settings.immersiveReading
  /** 只有显式打开「自动隐藏工具栏」时才隐藏；默认沉浸只去边框，工具栏常驻 */
  const autoHide = immersive && settings.immersiveAutoHide

  const scrollRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  /** 已经定位过的章节起始偏移，用来区分「换章」与「章内滚动」 */
  const positionedSectionRef = useRef<number | null>(null)
  /** 滚动事件的 requestAnimationFrame 节流句柄 */
  const scrollRafRef = useRef<number | null>(null)
  /** 章末越界滚动的累计像素与上次时间，用于自动翻章 */
  const overscrollRef = useRef(0)
  const lastWheelAtRef = useRef(0)

  const [tocOpen, setTocOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const pressTimer = useRef<number | null>(null)
  const pressInterval = useRef<number | null>(null)

  const section = sections[sectionIndex]
  const prevSection = sections[sectionIndex - 1]
  const nextSection = sections[sectionIndex + 1]
  const paragraphs = useMemo(
    () => (section ? paragraphsOf(text, section.start, section.end, section.title) : []),
    [text, section],
  )
  const percent = useMemo(() => {
    if (!section || text.length === 0) return 0
    const absolute = section.start + offset
    return Math.min(100, Math.max(0, (absolute / text.length) * 100))
  }, [section, offset, text.length])

  const chromeShown = !autoHide || chromeVisible

  useEffect(() => {
    if (bookId) void load(bookId)
    return () => {
      void flushProgress()
      reset()
    }
  }, [bookId, load, flushProgress, reset])

  // 进入/退出沉浸或切换「自动隐藏」时重置工具栏可见性
  useEffect(() => {
    setChromeVisible(!autoHide)
    if (!autoHide && hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [autoHide])

  // 全屏状态与主进程对齐（F11 走原生菜单时也能同步）
  useEffect(() => {
    void window.api?.window.isFullScreen().then(setFullscreen)
  }, [])

  // 只在「换章」时重定位：首次进入回到上次字符偏移，切章回到章首。
  // 注意不能依赖 offset —— 滚动时 offset 每帧都会变，若把它当触发条件会把页面不断拉回顶部。
  useEffect(() => {
    const container = scrollRef.current
    if (!container || !section) return
    if (positionedSectionRef.current === section.start) return

    const firstPositioning = positionedSectionRef.current === null
    positionedSectionRef.current = section.start

    if (firstPositioning && offset > 0) {
      requestAnimationFrame(() => {
        const el = scrollRef.current
        if (!el) return
        const node = el.querySelector<HTMLElement>(`[data-offset="${section.start + offset}"]`)
        if (!node) return
        el.scrollTop += node.getBoundingClientRect().top - el.getBoundingClientRect().top
      })
      return
    }
    container.scrollTop = 0
  }, [section, offset])

  const changeFontSize = useCallback(
    (next: number) => {
      const container = scrollRef.current
      const anchor = container ? captureAnchor(container) : null
      if (bookId && perBook) setBookFontSize(bookId, next)
      else setFontSize(next)
      if (container && anchor !== null) {
        requestAnimationFrame(() => {
          const el = scrollRef.current
          if (el) restoreAnchor(el, anchor)
        })
      }
    },
    [bookId, perBook, setBookFontSize, setFontSize],
  )

  const applyAction = useCallback(
    (action: FontSizeAction) => changeFontSize(stepFontSize(fontSize, action)),
    [changeFontSize, fontSize],
  )

  const toggleFullscreen = useCallback(async () => {
    const next = await window.api.window.setFullScreen(!fullscreen)
    setFullscreen(next)
  }, [fullscreen])

  // 快捷键：Ctrl/Cmd + = / - / 0 调字号；无修饰键时左右方向键翻章；Esc 退出全屏
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true
      const mod = event.ctrlKey || event.metaKey
      if (mod) {
        if (event.key === '=' || event.key === '+') {
          event.preventDefault()
          applyAction('increase')
        } else if (event.key === '-') {
          event.preventDefault()
          applyAction('decrease')
        } else if (event.key === '0') {
          event.preventDefault()
          applyAction('reset')
        }
        return
      }
      if (event.key === 'Escape' && fullscreen) {
        void window.api.window.setFullScreen(false).then(setFullscreen)
        return
      }
      if (typing) return
      if (event.key === 'ArrowRight') goToSection(sectionIndex + 1)
      if (event.key === 'ArrowLeft') goToSection(sectionIndex - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [applyAction, fullscreen, goToSection, sectionIndex])

  // 滚轮：Ctrl 缩放字号；普通滚动在章末越界时按设置自动翻章
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const onWheel = (event: WheelEvent): void => {
      if (event.ctrlKey) {
        event.preventDefault()
        applyAction(event.deltaY > 0 ? 'decrease' : 'increase')
        return
      }
      if (!settings.autoNextChapter || tocOpen || panelOpen) return
      // 章节内容不足一屏时，「已到章末」永远成立，不能据此翻章
      if (container.scrollHeight <= container.clientHeight + 24) return

      const now = performance.now()
      if (now - lastWheelAtRef.current > OVERSCROLL_IDLE) overscrollRef.current = 0
      lastWheelAtRef.current = now

      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 2
      const atTop = container.scrollTop <= 0

      if (atBottom && event.deltaY > 0) {
        overscrollRef.current += event.deltaY
      } else if (atTop && event.deltaY < 0) {
        overscrollRef.current += -event.deltaY
      } else {
        overscrollRef.current = 0
        return
      }

      if (overscrollRef.current >= OVERSCROLL_TRIGGER) {
        overscrollRef.current = 0
        goToSection(sectionIndex + (event.deltaY > 0 ? 1 : -1))
      }
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [applyAction, goToSection, sectionIndex, settings.autoNextChapter, tocOpen, panelOpen])

  const scheduleProgressSave = useCallback(() => {
    if (saveTimerRef.current !== null) return
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void flushProgress()
    }, PROGRESS_THROTTLE)
  }, [flushProgress])

  // 滚动回写进度：用 rAF 节流，避免每个 scroll 事件都遍历段落量 rect
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null
      const container = scrollRef.current
      if (!container || !section) return
      const anchor = captureAnchor(container)
      if (anchor !== null) setProgress(sectionIndex, Math.max(0, anchor - section.start))
      scheduleProgressSave()
    })
  }, [section, sectionIndex, setProgress, scheduleProgressSave])

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current)
      if (scrollRafRef.current !== null) window.cancelAnimationFrame(scrollRafRef.current)
    },
    [],
  )

  // 自动隐藏模式下：鼠标靠近顶部浮出工具栏，离开后延时收起。
  // 目录或排版面板打开时视为「正在操作界面」，不自动收起，否则点着点着工具条就没了。
  const handlePointerMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!autoHide) return

      if (tocOpen || panelOpen) {
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current)
          hideTimerRef.current = null
        }
        setChromeVisible(true)
        return
      }

      if (event.clientY <= REVEAL_ZONE) {
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current)
          hideTimerRef.current = null
        }
        setChromeVisible(true)
        return
      }
      // 落在工具栏高度范围内不收起，避免手一抖工具栏就消失
      if (event.clientY <= REVEAL_KEEP) return
      if (!chromeVisible || hideTimerRef.current !== null) return
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null
        setChromeVisible(false)
      }, REVEAL_LINGER)
    },
    [autoHide, chromeVisible, tocOpen, panelOpen],
  )

  function startPressRepeat(action: FontSizeAction): void {
    stopPressRepeat()
    pressTimer.current = window.setTimeout(() => {
      pressInterval.current = window.setInterval(() => applyAction(action), 120)
    }, 420)
  }

  function stopPressRepeat(): void {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current)
    if (pressInterval.current !== null) window.clearInterval(pressInterval.current)
    pressTimer.current = null
    pressInterval.current = null
  }

  if (loading) {
    return <div className={styles.center}>正在打开…</div>
  }

  if (error) {
    return (
      <div className={styles.center}>
        <p>{error}</p>
        <button className="btn" onClick={() => navigate('/')}>
          返回书架
        </button>
      </div>
    )
  }

  if (!book || !section) {
    return (
      <div className={styles.center}>
        <p>这本书还没有章节结构。</p>
        <button className="btn btn-primary" onClick={() => navigate(`/recognize/${bookId}`)}>
          去校正章节
        </button>
      </div>
    )
  }

  const pageClass = [
    styles.page,
    tocOpen ? styles.withToc : '',
    immersive ? styles.immersive : '',
    !chromeShown ? styles.chromeHidden : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={pageClass}
      onMouseMove={handlePointerMove}
      style={
        {
          '--reader-font-size': `${fontSize}px`,
          '--reader-line-height': String(settings.lineHeight),
          '--reader-max-width': `${readerMaxWidth(fontSize)}px`,
          '--reader-font-family': resolveFontStack(settings.fontFamily),
          '--reader-para-spacing': `${settings.paragraphSpacing}em`,
          '--reader-padding-x': `${settings.pageMargin}px`,
        } as React.CSSProperties
      }
    >
      <header className={`${styles.toolbar} ${immersive ? styles.floating : ''}`}>
        <button className="btn btn-ghost" onClick={() => navigate('/')} title="返回书架">
          <BackIcon />
        </button>
        <div className={styles.titleWrap}>
          <span className={styles.bookTitle} title={book.title}>
            {book.title}
          </span>
          <span className={styles.chapterTitle}>{section.title}</span>
        </div>

        <div className={styles.toolbarRight}>
          <span className={styles.metaHint} title={meta ? `识别策略：${meta.strategy}` : undefined}>
            {sectionIndex + 1} / {sections.length}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => setTocOpen((v) => !v)}
            title="目录"
            aria-pressed={tocOpen}
          >
            <ListIcon />
          </button>
          <div className={styles.fontGroup}>
            <button
              className={styles.fontButton}
              disabled={!canDecrease(fontSize)}
              onMouseDown={() => startPressRepeat('decrease')}
              onMouseUp={stopPressRepeat}
              onMouseLeave={stopPressRepeat}
              onClick={() => applyAction('decrease')}
              title="减小字号（Ctrl + -）"
            >
              A−
            </button>
            <button
              className={styles.fontValue}
              onClick={() => setPanelOpen((v) => !v)}
              title="排版面板"
            >
              {fontSize}
            </button>
            <button
              className={styles.fontButton}
              disabled={!canIncrease(fontSize)}
              onMouseDown={() => startPressRepeat('increase')}
              onMouseUp={stopPressRepeat}
              onMouseLeave={stopPressRepeat}
              onClick={() => applyAction('increase')}
              title="增大字号（Ctrl + =）"
            >
              A+
            </button>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => setImmersive(!immersive)}
            title={immersive ? '退出无边框模式' : '无边框沉浸阅读'}
            aria-pressed={immersive}
          >
            <ImmersiveIcon />
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => void toggleFullscreen()}
            title={fullscreen ? '退出全屏（Esc）' : '全屏（F11）'}
            aria-pressed={fullscreen}
          >
            <FullscreenIcon />
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/settings')} title="设置">
            <SettingsIcon />
          </button>
        </div>
      </header>

      {tocOpen ? (
        <aside className={styles.toc}>
          <div className={styles.tocHead}>
            目录
            <span className={styles.tocCount}>{sections.length} 章</span>
          </div>
          <VirtualList
            items={sections}
            itemHeight={TOC_ITEM_HEIGHT}
            activeIndex={sectionIndex}
            ariaLabel="章节目录"
            className={styles.tocViewport}
            renderItem={(item, index) => (
              <button
                className={`${styles.tocItem} ${index === sectionIndex ? styles.tocActive : ''} ${
                  item.level === 2 ? styles.tocLevel2 : ''
                }`}
                onClick={() => {
                  goToSection(item.index)
                  if (window.innerWidth < 900) setTocOpen(false)
                }}
              >
                <span className={styles.tocIndex}>{index + 1}</span>
                <span className={styles.tocTitle}>{item.title}</span>
              </button>
            )}
          />
        </aside>
      ) : null}

      {panelOpen ? (
        <div className={styles.fontPanel} role="dialog" aria-label="排版设置">
          <div className={styles.fontPanelHead}>
            <FontIcon size={15} />
            <span>排版</span>
            <span className={styles.fontPanelHint}>
              字号 {fontSize}px · {FONT_SIZE.min}–{FONT_SIZE.max}
            </span>
          </div>

          <input
            className={styles.slider}
            type="range"
            min={FONT_SIZE.min}
            max={FONT_SIZE.max}
            step={FONT_SIZE.step}
            value={fontSize}
            onChange={(event) => changeFontSize(Number(event.target.value))}
            aria-label="字号"
          />
          <div className={styles.presets}>
            {FONT_SIZE.presets.map((preset) => (
              <button
                key={preset}
                className={`${styles.preset} ${preset === fontSize ? styles.presetActive : ''}`}
                onClick={() => changeFontSize(preset)}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>字体</span>
            <div className={styles.chips}>
              {FONT_FAMILIES.map((family) => (
                <button
                  key={family.value}
                  className={`${styles.chip} ${
                    settings.fontFamily === family.value ? styles.chipActive : ''
                  }`}
                  onClick={() => setFontFamily(family.value)}
                  aria-pressed={settings.fontFamily === family.value}
                >
                  {family.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>行距</span>
            <input
              className={styles.slider}
              type="range"
              min={LINE_HEIGHT.min}
              max={LINE_HEIGHT.max}
              step={LINE_HEIGHT.step}
              value={settings.lineHeight}
              onChange={(event) => setLineHeight(Number(event.target.value))}
              aria-label="行距"
            />
            <span className={styles.fieldValue}>{settings.lineHeight.toFixed(2)}</span>
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>段距</span>
            <input
              className={styles.slider}
              type="range"
              min={PARAGRAPH_SPACING.min}
              max={PARAGRAPH_SPACING.max}
              step={PARAGRAPH_SPACING.step}
              value={settings.paragraphSpacing}
              onChange={(event) => setParagraphSpacing(Number(event.target.value))}
              aria-label="段间距"
            />
            <span className={styles.fieldValue}>{settings.paragraphSpacing.toFixed(1)}em</span>
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>页边距</span>
            <input
              className={styles.slider}
              type="range"
              min={PAGE_MARGIN.min}
              max={PAGE_MARGIN.max}
              step={PAGE_MARGIN.step}
              value={settings.pageMargin}
              onChange={(event) => setPageMargin(Number(event.target.value))}
              aria-label="页边距"
            />
            <span className={styles.fieldValue}>{settings.pageMargin}px</span>
          </div>

          {bookId ? (
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>仅本书</span>
              <button
                className={`${styles.switch} ${perBook ? styles.switchOn : ''}`}
                onClick={() => {
                  if (perBook) clearBookFontSize(bookId)
                  else setBookFontSize(bookId, fontSize)
                }}
                aria-pressed={perBook}
                aria-label="仅本书"
                title="只让这本书使用独立字号"
              >
                {perBook ? '开' : '关'}
              </button>
              <span className={styles.fieldHint}>
                {perBook ? `本书锁定 ${fontSize}px，不影响其他书` : '字号修改对所有书生效'}
              </span>
            </div>
          ) : null}

          <div className={styles.fontPanelFoot}>
            <span>Ctrl + = / − 调节 · Ctrl + 0 复位 · Ctrl + 滚轮缩放</span>
            <button className="btn btn-ghost" onClick={() => setPanelOpen(false)}>
              收起
            </button>
          </div>
        </div>
      ) : null}

      <main className={styles.scroll} ref={scrollRef} onScroll={handleScroll}>
        <article className={styles.article}>
          <h2 className={styles.chapterHeading}>{section.title}</h2>
          {paragraphs.map((p) => (
            <p key={p.offset} data-offset={p.offset} className={styles.paragraph}>
              {p.text}
            </p>
          ))}
          <div className={styles.chapterEnd}>· 本章完 ·</div>

          {/* 章末导航：读完就地翻章，不必再把鼠标移到窗口顶部 */}
          <nav className={styles.chapterNav} aria-label="章节导航">
            <div className={styles.chapterNavRow}>
              <button
                className="btn"
                onClick={() => goToSection(sectionIndex - 1)}
                disabled={!prevSection}
                aria-label="返回上一章"
              >
                ← 上一章
              </button>
              <button className="btn" onClick={() => setTocOpen(true)} aria-label="打开目录">
                目录
              </button>
              <button
                className="btn btn-primary"
                onClick={() => goToSection(sectionIndex + 1)}
                disabled={!nextSection}
                aria-label="进入下一章"
              >
                下一章 →
              </button>
            </div>
            <p className={styles.chapterNavHint}>
              {nextSection ? `下一章：${nextSection.title}` : '已经是最后一章'}
              <span className={styles.chapterNavKey}>
                {settings.autoNextChapter ? '· 继续向下滚动自动翻章' : '· 快捷键 ← →'}
              </span>
            </p>
          </nav>
        </article>
      </main>

      <footer className={`${styles.footer} ${immersive ? styles.floating : ''}`}>
        <button
          className="btn btn-ghost"
          onClick={() => goToSection(sectionIndex - 1)}
          disabled={sectionIndex <= 0}
        >
          上一章
        </button>
        <div className={styles.progressWrap}>
          <div className={styles.progressBar}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <span className={styles.progressText}>{percent.toFixed(1)}%</span>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => goToSection(sectionIndex + 1)}
          disabled={sectionIndex >= sections.length - 1}
        >
          下一章
        </button>
      </footer>
    </div>
  )
}

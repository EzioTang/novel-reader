import { useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './VirtualList.module.css'

interface VirtualListProps<T> {
  items: T[]
  /** 固定行高（px）：虚拟滚动依赖它，渲染的条目必须与之等高 */
  itemHeight: number
  renderItem: (item: T, index: number) => ReactNode
  overscan?: number
  className?: string
  /** 自动把该项滚入视野（用于目录高亮当前章） */
  activeIndex?: number
  ariaLabel?: string
}

/**
 * 极简固定行高虚拟列表：3873 章的目录只渲染可视区约 20 项。
 * 不引入第三方依赖，也不做动态测量 —— 目录条目是单行等高的，固定行高足够。
 */
export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 6,
  className,
  activeIndex,
  ariaLabel,
}: VirtualListProps<T>): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = (): void => setViewport(el.clientHeight)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 当前章变化时把它滚进视野（已可见则不动，避免抢用户滚动）
  useEffect(() => {
    const el = scrollRef.current
    if (!el || activeIndex === undefined || activeIndex < 0) return
    const top = activeIndex * itemHeight
    const visible = el.scrollTop <= top && top + itemHeight <= el.scrollTop + el.clientHeight
    if (visible) return
    el.scrollTop = Math.max(0, top - el.clientHeight / 2 + itemHeight / 2)
  }, [activeIndex, itemHeight])

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const handleScroll = (): void => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop)
    })
  }

  const total = items.length * itemHeight
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const end = Math.min(items.length, Math.ceil((scrollTop + viewport) / itemHeight) + overscan)
  const visible = items.slice(start, end)

  return (
    <div
      ref={scrollRef}
      className={`${styles.viewport} ${className ?? ''}`}
      onScroll={handleScroll}
      role="list"
      aria-label={ariaLabel}
    >
      <div className={styles.spacer} style={{ height: total }}>
        <div className={styles.slice} style={{ transform: `translateY(${start * itemHeight}px)` }}>
          {visible.map((item, offset) => (
            <div key={start + offset} style={{ height: itemHeight }}>
              {renderItem(item, start + offset)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

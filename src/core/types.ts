/** 《开发框架.md》第 8 节领域模型。时间戳统一毫秒级 Unix 时间。 */

export interface Book {
  id: string
  title: string
  author?: string
  format: 'txt' | 'epub'
  encoding: string
  byteSize: number
  charCount: number
  createdAt: number
  updatedAt: number
}

/** 章节区间：只存偏移，正文不重复存储 */
export interface ChapterSection {
  index: number
  title: string
  /** 归一化后文本中的字符偏移 */
  start: number
  end: number
  charCount: number
  /** 1 = 卷/章，2 = 卷下的章 */
  level: 1 | 2
  source: 'auto' | 'manual'
  confidence: number
}

export type RecognizeStrategy =
  | 'chapter-regex'
  | 'volume-chapter'
  | 'char-count'
  | 'blank-line'
  | 'single'

export interface RecognitionResult {
  bookId: string
  strategy: RecognizeStrategy
  score: number
  sections: ChapterSection[]
  /** 如「仅识别到 3 章，建议人工校正」 */
  warnings: string[]
  /** 分数接近的备选方案（差值 < 0.05 时给出，供用户选择） */
  alternatives?: RecognitionResult[]
}

export interface ReadingProgress {
  bookId: string
  sectionIndex: number
  /** 章内字符偏移 */
  offset: number
  updatedAt: number
}

export type ThemeMode = 'light' | 'dark' | 'eye-care' | 'system'

/** 实际生效的配色（system 已在运行时解析掉） */
export type ResolvedTheme = 'light' | 'dark' | 'eye-care'

/** 正文字体族：存 key 而不是完整 font stack，便于迁移与本地化 */
export type FontFamilyKey = 'system' | 'serif' | 'sans' | 'kai'

export interface ReaderSettings {
  fontFamily: FontFamilyKey
  /** 12–48，全局字号 */
  fontSize: number
  /** 行距倍数，5–30 之间实际按 1.2–3.0 使用 */
  lineHeight: number
  /** true = 随字号自动派生；false = 用户手动锁定 */
  lineHeightAuto: boolean
  /** 段间距（em） */
  paragraphSpacing: number
  /** 正文左右页边距（px） */
  pageMargin: number
  theme: ThemeMode
  pageMode: 'horizontal' | 'scroll'
  /** 无边框沉浸阅读：隐藏所有分隔线/描边，正文铺满 */
  immersiveReading: boolean
  /**
   * 沉浸模式下是否自动隐藏工具栏。
   * 默认 false：沉浸只去边框，工具栏与底栏常驻（v0.2.0 反馈：藏起来后章末找不到翻章入口）。
   */
  immersiveAutoHide: boolean
  /** 章末继续向下滚动时自动进入下一章（默认关，避免误触发） */
  autoNextChapter: boolean
  /** 可选：单书字号覆盖 */
  fontSizeByBook?: Record<string, number>
}

export const FONT_SIZE = {
  min: 12,
  max: 48,
  step: 1,
  default: 20,
  presets: [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48],
} as const

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontFamily: 'serif',
  fontSize: FONT_SIZE.default,
  lineHeight: 1.9,
  lineHeightAuto: true,
  paragraphSpacing: 0.6,
  pageMargin: 32,
  theme: 'light',
  pageMode: 'scroll',
  immersiveReading: false,
  immersiveAutoHide: false,
  autoNextChapter: false,
}

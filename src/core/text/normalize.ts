/** 文本归一化与按行切分（偏移以归一化后文本为基准）。 */

export interface TextLine {
  /** 行内容（不含换行符） */
  text: string
  /** 行在文本中的起始偏移 */
  start: number
  /** 行结束偏移（不含换行符） */
  end: number
}

/**
 * 归一化：去 BOM、\r\n→\n、全角空格→半角、去行尾空白、去首尾空行。
 * 偏移、字数统计一律基于归一化后的文本。
 */
export function normalizeText(raw: string): string {
  let text = raw
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  text = text.replace(/\u3000/g, ' ').replace(/\u00a0/g, ' ')
  text = text.replace(/[ \t]+\n/g, '\n')
  return text.replace(/^\n+/, '').replace(/\n+$/, '')
}

/** 按行切分，保留每行在全文中的偏移 */
export function splitLines(text: string): TextLine[] {
  const lines: TextLine[] = []
  let start = 0
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text.charAt(i) === '\n') {
      lines.push({ text: text.slice(start, i), start, end: i })
      start = i + 1
    }
  }
  // 末行为空（文本以 \n 结尾）时丢弃，避免产生零长度的幽灵行
  if (lines.length > 0 && lines[lines.length - 1].text === '' && text.endsWith('\n')) {
    lines.pop()
  }
  return lines
}

/** 去掉标题前后的装饰符号：★☆●■□◆◇【】[]（）()《》「」·、空格与编号前缀 */
export function stripDecoration(raw: string): string {
  let title = raw.trim()
  title = title.replace(/^[*#=\-—~·•※★☆●○■□◆◇▶►▷\s]+/, '')
  // 成对包裹的装饰：【第一章】、（一）、《书名》
  const paired = /^([【[（(〔《「『])(.+)([】\]）)〕》」』])$/.exec(title)
  if (paired) title = paired[2].trim()
  title = title.replace(/^[*#=\-—~·•※★☆●○■□◆◇▶►▷\s]+/, '')
  return title.trim()
}

/** 句号：正文的强标志。标题几乎不会以「。」结尾，正文一定会出现 */
const PROSE_STOP = /[。]/

/** 严格模式（空行短行启发式）额外拒绝的标点：标题不会一句一顿 */
const DENSE_PUNCT = /[！？；…，,、]/

/**
 * 行是否「像标题」：够短、独立成行、不像散文句子、不是对话。
 *
 * 注意：真实小说的标题里经常带 ？！，、 —— 例如「第二十六章 凛冬将至！」「第五十章 放火烧山，牢底坐穿」，
 * 因此只把「。」与「以逗号结尾」当作正文标志，避免误杀（实测某本 3866 章的书会漏 36 章）。
 * blank-line 启发式走 strict 模式，仍然拒绝所有密集标点。
 */
export function looksLikeHeading(line: string, maxLength = 80, strict = false): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.length > maxLength) return false
  if (PROSE_STOP.test(trimmed)) return false
  if (strict && DENSE_PUNCT.test(trimmed)) return false
  if (/^[“"「『]/.test(trimmed)) return false
  // 以逗号/顿号结尾，通常是被硬折行的正文下半句
  if (/[，,、]$/.test(trimmed)) return false
  return true
}

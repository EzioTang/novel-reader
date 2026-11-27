/** 章节序号解析：阿拉伯数字、中文数字、罗马数字（Chapter IV）。 */

const CN_DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  壹: 1,
  二: 2,
  两: 2,
  贰: 2,
  三: 3,
  叁: 3,
  四: 4,
  肆: 4,
  五: 5,
  伍: 5,
  六: 6,
  陆: 6,
  七: 7,
  柒: 7,
  八: 8,
  捌: 8,
  九: 9,
  玖: 9,
}

const CN_UNITS: Record<string, number> = {
  十: 10,
  拾: 10,
  百: 100,
  佰: 100,
  千: 1000,
  仟: 1000,
  万: 10000,
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }

function parseRoman(raw: string): number | null {
  const s = raw.toUpperCase()
  if (!/^[IVXLCDM]+$/.test(s)) return null
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN[s.charAt(i)]
    const next = i + 1 < s.length ? ROMAN[s.charAt(i + 1)] : 0
    total += cur < next ? -cur : cur
  }
  return total > 0 ? total : null
}

function parseChineseNumber(raw: string): number | null {
  const s = raw.replace(/[第章节回卷\s]/g, '')
  if (s.length === 0) return null
  if (!/^[零〇一壹二两贰三叁四肆五伍六陆七柒八捌九玖十拾百佰千仟万]+$/.test(s)) return null

  let total = 0
  let section = 0
  let num = 0
  let seen = false
  for (const ch of s) {
    if (ch in CN_DIGITS) {
      num = CN_DIGITS[ch]
      seen = true
    } else {
      const unit = CN_UNITS[ch]
      if (unit === 10000) {
        section += num
        total += (section === 0 ? 1 : section) * unit
        section = 0
        num = 0
      } else {
        section += (num === 0 ? 1 : num) * unit
        num = 0
      }
      seen = true
    }
  }
  if (!seen) return null
  return total + section + num
}

/** 解析章节序号；无法识别（如纯标题「楔子」）返回 null */
export function parseChapterNumber(raw: string): number | null {
  const s = raw.trim()
  if (s.length === 0) return null
  if (/^\d{1,6}$/.test(s)) return Number(s)
  const roman = parseRoman(s)
  if (roman !== null) return roman
  return parseChineseNumber(s)
}

/** 从匹配到的捕获组文本里取序号，失败返回 null */
export function sequenceOf(capture: string | undefined): number | null {
  if (!capture) return null
  return parseChapterNumber(capture)
}

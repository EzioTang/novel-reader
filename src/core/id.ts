/** 稳定 ID：不依赖 crypto.randomUUID（file:// 下不保证可用）。 */
export function newId(prefix = 'b'): string {
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${time}${rand}`
}

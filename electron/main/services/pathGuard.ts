/** IPC 入参路径校验：只允许读取本机已存在的 .txt 普通文件，拒绝一切非常规路径。 */

import { stat } from 'node:fs/promises'
import { extname, isAbsolute, resolve } from 'node:path'

export const MAX_BOOK_BYTES = 512 * 1024 * 1024
export const ALLOWED_EXTENSIONS = ['.txt']

export class PathValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathValidationError'
  }
}

/** 校验并返回规范化的绝对路径；不合法时抛出带中文说明的错误 */
export async function assertReadableBookPath(input: unknown): Promise<string> {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new PathValidationError('文件路径无效')
  }
  if (input.includes('\0')) {
    throw new PathValidationError('文件路径包含非法字符')
  }
  if (!isAbsolute(input)) {
    throw new PathValidationError('只接受绝对路径')
  }
  const resolved = resolve(input)
  const info = await stat(resolved).catch(() => null)
  if (!info || !info.isFile()) {
    throw new PathValidationError('文件不存在或不是普通文件')
  }
  const ext = extname(resolved).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new PathValidationError(`v0.1 只支持 ${ALLOWED_EXTENSIONS.join(' / ')} 文件`)
  }
  if (info.size > MAX_BOOK_BYTES) {
    throw new PathValidationError('文件超过 512MB，暂不支持')
  }
  return resolved
}

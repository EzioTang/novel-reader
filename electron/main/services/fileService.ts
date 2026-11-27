/** 文件读取与编码解码编排（主进程侧）。 */

import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import {
  buildCandidates,
  decodeAuto,
  decodeWith,
  isSupportedEncoding,
} from '../../../shared/encoding'
import type { ReadTextResult } from '../../../shared/ipc'

export interface ReadBookFileExtra {
  fileName: string
}

export async function readBookFile(
  path: string,
  encoding?: string,
): Promise<ReadTextResult & ReadBookFileExtra> {
  const bytes = new Uint8Array(await readFile(path))
  const outcome =
    encoding && isSupportedEncoding(encoding) ? decodeWith(bytes, encoding) : decodeAuto(bytes)

  return {
    text: outcome.text,
    encoding: outcome.encoding,
    byteSize: bytes.byteLength,
    suspicious: outcome.suspicious,
    // 只有可疑时才算候选：正常文件不必让用户选
    candidates: outcome.suspicious ? buildCandidates(bytes) : [],
    fileName: basename(path),
  }
}

export async function statFile(path: string): Promise<{ size: number }> {
  const info = await stat(path)
  return { size: info.size }
}

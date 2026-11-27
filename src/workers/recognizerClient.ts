/** Worker 客户端：优先走 Worker，环境不支持（如单测）时回退到主线程同步执行。 */

import { recognize, type RecognizeOptions } from '../core/recognizer'
import type { RecognitionResult } from '../core/types'
import type { WorkerRequest, WorkerResponse } from './recognizer.worker'

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (r: RecognitionResult) => void; reject: (e: Error) => void }>()

function ensureWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./recognizer.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data
      const slot = pending.get(data.id)
      if (!slot) return
      pending.delete(data.id)
      if (data.ok) slot.resolve(data.result)
      else slot.reject(new Error(data.error))
    }
    worker.onerror = (event) => {
      const error = new Error(event.message || '识别 Worker 出错')
      for (const slot of pending.values()) slot.reject(error)
      pending.clear()
    }
    return worker
  } catch {
    worker = null
    return null
  }
}

export async function recognizeAsync(
  text: string,
  opts: RecognizeOptions = {},
): Promise<RecognitionResult> {
  const w = ensureWorker()
  if (!w) return recognize(text, opts)

  const id = ++seq
  const request: WorkerRequest = { id, text, opts }
  return new Promise<RecognitionResult>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage(request)
  })
}

/** 测试 / 关闭时释放 */
export function disposeRecognizerWorker(): void {
  worker?.terminate()
  worker = null
  pending.clear()
}

/** 识别 Worker：大文本切章不阻塞 UI（《开发框架.md》6.2 ②③）。 */

import { recognize, type RecognizeOptions } from '../core/recognizer'

export interface WorkerRequest {
  id: number
  text: string
  opts: RecognizeOptions
}

export type WorkerResponse =
  | { id: number; ok: true; result: ReturnType<typeof recognize> }
  | { id: number; ok: false; error: string }

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, text, opts } = event.data
  try {
    const result = recognize(text, opts)
    const response: WorkerResponse = { id, ok: true, result }
    self.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response)
  }
}

/**
 * 主进程 / 渲染进程共享的 IPC 契约（单一来源）。
 * preload 逐项透出为 window.api，通道命名统一为 `域:动作`。
 */

export const IPC = {
  dialogOpenBooks: 'dialog:openBooks',
  fileReadText: 'file:readText',
  fileStat: 'file:stat',
  appGetVersion: 'app:getVersion',
  appSetThemeSource: 'app:setThemeSource',
  windowSetFullScreen: 'window:setFullScreen',
  windowIsFullScreen: 'window:isFullScreen',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

export type ThemeSource = 'light' | 'dark' | 'system'

/** 单个候选编码的解码抽样，供「编码选择」弹框实时预览 */
export interface EncodingCandidate {
  encoding: string
  /** 前 200 字预览 */
  preview: string
  /** 替换字符（U+FFFD）占比，越低越可信 */
  replacementRatio: number
}

export interface ReadTextResult {
  text: string
  encoding: string
  byteSize: number
  /** 解码结果可疑（出现替换字符 / 无法可靠判定编码）时为 true，渲染层应弹出编码选择框 */
  suspicious: boolean
  /** 仅在 suspicious 时填充；按可信度排序 */
  candidates: EncodingCandidate[]
}

export interface Api {
  dialog: {
    openBooks(): Promise<string[]>
  }
  file: {
    /** 传入 encoding 时按指定编码解码（用户手动选择场景） */
    readText(path: string, encoding?: string): Promise<ReadTextResult>
    stat(path: string): Promise<{ size: number }>
  }
  app: {
    getVersion(): Promise<string>
    setThemeSource(theme: ThemeSource): void
  }
  window: {
    /** 沉浸阅读的可选全屏；返回设置后的实际状态 */
    setFullScreen(flag: boolean): Promise<boolean>
    isFullScreen(): Promise<boolean>
  }
}

export interface IpcResult<T> {
  ok: boolean
  data?: T
  error?: string
}

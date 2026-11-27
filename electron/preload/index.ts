/** preload：逐项透出白名单 IPC，渲染进程只能看到 window.api。 */

import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api } from '../../shared/ipc'

const api: Api = {
  dialog: {
    openBooks: () => ipcRenderer.invoke(IPC.dialogOpenBooks),
  },
  file: {
    readText: (path: string, encoding?: string) =>
      ipcRenderer.invoke(IPC.fileReadText, path, encoding),
    stat: (path: string) => ipcRenderer.invoke(IPC.fileStat, path),
  },
  app: {
    getVersion: () => ipcRenderer.invoke(IPC.appGetVersion),
    setThemeSource: (theme) => ipcRenderer.send(IPC.appSetThemeSource, theme),
  },
  window: {
    setFullScreen: (flag: boolean) => ipcRenderer.invoke(IPC.windowSetFullScreen, flag),
    isFullScreen: () => ipcRenderer.invoke(IPC.windowIsFullScreen),
  },
}

contextBridge.exposeInMainWorld('api', api)

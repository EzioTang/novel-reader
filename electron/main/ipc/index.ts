/** IPC handler 注册：通道命名 `域:动作`，入参一律校验。 */

import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import { IPC, type ThemeSource } from '../../../shared/ipc'
import { readBookFile, statFile } from '../services/fileService'
import { assertReadableBookPath } from '../services/pathGuard'

function assertThemeSource(value: unknown): ThemeSource {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.dialogOpenBooks, async () => {
    const win = getWindow()
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: '导入书籍',
          properties: ['openFile', 'multiSelections'],
          filters: [{ name: '文本文件', extensions: ['txt'] }],
        })
      : await dialog.showOpenDialog({
          title: '导入书籍',
          properties: ['openFile', 'multiSelections'],
          filters: [{ name: '文本文件', extensions: ['txt'] }],
        })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle(IPC.fileReadText, async (_event, path: unknown, encoding?: unknown) => {
    const safePath = await assertReadableBookPath(path)
    const chosenEncoding = typeof encoding === 'string' ? encoding : undefined
    return readBookFile(safePath, chosenEncoding)
  })

  ipcMain.handle(IPC.fileStat, async (_event, path: unknown) => {
    const safePath = await assertReadableBookPath(path)
    return statFile(safePath)
  })

  ipcMain.handle(IPC.appGetVersion, () => app.getVersion())

  ipcMain.on(IPC.appSetThemeSource, (_event, theme: unknown) => {
    nativeTheme.themeSource = assertThemeSource(theme)
  })

  ipcMain.handle(IPC.windowSetFullScreen, (event, flag: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    win.setFullScreen(Boolean(flag))
    return win.isFullScreen()
  })

  ipcMain.handle(IPC.windowIsFullScreen, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
  })
}

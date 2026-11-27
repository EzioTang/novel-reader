import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BookshelfPage } from '../modules/bookshelf/BookshelfPage'
import { ReaderPage } from '../modules/reader/ReaderPage'
import { RecognizePage } from '../modules/recognizer/RecognizePage'
import { SettingsPage } from '../modules/settings/SettingsPage'
import { useSettingsStore } from '../stores/settingsStore'
import { nativeThemeSource, resolveTheme } from '../core/theme'

function useSystemPrefersDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent): void => setDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return dark
}

export function App(): JSX.Element {
  const hydrate = useSettingsStore((s) => s.hydrate)
  const theme = useSettingsStore((s) => s.settings.theme)
  const systemDark = useSystemPrefersDark()

  useEffect(() => {
    hydrate()
  }, [hydrate])

  // 主题落到 <html data-theme> 上，CSS 变量负责实际配色
  useEffect(() => {
    const resolved = resolveTheme(theme, systemDark)
    document.documentElement.dataset.theme = resolved
    window.api?.app.setThemeSource(nativeThemeSource(theme))
  }, [theme, systemDark])

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<BookshelfPage />} />
        <Route path="/reader/:bookId" element={<ReaderPage />} />
        <Route path="/recognize/:bookId" element={<RecognizePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

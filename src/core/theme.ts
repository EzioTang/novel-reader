/** 主题解析：把「跟随系统」在运行时解析为具体配色，并映射到原生标题栏色调。 */

import type { ResolvedTheme, ThemeMode } from './types'

export interface ThemeOption {
  value: ThemeMode
  label: string
  hint: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: '浅色', hint: '暖白纸感，白天阅读' },
  { value: 'dark', label: '深色', hint: '低亮度，夜间阅读' },
  { value: 'eye-care', label: '护眼', hint: '豆沙绿底，久看不刺眼' },
  { value: 'system', label: '跟随系统', hint: '随系统深浅色自动切换' },
]

/** system 解析成当前系统偏好；其余原样返回 */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light'
  return mode
}

/** Electron nativeTheme.themeSource 只接受三种值，护眼归到 light */
export function nativeThemeSource(mode: ThemeMode): 'light' | 'dark' | 'system' {
  if (mode === 'eye-care') return 'light'
  return mode
}

/** 供 UI 预览色块 */
export const THEME_SWATCH: Record<ResolvedTheme, { bg: string; fg: string; accent: string }> = {
  light: { bg: '#f7f3ea', fg: '#26302d', accent: '#3f6f5f' },
  dark: { bg: '#1b1f1e', fg: '#e6e2d8', accent: '#7fb39c' },
  'eye-care': { bg: '#e6efe1', fg: '#2b3a2e', accent: '#4a7358' },
}

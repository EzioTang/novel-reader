/** 少量内联图标，避免引入图标库依赖。 */

interface IconProps {
  size?: number
  className?: string
}

export function BookIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function PlusIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function BackIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M15 5l-7 7 7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ListIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 6h16M4 12h16M4 18h10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** 设置：八齿齿轮（外轮廓 + 中心轴孔） */
export function SettingsIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10.0 5.3 L10.2 2.9 L13.8 2.9 L14.0 5.3 L15.3 5.8 L17.2 4.3 L19.7 6.8 L18.2 8.7 L18.7 10.0 L21.1 10.2 L21.1 13.8 L18.7 14.0 L18.2 15.3 L19.7 17.2 L17.2 19.7 L15.3 18.2 L14.0 18.7 L13.8 21.1 L10.2 21.1 L10.0 18.7 L8.7 18.2 L6.8 19.7 L4.3 17.2 L5.8 15.3 L5.3 14.0 L2.9 13.8 L2.9 10.2 L5.3 10.0 L5.8 8.7 L4.3 6.8 L6.8 4.3 L8.7 5.8 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function TrashIcon({ size = 16, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 7h16M9 7V5h6v2M6.5 7l.8 12h9.4l.8-12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

export function FontIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 19L12 5l7 14" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 14h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/** 沉浸阅读：四角向内的框 */
export function ImmersiveIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 全屏：四角向外 */
export function FullscreenIcon({ size = 18, className }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

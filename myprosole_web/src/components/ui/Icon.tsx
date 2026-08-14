interface IconProps {
  name: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

export default function Icon({ name, size = 24, className = '', style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ fill: 'currentColor', ...style }}
    >
      <use href={`#icon-${name}`} />
    </svg>
  )
}

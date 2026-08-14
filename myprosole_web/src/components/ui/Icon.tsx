interface IconProps {
  name: string
  size?: number
  className?: string
}

export default function Icon({ name, size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ fill: 'currentColor' }}
    >
      <use href={`#icon-${name}`} />
    </svg>
  )
}

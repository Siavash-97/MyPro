interface FilterChipProps {
  label: string
  selected: boolean
  onClick: () => void
}

export default function FilterChip({ label, selected, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center h-8 px-3 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
        selected
          ? 'bg-primary text-on-primary'
          : 'bg-surface-container text-on-surface-variant'
      }`}
    >
      {label}
    </button>
  )
}

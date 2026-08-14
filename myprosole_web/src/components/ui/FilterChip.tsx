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
      className={`md-filter-chip${selected ? ' md-filter-chip--active' : ''}`}
    >
      {label}
    </button>
  )
}

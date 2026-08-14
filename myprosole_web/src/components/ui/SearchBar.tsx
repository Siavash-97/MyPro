import Icon from './Icon'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function SearchBar({ value, onChange, placeholder = 'Suchen…' }: SearchBarProps) {
  return (
    <div className="md-search-field">
      <Icon name="search" size={20} className="md-search-field__icon" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="md-search-field__input"
      />
    </div>
  )
}

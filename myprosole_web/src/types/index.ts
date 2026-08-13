export interface Profile {
  id: string
  display_name: string
  running_level: 'anfaenger' | 'fortgeschritten' | 'erfahren'
  weekly_goal_km: number | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

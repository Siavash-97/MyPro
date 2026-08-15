import { create } from 'zustand'
import { supabase } from '../lib/supabase'

const BEHAELTER = 'community'

export interface FeedComment {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
  profiles: { display_name: string | null } | null
}

export interface FeedPost {
  id: string
  user_id: string
  body: string | null
  image_path: string | null
  created_at: string
  profiles: { display_name: string | null } | null
  community_post_likes: { user_id: string }[]
  community_post_awards: { user_id: string }[]
  community_post_comments: FeedComment[]
}

interface FeedState {
  posts: FeedPost[]
  loading: boolean
  fetchPosts: () => Promise<void>
  createPost: (text: string, bild: File | null) => Promise<string | null>
  deletePost: (post: FeedPost) => Promise<string | null>
  /** Like oder Goldmedaille umschalten. */
  toggleReaktion: (postId: string, art: 'like' | 'award') => Promise<string | null>
  addComment: (postId: string, text: string) => Promise<string | null>
  deleteComment: (id: string) => Promise<string | null>
}

const TABELLE = { like: 'community_post_likes', award: 'community_post_awards' } as const

/** Oeffentliche Adresse eines Bildes im Behaelter. */
export function bildAdresse(pfad: string): string {
  return supabase.storage.from(BEHAELTER).getPublicUrl(pfad).data.publicUrl
}

export const useFeed = create<FeedState>((set, get) => ({
  posts: [],
  loading: false,

  fetchPosts: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('community_posts')
      .select(`
        *,
        profiles(display_name),
        community_post_likes(user_id),
        community_post_awards(user_id),
        community_post_comments(*, profiles(display_name))
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    set({ posts: (data ?? []) as FeedPost[], loading: false })
  },

  createPost: async (text, bild) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    let pfad: string | null = null
    if (bild) {
      // Der eigene Ordner ist Pflicht – die Storage-Regel prueft den ersten
      // Pfadteil gegen die eigene Kennung.
      const endung = bild.name.split('.').pop()?.toLowerCase() || 'jpg'
      pfad = `${user.id}/${crypto.randomUUID()}.${endung}`
      const { error } = await supabase.storage.from(BEHAELTER).upload(pfad, bild, {
        contentType: bild.type || 'image/jpeg',
      })
      if (error) return 'Bild konnte nicht hochgeladen werden: ' + error.message
    }

    const { error } = await supabase.from('community_posts').insert({
      user_id: user.id,
      body: text.trim() || null,
      image_path: pfad,
    })

    if (error) {
      // Beitrag gescheitert: Das schon hochgeladene Bild waere sonst eine
      // Datei ohne Besitzer.
      if (pfad) await supabase.storage.from(BEHAELTER).remove([pfad])
      return error.message
    }

    await get().fetchPosts()
    return null
  },

  deletePost: async (post) => {
    const { error } = await supabase.from('community_posts').delete().eq('id', post.id)
    if (error) return error.message
    // Erst die Zeile, dann die Datei: Scheitert das Loeschen der Datei, ist
    // der Beitrag trotzdem weg – umgekehrt bliebe ein Beitrag ohne Bild.
    if (post.image_path) await supabase.storage.from(BEHAELTER).remove([post.image_path])
    set((s) => ({ posts: s.posts.filter((p) => p.id !== post.id) }))
    return null
  },

  toggleReaktion: async (postId, art) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    const tabelle = TABELLE[art]
    const feld = art === 'like' ? 'community_post_likes' : 'community_post_awards'
    const post = get().posts.find((p) => p.id === postId)
    const gesetzt = post?.[feld].some((r) => r.user_id === user.id) ?? false

    // Sofort umschalten, damit der Knopf nicht traege wirkt; bei einem Fehler
    // wird der Stand neu geladen.
    set((s) => ({
      posts: s.posts.map((p) =>
        p.id !== postId ? p : {
          ...p,
          [feld]: gesetzt
            ? p[feld].filter((r) => r.user_id !== user.id)
            : [...p[feld], { user_id: user.id }],
        },
      ),
    }))

    const { error } = gesetzt
      ? await supabase.from(tabelle).delete().eq('post_id', postId).eq('user_id', user.id)
      : await supabase.from(tabelle).insert({ post_id: postId, user_id: user.id })

    if (error) {
      await get().fetchPosts()
      return error.message
    }
    return null
  },

  addComment: async (postId, text) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    const { error } = await supabase
      .from('community_post_comments')
      .insert({ post_id: postId, user_id: user.id, body: text.trim() })

    if (error) return error.message
    await get().fetchPosts()
    return null
  },

  deleteComment: async (id) => {
    const { error } = await supabase.from('community_post_comments').delete().eq('id', id)
    if (error) return error.message
    await get().fetchPosts()
    return null
  },
}))

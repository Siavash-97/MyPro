import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { eigeneKennung } from '../lib/eigeneKennung'

const BEHAELTER = 'community'

export interface FeedComment {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
  /** Null bei einem Hauptkommentar, sonst dessen Kennung. Eine Ebene tief. */
  parent_id: string | null
  profiles: { display_name: string | null } | null
  community_comment_likes: { user_id: string }[]
}

export interface FeedBild {
  id: string
  post_id: string
  path: string
  position: number
}

export interface FeedPost {
  id: string
  user_id: string
  body: string | null
  /** Nicht mehr benutzt; die Bilder stehen in community_post_images. */
  image_path: string | null
  created_at: string
  profiles: { display_name: string | null } | null
  community_post_likes: { user_id: string }[]
  community_post_awards: { user_id: string }[]
  community_post_comments: FeedComment[]
  community_post_images: FeedBild[]
}

/**
 * Die Verweise auf profiles muessen den Fremdschluessel ausdruecklich nennen.
 *
 * Ohne das antwortet PostgREST mit PGRST201: Von community_posts fuehren
 * inzwischen mehrere Wege zu profiles – direkt ueber user_id, aber auch ueber
 * Likes, Medaillen und Kommentare. Welcher gemeint ist, kann die Datenbank
 * nicht raten, also verweigert sie die Auskunft. Mit dem Namen des
 * Fremdschluessels ist es eindeutig.
 */
const AUSWAHL = `
  *,
  profiles!community_posts_user_id_fkey(display_name),
  community_post_likes(user_id),
  community_post_awards(user_id),
  community_post_comments(
    *,
    profiles!community_post_comments_user_id_fkey(display_name),
    community_comment_likes(user_id)
  ),
  community_post_images(id, post_id, path, position)
`

interface FeedState {
  posts: FeedPost[]
  loading: boolean
  /** Meldung der Datenbank, falls das Laden scheitert. */
  fehler: string | null
  fetchPosts: () => Promise<void>
  createPost: (text: string, bilder: File[]) => Promise<string | null>
  /** Text aendern und weitere Bilder anhaengen. */
  updatePost: (postId: string, text: string, neueBilder: File[]) => Promise<string | null>
  /** Einzelnes Bild aus einem Beitrag entfernen. */
  removeBild: (bild: FeedBild) => Promise<string | null>
  deletePost: (post: FeedPost) => Promise<string | null>
  /** Like oder Goldmedaille umschalten. */
  toggleReaktion: (postId: string, art: 'like' | 'award') => Promise<string | null>
  /** parentId gesetzt = Antwort auf einen Hauptkommentar. */
  addComment: (postId: string, text: string, parentId?: string | null) => Promise<string | null>
  toggleCommentLike: (commentId: string) => Promise<string | null>
  deleteComment: (id: string) => Promise<string | null>
}

const TABELLE = { like: 'community_post_likes', award: 'community_post_awards' } as const

/**
 * Dateiendung fuer den Speicherpfad. Bevorzugt die Angabe des Browsers zum
 * Dateityp, weil die verlaesslicher ist als der Dateiname – Kameraaufnahmen
 * heissen auf manchen Geraeten gar nichts Brauchbares.
 */
function endungVon(datei: File): string {
  const ausTyp = datei.type.split('/')[1]?.toLowerCase()
  if (ausTyp && /^[a-z0-9]{2,5}$/.test(ausTyp)) return ausTyp === 'jpeg' ? 'jpg' : ausTyp

  const ausName = datei.name.includes('.') ? datei.name.split('.').pop()?.toLowerCase() : null
  if (ausName && /^[a-z0-9]{2,5}$/.test(ausName)) return ausName

  return 'jpg'
}

/**
 * Laedt mehrere Bilder hoch und traegt sie beim Beitrag ein.
 *
 * Der eigene Ordner ist Pflicht – die Regel im Behaelter prueft den ersten
 * Pfadteil gegen die eigene Kennung. Scheitert eines, wird es wieder
 * entfernt und der Grund zurueckgegeben; die vorher erfolgreichen bleiben
 * stehen. Alles zurueckzudrehen waere hier schlechter: Wer fuenf Bilder
 * anhaengt und beim vierten scheitert, will die ersten drei behalten.
 */
async function bilderAnhaengen(
  userId: string,
  postId: string,
  dateien: File[],
  abPosition: number,
  belegt: Set<number> = new Set(),
): Promise<string | null> {
  let position = abPosition
  for (const datei of dateien) {
    while (belegt.has(position)) position += 1
    if (position > 9) return 'Mehr als zehn Bilder gehen nicht.'

    const pfad = userId + '/' + crypto.randomUUID() + '.' + endungVon(datei)
    const { error: hochladen } = await supabase.storage.from(BEHAELTER).upload(pfad, datei, {
      contentType: datei.type || 'image/jpeg',
    })
    if (hochladen) return 'Bild konnte nicht hochgeladen werden: ' + hochladen.message

    const { error } = await supabase.from('community_post_images').insert({
      post_id: postId, user_id: userId, path: pfad, position,
    })
    if (error) {
      await supabase.storage.from(BEHAELTER).remove([pfad])
      return error.message
    }
    belegt.add(position)
    position += 1
  }
  return null
}

/** Oeffentliche Adresse eines Bildes im Behaelter. */
export function bildAdresse(pfad: string): string {
  return supabase.storage.from(BEHAELTER).getPublicUrl(pfad).data.publicUrl
}

export const useFeed = create<FeedState>((set, get) => ({
  posts: [],
  loading: false,
  fehler: null,

  fetchPosts: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('community_posts')
      .select(AUSWAHL)
      .order('created_at', { ascending: false })
      .limit(50)

    // Fehler nicht verschlucken. Genau das hat einen Tag lang einen leeren
    // Feed vorgetaeuscht: Die Abfrage schlug fehl, data war null, und die
    // Seite zeigte seelenruhig "Noch keine Beitraege".
    if (error) {
      set({ loading: false, fehler: error.message })
      return
    }

    set({ posts: (data ?? []) as FeedPost[], loading: false, fehler: null })
  },

  createPost: async (text, bilder) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    if (!text.trim() && bilder.length === 0) return 'Schreib etwas oder wähl ein Bild.'

    const { data: post, error } = await supabase
      .from('community_posts')
      .insert({ user_id: userId, body: text.trim() || null })
      .select()
      .single()

    if (error) return error.message

    // Erst der Beitrag, dann die Bilder: Andersherum haetten die Bilder
    // keinen Beitrag, an dem sie haengen koennten.
    const bildFehler = await bilderAnhaengen(userId, post.id, bilder, 0)
    await get().fetchPosts()
    // Der Beitrag steht schon. Ihn stehen zu lassen ist besser, als ihn
    // wieder wegzunehmen – der Text ist da, es fehlt nur ein Bild.
    return bildFehler
  },

  updatePost: async (postId, text, neueBilder) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const post = get().posts.find((p) => p.id === postId)
    const vorhandene = post?.community_post_images.length ?? 0
    if (!text.trim() && vorhandene + neueBilder.length === 0) {
      return 'Schreib etwas oder lass mindestens ein Bild stehen.'
    }

    const { error } = await supabase
      .from('community_posts')
      .update({ body: text.trim() || null })
      .eq('id', postId)
    if (error) return error.message

    if (neueBilder.length) {
      // Hinter die vorhandenen haengen. Die freie Stelle wird aus den
      // belegten Plaetzen bestimmt, nicht aus der Anzahl – nach dem
      // Loeschen eines mittleren Bildes waere die Anzahl schon vergeben.
      const belegt = new Set((post?.community_post_images ?? []).map((b) => b.position))
      const fehler = await bilderAnhaengen(userId, postId, neueBilder, 0, belegt)
      if (fehler) {
        await get().fetchPosts()
        return fehler
      }
    }

    await get().fetchPosts()
    return null
  },

  removeBild: async (bild) => {
    const { error } = await supabase.from('community_post_images').delete().eq('id', bild.id)
    if (error) return error.message
    // Erst die Zeile, dann die Datei. Scheitert das Aufraeumen, liegt nur
    // eine Datei herum, die niemand mehr sieht.
    await supabase.storage.from(BEHAELTER).remove([bild.path])
    await get().fetchPosts()
    return null
  },

  deletePost: async (post) => {
    const { error } = await supabase.from('community_posts').delete().eq('id', post.id)
    if (error) return error.message
    // Erst die Zeile, dann die Dateien: Scheitert das Loeschen einer Datei,
    // ist der Beitrag trotzdem weg – umgekehrt bliebe ein Beitrag ohne Bild.
    // Die Zeilen in community_post_images gehen ueber den Fremdschluessel
    // mit; die Dateien im Behaelter muessen von Hand weg.
    const pfade = post.community_post_images.map((b) => b.path)
    if (post.image_path) pfade.push(post.image_path)
    if (pfade.length) await supabase.storage.from(BEHAELTER).remove(pfade)
    set((s) => ({ posts: s.posts.filter((p) => p.id !== post.id) }))
    return null
  },

  toggleReaktion: async (postId, art) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const tabelle = TABELLE[art]
    const feld = art === 'like' ? 'community_post_likes' : 'community_post_awards'
    const post = get().posts.find((p) => p.id === postId)
    const gesetzt = post?.[feld].some((r) => r.user_id === userId) ?? false

    // Sofort umschalten, damit der Knopf nicht traege wirkt; bei einem Fehler
    // wird der Stand neu geladen.
    set((s) => ({
      posts: s.posts.map((p) =>
        p.id !== postId ? p : {
          ...p,
          [feld]: gesetzt
            ? p[feld].filter((r) => r.user_id !== userId)
            : [...p[feld], { user_id: userId }],
        },
      ),
    }))

    const { error } = gesetzt
      ? await supabase.from(tabelle).delete().eq('post_id', postId).eq('user_id', userId)
      : await supabase.from(tabelle).insert({ post_id: postId, user_id: userId })

    if (error) {
      await get().fetchPosts()
      return error.message
    }
    return null
  },

  addComment: async (postId, text, parentId = null) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    // Antwort auf eine Antwort haengt am selben Hauptkommentar. Sonst
    // entstuenden Baeume, die auf einem Telefon nicht mehr lesbar sind.
    let wurzel = parentId
    if (parentId) {
      const post = get().posts.find((p) => p.id === postId)
      const eltern = post?.community_post_comments.find((c) => c.id === parentId)
      wurzel = eltern?.parent_id ?? parentId
    }

    const { error } = await supabase
      .from('community_post_comments')
      .insert({ post_id: postId, user_id: userId, body: text.trim(), parent_id: wurzel })

    if (error) return error.message
    await get().fetchPosts()
    return null
  },

  toggleCommentLike: async (commentId) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const kommentar = get().posts
      .flatMap((p) => p.community_post_comments)
      .find((c) => c.id === commentId)
    const gesetzt = kommentar?.community_comment_likes.some((l) => l.user_id === userId) ?? false

    // Sofort umschalten, damit das Herz nicht traege wirkt.
    set((s) => ({
      posts: s.posts.map((p) => ({
        ...p,
        community_post_comments: p.community_post_comments.map((c) =>
          c.id !== commentId ? c : {
            ...c,
            community_comment_likes: gesetzt
              ? c.community_comment_likes.filter((l) => l.user_id !== userId)
              : [...c.community_comment_likes, { user_id: userId }],
          },
        ),
      })),
    }))

    const { error } = gesetzt
      ? await supabase.from('community_comment_likes').delete()
          .eq('comment_id', commentId).eq('user_id', userId)
      : await supabase.from('community_comment_likes')
          .insert({ comment_id: commentId, user_id: userId })

    if (error) {
      await get().fetchPosts()
      return error.message
    }
    return null
  },

  deleteComment: async (id) => {
    const { error } = await supabase.from('community_post_comments').delete().eq('id', id)
    if (error) return error.message
    await get().fetchPosts()
    return null
  },
}))

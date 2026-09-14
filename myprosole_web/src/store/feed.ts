import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { dateiMitZeile, verwaistMerken } from '../lib/dateiAblegen'
import { eigeneKennung } from '../lib/eigeneKennung'
import { entwicklerWarnung } from '../lib/entwicklerkonsole'
import { speicherAnmelden } from '../lib/kontoZustand'

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
  /**
   * Die signierte Adresse, mit der die Anzeige das Bild holt - `null`, wenn
   * der Speicher sie verweigert hat.
   *
   * Sie steht NICHT in der Tabelle. `community_post_images` fuehrt nur
   * `path`; die Adresse entsteht beim Laden (`fetchPosts`) und laeuft nach
   * einer Stunde ab (`ADRESSE_GUELTIG_S`). `null` heisst "keine Adresse" -
   * die Anzeige zeigt dann ein gebrochenes Bild und darf einmal
   * nachsignieren lassen (`bildNachsignieren`).
   */
  url: string | null
}

export interface FeedPost {
  id: string
  user_id: string
  body: string | null
  /** Nicht mehr benutzt; die Bilder stehen in community_post_images. */
  image_path: string | null
  /** Null = oeffentlicher Feed. Gesetzt = gehoert in diese Gruppe. */
  group_id: string | null
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
  /** Kennungen der Beitraege, die diese Person weggetan hat. */
  verborgen: Set<string>
  verborgeneLaden: () => Promise<void>
  /** @returns null bei Erfolg, sonst ein Satz fuer einen Menschen. */
  beitragVerbergen: (postId: string) => Promise<string | null>
  posts: FeedPost[]
  loading: boolean
  /** Meldung der Datenbank, falls das Laden scheitert. */
  fehler: string | null
  /** Ohne Gruppe der oeffentliche Feed, mit Gruppe deren Beitraege. */
  fetchPosts: (gruppeId?: string | null) => Promise<void>
  createPost: (text: string, bilder: File[], gruppeId?: string | null) => Promise<string | null>
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

    // Die Schleife bleibt hier: Sie handelt von der Positionsvergabe, und
    // die haengt an der Eindeutigkeitsregel in community_post_images - davon
    // soll das Modul nichts wissen.
    const { fehler } = await dateiMitZeile({
      behaelter: BEHAELTER,
      praefix: userId,
      datei,
      rueckfallEndung: 'jpg',
      rueckfallTyp: 'image/jpeg',
      zeileSchreiben: async (pfad) => {
        const { error } = await supabase.from('community_post_images').insert({
          post_id: postId, user_id: userId, path: pfad, position,
        })
        return { data: null, error }
      },
    })
    // Der Vorsatz steht jetzt hier statt im Modul: Das Modul weiss nicht, ob
    // sein Fehler in einer Schnellmeldung oder einem Protokoll landet.
    // Die EXISTENZ entscheidet, nicht der Inhalt: `fehler` ist Text, und der
    // LEERE Text ist ein Fehlschlag mit leerer Meldung, kein Erfolg (B1/R1,
    // `lib/dateiAblegen.ts`, Zusicherung im Kopf von `Ergebnis.roh`).
    if (fehler !== null) return 'Bild konnte nicht angehängt werden: ' + fehler
    belegt.add(position)
    position += 1
  }
  return null
}

/**
 * Wie lange eine signierte Bildadresse gilt: eine Stunde.
 *
 * Warum eine Stunde und nicht ein Tag
 * -----------------------------------
 * Eine signierte Adresse wird beim SIGNIEREN geprueft, nicht beim Oeffnen
 * (Recherche vom 12.09.2026, Fragen 1 und 4): Der Token traegt keine Bindung
 * an eine Sitzung und gilt bis zum Ablauf auch fuer jemanden, der sich
 * abgemeldet hat oder aus der Gruppe entfernt wurde. Genau dieses Fenster
 * soll Befund B kleiner machen - 24 Stunden waeren ein Tag Nachlauf fuer
 * jeden, der eine Adresse weitergibt.
 *
 * Eine Stunde ist zugleich das, was im Haus schon steht: `store/chats.ts`
 * signiert Sprachnachrichten mit derselben Frist (Weg A des Pakets vom
 * 12.09.2026, vom Nutzer gewaehlt).
 *
 * Der Preis dafuer ist das Nachsignieren: Ein Feed, der laenger offen liegt,
 * fordert Bilder mit abgelaufener Adresse an. Das faengt `bildNachsignieren`
 * ab, einmal je Bild.
 */
const ADRESSE_GUELTIG_S = 3600

/**
 * Signierte Adressen fuer eine ganze Liste von Pfaden - ein Aufruf, nicht einer je Bild.
 *
 * Was sie verbirgt
 * ----------------
 * Dass es ein Stapelaufruf ist (`createSignedUrls`, Plural), wie lange die
 * Adressen gelten, und dass ein einzelner Pfad scheitern kann, ohne dass der
 * Aufruf scheitert: Die Antwort traegt ein `error` JE ZEILE und eines fuer
 * den ganzen Aufruf (`@supabase/storage-js` 2.112.3,
 * `dist/index.d.mts:1276-1290`). Beide Wege enden hier als `null` fuer den
 * betroffenen Pfad - kein Wurf, denn ein Bild, das man nicht sehen darf, ist
 * kein Grund, einen Feed nicht zu zeigen.
 *
 * Was sie NICHT verbirgt: wer die Pfade sammelt und wohin die Adressen
 * gehoeren. Das bleibt bei den Aufrufern, weil nur sie ihre Liste kennen.
 *
 * Die Obergrenze des Dienstes liegt bei 1000 Pfaden je Aufruf
 * (`MAX_OBJECTS_PER_REQUEST`, Recherche Frage 5). Der Feed laedt hoechstens
 * 50 Beitraege mit je zehn Bildern, das Profil hoechstens fuenf Fotos - beide
 * bleiben darunter, ohne dass hier geteilt werden muesste.
 *
 * Ein Pfad wird HOECHSTENS EINMAL geschickt, auch wenn er mehrfach in der
 * Liste steht (zwei Beitraege mit demselben Bild): Der Rueckgabewert ist eine
 * Zuordnung, die zweite Antwort auf denselben Pfad ueberschriebe die erste
 * mit demselben Wert. Der Aufrufer bekommt seine Doppelung trotzdem beantwortet
 * - er fragt die Zuordnung, nicht die Antwortliste.
 *
 * @returns Pfad -> Adresse, `null` je Pfad, den der Speicher nicht ausgibt.
 *          Bei leerer Liste eine leere Zuordnung, ohne den Dienst zu fragen.
 */
export async function bildAdressen(pfade: string[]): Promise<Map<string, string | null>> {
  const adressen = new Map<string, string | null>()
  // Ohne Pfade gibt es nichts zu fragen. Der Dienst antwortete darauf mit
  // einer leeren Menge - ein Rundgang ueber das Netz fuer nichts.
  if (pfade.length === 0) return adressen

  const eindeutig = [...new Set(pfade)]

  const { data, error } = await supabase.storage
    .from(BEHAELTER)
    .createSignedUrls(eindeutig, ADRESSE_GUELTIG_S)

  // Scheitert der ganze Aufruf, hat KEIN Pfad eine Adresse. Das ausdruecklich
  // einzutragen ist besser als eine leere Zuordnung: Der Aufrufer
  // unterscheidet sonst nicht zwischen "gefragt und verweigert" und "nie
  // gefragt".
  if (error || !data) {
    // Und es steht einmal in der Konsole der Entwicklungsfassung, warum.
    // Ohne diesen Ton endet ein abgelaufenes Token, eine fehlende Rolle oder
    // ein Behaelter, den es nicht gibt, in einem Feed ganz ohne Bilder - und
    // niemand sieht den Unterschied zu "es gibt keine Bilder". In der
    // ausgelieferten Fassung schweigt `entwicklerWarnung` (Standard vom
    // 05.09.2026: kein fremder Rohtext in der Browserkonsole).
    entwicklerWarnung(
      `Bildadressen nicht signiert (${eindeutig.length} Pfade): ` +
        (error?.message ?? 'Antwort ohne Daten und ohne Fehler'),
    )
    for (const pfad of eindeutig) adressen.set(pfad, null)
    return adressen
  }

  for (const zeile of data) {
    if (zeile.path === null) continue
    adressen.set(zeile.path, zeile.error ? null : zeile.signedUrl)
  }
  // Pfade, die in der Antwort gar nicht vorkamen, sind auch beantwortet: mit
  // "keine Adresse". Sonst faende der Aufrufer `undefined` und muesste selbst
  // entscheiden, was das heisst.
  for (const pfad of eindeutig) if (!adressen.has(pfad)) adressen.set(pfad, null)

  return adressen
}

/**
 * Ein einzelnes Bild neu signieren und die Adresse im Speicher ersetzen.
 *
 * Fuer den Fall, dass ein Feed laenger als eine Stunde offen liegt und der
 * Browser ein Bild neu anfordert: Die Galerie meldet den Fehlschlag EINMAL
 * (`onError`), und hier entsteht eine frische Adresse.
 *
 * Scheitert auch das, bleibt die alte Adresse stehen, statt `null` zu werden:
 * Das Bild ist bereits gebrochen: aus einer abgelaufenen Adresse ein leeres
 * `src` zu machen, aendert nichts zum Besseren und macht aus einem
 * voruebergehenden Fehler einen dauerhaften Zustand im Speicher.
 */
export async function bildNachsignieren(pfad: string): Promise<void> {
  const adresse = (await bildAdressen([pfad])).get(pfad) ?? null
  if (adresse === null) return

  useFeed.setState((s) => ({
    posts: s.posts.map((p) => ({
      ...p,
      community_post_images: p.community_post_images.map((b) =>
        b.path === pfad ? { ...b, url: adresse } : b,
      ),
    })),
  }))
}

export const useFeed = create<FeedState>((set, get) => ({
  posts: [],
  loading: false,
  fehler: null,
  verborgen: new Set<string>(),

  fetchPosts: async (gruppeId = null) => {
    set({ loading: true })
    // Erst holen, was verborgen ist. Sonst blitzen verborgene Beitraege
    // beim Laden kurz auf - und ein Verbergen, das man noch sieht, ist
    // keines.
    await get().verborgeneLaden()
    // Ohne Gruppe ausdruecklich nur die ohne Zugehoerigkeit: Sonst
    // erschienen Gruppenbeitraege im oeffentlichen Feed, sobald man
    // Mitglied ist – und was in einer Gruppe geschrieben wurde, gehoert
    // dorthin, nicht in den allgemeinen Verlauf.
    let abfrage = supabase.from('community_posts').select(AUSWAHL)
    abfrage = gruppeId ? abfrage.eq('group_id', gruppeId) : abfrage.is('group_id', null)

    const { data, error } = await abfrage
      .order('created_at', { ascending: false })
      .limit(50)

    // Fehler nicht verschlucken. Genau das hat einen Tag lang einen leeren
    // Feed vorgetaeuscht: Die Abfrage schlug fehl, data war null, und die
    // Seite zeigte seelenruhig "Noch keine Beitraege".
    if (error) {
      set({ loading: false, fehler: error.message })
      return
    }

    // Verborgenes faellt hier heraus und nicht in der Anzeige: Sonst
    // muesste jede Stelle, die Beitraege zeigt, daran denken.
    //
    // Warum die App filtern darf und nicht die Datenbank: Verbergen ist
    // eine Vorliebe, kein Schutz. Niemand kommt zu Schaden, wenn ein
    // verborgener Beitrag doch durchkaeme - es ist die eigene Ansicht, die
    // man sich aufraeumt. Beim Blockieren wird das anders sein.
    const verborgen = get().verborgen
    const sichtbar = ((data ?? []) as FeedPost[]).filter((p) => !verborgen.has(p.id))

    // Die Adressen fuer ALLE Bilder der Liste in EINEM Aufruf - erst nach dem
    // Filtern, damit fuer weggetane Beitraege nichts signiert wird.
    //
    // Hier und nicht in der Anzeige: Signieren ist ein Netzaufruf, und eine
    // Anzeige, die je Bild einen macht, feuert bei jedem Rendern erneut. Die
    // Tabelle fuehrt ohnehin nur Pfade (`0026:19`); die Adresse gehoert zum
    // geladenen Stand.
    const pfade = sichtbar.flatMap((p) => p.community_post_images.map((b) => b.path))
    const adressen = await bildAdressen(pfade)
    const mitAdressen = sichtbar.map((p) => ({
      ...p,
      community_post_images: p.community_post_images.map((b) => ({
        ...b,
        url: adressen.get(b.path) ?? null,
      })),
    }))

    set({ posts: mitAdressen, loading: false, fehler: null })
  },

  verborgeneLaden: async () => {
    const userId = eigeneKennung()
    if (!userId) return
    const { data } = await supabase
      .from('verborgene_beitraege')
      .select('post_id')
      .eq('user_id', userId)
    set({ verborgen: new Set((data ?? []).map((z) => z.post_id as string)) })
  },

  beitragVerbergen: async (postId) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    // Zuerst aus der Liste nehmen, dann speichern. Der Beitrag ist damit
    // sofort weg; scheitert das Speichern, kommt er beim naechsten Laden
    // zurueck - besser als ein Knopf, der eine Sekunde lang nichts tut.
    const verborgen = new Set(get().verborgen)
    verborgen.add(postId)
    set({ verborgen, posts: get().posts.filter((p) => p.id !== postId) })

    const { error } = await supabase
      .from('verborgene_beitraege')
      .insert({ user_id: userId, post_id: postId })

    // Doppelt verbergen ist kein Fehler, sondern derselbe Wunsch zweimal.
    if (error && error.code !== '23505') {
      return 'Der Beitrag ist ausgeblendet, konnte aber nicht dauerhaft gemerkt werden.'
    }
    return null
  },

  createPost: async (text, bilder, gruppeId = null) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    if (!text.trim() && bilder.length === 0) return 'Schreib etwas oder wähl ein Bild.'

    const { data: post, error } = await supabase
      .from('community_posts')
      .insert({ user_id: userId, body: text.trim() || null, group_id: gruppeId })
      .select()
      .single()

    if (error) return error.message

    // Erst der Beitrag, dann die Bilder: Andersherum haetten die Bilder
    // keinen Beitrag, an dem sie haengen koennten.
    const bildFehler = await bilderAnhaengen(userId, post.id, bilder, 0)
    await get().fetchPosts(gruppeId)
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
    // eine Datei herum, die niemand mehr sieht – aber nicht schweigend.
    const { error: aufraeumen } = await supabase.storage.from(BEHAELTER).remove([bild.path])
    if (aufraeumen) verwaistMerken(BEHAELTER, bild.path, aufraeumen.message)
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

// Beim Abmelden zuruecksetzen. Ohne das saehe der naechste Angemeldete auf
// demselben Geraet die Daten des vorigen, bis die erste Abfrage sie
// ueberschreibt. Siehe lib/kontoZustand.ts.
speicherAnmelden(useFeed)

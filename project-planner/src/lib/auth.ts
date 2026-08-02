import { supabase } from './supabase';

/** Supabase Auth needs an email; accounts are created by an admin in the
 * Supabase dashboard with a plain username (e.g. "siavash"), and we map
 * that onto a fixed internal domain under the hood so nobody needs a
 * real mailbox. Self-service sign-up is intentionally not exposed here --
 * "Allow new users to sign up" should be off in Supabase so this fixed
 * set of accounts is the only way in. */
const EMAIL_DOMAIN = 'myprosole.de';

function usernameToEmail(username: string): string {
  const trimmed = username.trim().toLowerCase();
  return trimmed.includes('@') ? trimmed : `${trimmed}@${EMAIL_DOMAIN}`;
}

/** Cached display name of the signed-in user, kept up to date by
 * onAuthChange so synchronous callers (e.g. logActivity) can read it
 * without awaiting a network call on every keystroke. */
let currentDisplayName: string | null = null;

function displayNameFromUser(user: { user_metadata?: { full_name?: string }; email?: string | null }): string {
  const fullName = user.user_metadata?.full_name;
  if (fullName && fullName.trim()) return fullName.trim();
  return user.email?.split('@')[0] ?? 'Unbekannt';
}

export function getCurrentDisplayName(): string | null {
  return currentDisplayName;
}

export async function signIn(username: string, password: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Cloud-Login ist nicht konfiguriert.' };
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

export async function hasSession(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) currentDisplayName = displayNameFromUser(data.session.user);
  return !!data.session;
}

export function onAuthChange(callback: (hasSession: boolean) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    currentDisplayName = session?.user ? displayNameFromUser(session.user) : null;
    callback(!!session);
  });
  return () => data.subscription.unsubscribe();
}

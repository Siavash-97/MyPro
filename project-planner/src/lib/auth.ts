import { supabase } from './supabase';

/** Supabase Auth needs an email; the shared team login just uses a
 * plain username, so we map it onto the account's domain under the hood.
 * The shared account is info@myprosole.de, so username "info" logs in. */
const EMAIL_DOMAIN = 'myprosole.de';

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
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
  return !!data.session;
}

export function onAuthChange(callback: (hasSession: boolean) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(!!session);
  });
  return () => data.subscription.unsubscribe();
}

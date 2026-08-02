import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Cloud sync is entirely optional: without these two env vars the app runs
 * purely on localStorage, exactly as before. */
export const cloudEnabled = Boolean(url && anonKey);

// sessionStorage instead of the default localStorage: the login survives
// page reloads and new tabs of the same browser session, but is gone once
// the browser (or the last tab of it) is closed, so the next visit needs a
// fresh login instead of staying signed in indefinitely.
export const supabase = cloudEnabled
  ? createClient(url!, anonKey!, { auth: { storage: window.sessionStorage } })
  : null;

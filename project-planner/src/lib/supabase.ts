import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Cloud sync is entirely optional: without these two env vars the app runs
 * purely on localStorage, exactly as before. */
export const cloudEnabled = Boolean(url && anonKey);

export const supabase = cloudEnabled ? createClient(url!, anonKey!) : null;

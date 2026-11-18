import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si no hay configuración, la app funciona sola en el móvil (como el paso 2).
export const nubeActiva = Boolean(url && clave);
export const supabase: SupabaseClient | null = nubeActiva ? createClient(url!, clave!) : null;

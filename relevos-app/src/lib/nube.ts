import { supabase } from './supabase';
import type { Estado } from '../estado';
import type { Plan } from './engine';

function cliente() {
  if (!supabase) throw new Error('La nube no está configurada');
  return supabase;
}

export interface Cuadrilla { id: string; nombre: string; codigo: string }
export interface PlanPublicado { numero: number; publicada_en: string; estado: Estado; plan: Plan }
export interface VersionResumen { numero: number; publicada_en: string }

export async function entrar(email: string, clave: string): Promise<void> {
  const { error } = await cliente().auth.signInWithPassword({ email, password: clave });
  if (error) throw error;
}

export async function registrar(email: string, clave: string): Promise<void> {
  const { error } = await cliente().auth.signUp({ email, password: clave });
  if (error) throw error;
}

export async function salir(): Promise<void> {
  await cliente().auth.signOut();
}

export async function usuarioId(): Promise<string | null> {
  const { data } = await cliente().auth.getUser();
  return data.user?.id ?? null;
}

export async function miCuadrilla(): Promise<Cuadrilla | null> {
  const { data, error } = await cliente()
    .from('cuadrillas').select('id,nombre,codigo').order('creada', { ascending: true }).limit(1);
  if (error) throw error;
  return (data?.[0] as Cuadrilla) ?? null;
}

export async function crearCuadrilla(nombre: string): Promise<Cuadrilla> {
  const uid = await usuarioId();
  if (!uid) throw new Error('Sin sesión');
  const { data, error } = await cliente()
    .from('cuadrillas').insert({ nombre, capataz: uid }).select('id,nombre,codigo').single();
  if (error) throw error;
  return data as Cuadrilla;
}

export async function cargarBorrador(cuadrillaId: string): Promise<Estado | null> {
  const { data, error } = await cliente()
    .from('borradores').select('estado').eq('cuadrilla_id', cuadrillaId).maybeSingle();
  if (error) throw error;
  return (data?.estado as Estado) ?? null;
}

export async function guardarBorrador(cuadrillaId: string, estado: Estado): Promise<void> {
  const { error } = await cliente().from('borradores').upsert({
    cuadrilla_id: cuadrillaId,
    estado,
    actualizado: new Date().toISOString(),
  });
  if (error) throw error;
}

// Publica una versión nueva. El número lo asigna la base de datos: si dos
// publicaciones chocan, se reintenta con el siguiente número.
export async function publicar(cuadrillaId: string, estado: Estado, plan: Plan): Promise<number> {
  for (let intento = 0; intento < 3; intento++) {
    const { data: ultima, error: errorLectura } = await cliente()
      .from('versiones').select('numero').eq('cuadrilla_id', cuadrillaId)
      .order('numero', { ascending: false }).limit(1);
    if (errorLectura) throw errorLectura;
    const numero = (ultima?.[0]?.numero ?? 0) + 1;
    const { error } = await cliente().from('versiones').insert({ cuadrilla_id: cuadrillaId, numero, estado, plan });
    if (!error) return numero;
    if (error.code !== '23505') throw error;
  }
  throw new Error('No se pudo publicar. Inténtalo de nuevo.');
}

export async function listarVersiones(cuadrillaId: string): Promise<VersionResumen[]> {
  const { data, error } = await cliente()
    .from('versiones').select('numero,publicada_en').eq('cuadrilla_id', cuadrillaId)
    .order('numero', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as VersionResumen[];
}

// Lo que ve un costalero con el enlace (no requiere sesión).
export async function planPublicado(codigo: string): Promise<PlanPublicado | null> {
  const { data, error } = await cliente().rpc('plan_publicado', { p_codigo: codigo });
  if (error) throw error;
  return (data as PlanPublicado | null) ?? null;
}

export async function regenerarCodigo(): Promise<string> {
  const { data, error } = await cliente().rpc('regenerar_codigo');
  if (error) throw error;
  return data as string;
}

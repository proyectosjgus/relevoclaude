-- Ejecutar una vez en Supabase: SQL Editor > New query > Run.
-- Crea las tablas y las reglas de seguridad (RLS): cada capataz solo ve y toca sus cuadrillas.

create table if not exists cuadrillas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 60),
  capataz uuid not null references auth.users(id) on delete cascade,
  creada timestamptz not null default now()
);

create table if not exists borradores (
  cuadrilla_id uuid primary key references cuadrillas(id) on delete cascade,
  estado jsonb not null,
  actualizado timestamptz not null default now()
);

-- Versiones publicadas: historial inmutable (no hay UPDATE ni DELETE).
create table if not exists versiones (
  id uuid primary key default gen_random_uuid(),
  cuadrilla_id uuid not null references cuadrillas(id) on delete cascade,
  numero int not null,
  estado jsonb not null,
  publicada_en timestamptz not null default now(),
  unique (cuadrilla_id, numero)
);

alter table cuadrillas enable row level security;
alter table borradores enable row level security;
alter table versiones enable row level security;

create policy "capataz ve sus cuadrillas" on cuadrillas
  for select using (capataz = auth.uid());
create policy "capataz crea sus cuadrillas" on cuadrillas
  for insert with check (capataz = auth.uid());
create policy "capataz borra sus cuadrillas" on cuadrillas
  for delete using (capataz = auth.uid());

create policy "borradores propios" on borradores
  for all
  using (exists (select 1 from cuadrillas c where c.id = cuadrilla_id and c.capataz = auth.uid()))
  with check (exists (select 1 from cuadrillas c where c.id = cuadrilla_id and c.capataz = auth.uid()));

create policy "versiones: leer las propias" on versiones
  for select using (exists (select 1 from cuadrillas c where c.id = cuadrilla_id and c.capataz = auth.uid()));
create policy "versiones: publicar en las propias" on versiones
  for insert with check (exists (select 1 from cuadrillas c where c.id = cuadrilla_id and c.capataz = auth.uid()));

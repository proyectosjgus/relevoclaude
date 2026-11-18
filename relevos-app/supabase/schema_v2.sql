-- Paso 4: enlace de cuadrilla para los costaleros. Ejecutar una vez después de schema.sql.

-- Código público de la cuadrilla (el que va en el enlace).
alter table cuadrillas add column if not exists codigo text unique
  default replace(gen_random_uuid()::text, '-', '');
update cuadrillas set codigo = replace(gen_random_uuid()::text, '-', '') where codigo is null;

-- El plan calculado se guarda junto a la versión, para que el costalero no necesite el motor.
alter table versiones add column if not exists plan jsonb;

-- Permitir al capataz regenerar su código.
create policy "capataz actualiza sus cuadrillas" on cuadrillas
  for update using (capataz = auth.uid()) with check (capataz = auth.uid());

create or replace function regenerar_codigo() returns text
language plpgsql security invoker set search_path = public as $$
declare nuevo text := replace(gen_random_uuid()::text, '-', '');
begin
  update cuadrillas set codigo = nuevo where capataz = auth.uid();
  return nuevo;
end $$;
grant execute on function regenerar_codigo() to authenticated;

-- Lo que ve un costalero con el enlace: solo la última versión publicada de esa cuadrilla.
-- No expone correos, contraseñas ni ningún otro dato de la cuenta del capataz.
create or replace function plan_publicado(p_codigo text) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'numero', v.numero,
    'publicada_en', v.publicada_en,
    'estado', v.estado,
    'plan', v.plan
  )
  from cuadrillas c
  join versiones v on v.cuadrilla_id = c.id
  where c.codigo = p_codigo and v.plan is not null
  order by v.numero desc
  limit 1;
$$;
grant execute on function plan_publicado(text) to anon, authenticated;

# Relevos de costaleros (app React)

Paso 2 del plan: pantalla del capataz con el motor de relevos (`src/lib/engine.ts`), sin Supabase todavía.

## Uso
- `npm install`
- `npm run dev` para probar en el ordenador
- `npm run build` para generar la versión lista para publicar (carpeta `dist/`)

## Pantallas
- **Paso:** trabajaderas, costaleros por trabajadera, tramos, reglas.
- **Costaleros:** nombre, rol y boquilla de cada costalero; nombres de los puntos.
- **Fijar:** celdas dentro / fuera / libre por costalero y tramo.
- **Resultado:** plan, errores con botones para corregirlos, bloqueo por doble toque en la pestaña, tarjetas imprimibles.
- **Planes:** guardar, cargar y borrar planes; copia de seguridad.

Los datos se guardan en el navegador (localStorage). Supabase se añade en el paso 3.

## Paso 3: Supabase (nube del capataz)

Sin configurar, la app funciona sola en el móvil como antes. Para activar la nube:

1. En supabase.com crea un proyecto (plan gratuito).
2. En **SQL Editor** pega el contenido de `supabase/schema.sql` y pulsa **Run**.
3. En **Authentication > Providers > Email** déjalo activado y desactiva **Confirm email**, para no depender del envío de correos.
4. En **Project Settings > API** copia la URL y la clave `anon public`.
5. Copia `.env.example` a `.env.local` y pega esos dos valores.
6. `npm run dev`, crea tu cuenta de capataz y prueba: cambia algo, espera a «Guardado en la nube», pulsa **Publicar versión** y comprueba el historial en **Planes**.

La clave `anon` es pública por diseño: la seguridad la dan las reglas RLS de `schema.sql`, que hacen que cada capataz solo vea sus datos.

Notas del plan gratuito: el proyecto se pausa tras una semana sin uso (lo evitaremos con una tarea programada en el paso 4), y los límites de base de datos y de usuarios son muy superiores al uso de una cuadrilla.

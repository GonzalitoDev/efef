# Agenda

Calendario personal inspirado en el flujo de Google Calendar, con diseño, código y textos propios.

## Correrlo

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # tests de recurrencia y layout
npm run build    # build de producción
```

Requiere Node 20+. No necesita cuentas ni claves: los datos se guardan en el navegador (localStorage) y la primera vez carga eventos de ejemplo. Ajustes → "Restablecer datos de ejemplo" los vuelve a cargar.

## Qué tiene

- Vistas día, semana, 4 días, mes y agenda; mini calendario; "Hoy" y anterior / siguiente.
- Crear con clic o arrastrando en un hueco; mover y estirar arrastrando (snap a 15 min, Esc cancela).
- Eventos de todo el día y de varios días; eventos superpuestos lado a lado.
- Repetición: presets y personalizada (cada N, días de semana, mensual por día o por posición, fin por fecha o cantidad). Editar o borrar "este / este y los siguientes / todos".
- Varios calendarios con color, mostrar / ocultar; color por evento.
- Búsqueda, deshacer (tecla z), atajos de teclado (tecla ?), modo oscuro automático, recordatorios con notificaciones del navegador.

## Estructura

```
app/page.tsx          estado de la app, acciones y atajos
components/           grilla horaria, mes, lista, sidebar, popovers, editor, diálogos
lib/recurrence.ts     expansión de RRULE y edición por alcance (puro, testeado)
lib/layout.ts         columnas de eventos superpuestos y barras multi-día
lib/store.ts          interfaz DataStore + LocalStore
replica/              recon, arquitectura, schema.sql (Supabase), matriz de features, build log
```

## Fase 2: Supabase

`replica/schema.sql` tiene las tablas con RLS. Para pasar a la nube: crear un `SupabaseStore` que implemente `DataStore` (mismas firmas) y sumar Supabase Auth. Las pantallas no cambian.

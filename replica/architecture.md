# Arquitectura: clon de Google Calendar ("Agenda")

Lee: `recon.md`, `features.csv`. Fecha: 2026-10-21.

## Stack

| capa | elección | por qué |
| --- | --- | --- |
| web | Next.js 15 (App Router) + TypeScript | ya lo usás (React), deploy trivial en Vercel |
| estilos | CSS global con tokens (custom properties) | diseño propio, modo oscuro con variables, cero config |
| fechas | date-fns + date-fns-tz | puro, tree-shakeable, maneja zonas IANA |
| recurrencia | rrule (rrule.js) | implementa RFC 5545; nunca escribir RRULE a mano |
| datos (fase 1) | data layer local (localStorage) | el slice anda sin cuentas ni claves |
| datos (fase 2) | Postgres en Supabase + RLS | ya lo usás; misma interfaz `DataStore`, cero cambios en pantallas |
| auth (fase 2) | Supabase Auth (email + Google OAuth con tus credenciales) | |
| recordatorios | Notification API del navegador; fase 2: Supabase cron + Resend | |
| hosting | Vercel | |

Un solo repo, una sola base. Sin microservicios.

## Capa de datos

`lib/store.ts` define la interfaz `DataStore`:

```
listCalendars(), saveCalendar(c), deleteCalendar(id)
listEvents(rangeStart, rangeEnd)   -> eventos base que pueden caer en el rango
saveEvent(e), deleteEvent(id)
saveException(x)                   -> ocurrencia editada o cancelada
getSettings(), saveSettings(s)
```

`LocalStore` la implementa con localStorage. `SupabaseStore` (fase 2) usa las mismas firmas.
La expansión de recurrencias (`lib/recurrence.ts`) es pura y vive del lado del cliente: recibe eventos base + excepciones + rango y devuelve ocurrencias.

## Esquema (fase 2)

Ver `schema.sql`. Reglas: uuid, `timestamptz` en UTC, zona IANA en el evento, fin exclusivo, RLS por `user_id` en todo.

## API

Sin backend propio en fase 1. En fase 2 el cliente habla con Supabase directo (RLS protege), más:

| método ruta | qué hace | quién | flujo |
| --- | --- | --- | --- |
| GET `/api/ics/:token` | feed .ics del calendario para suscribirse | público con token | could |
| cron cada 1 min | dispara recordatorios por email | sistema | should |

## Lo que muerde

- **Horario de verano:** expandir RRULE en la zona del evento (no en UTC) para que "todos los lunes 9:00" siga siendo 9:00.
- **"Este y los siguientes":** se corta la serie original con `UNTIL` y se crea una serie nueva desde esa ocurrencia.
- **Todo el día:** fechas sin hora (`YYYY-MM-DD`), fin exclusivo; nunca convertir a UTC.
- **Superposición:** agrupar eventos que se pisan en clusters y asignar columnas por orden de inicio.
- **Drag:** pointer events (mouse + touch), snap a 15 min, cancelar con Esc.

## Orden de construcción

1. **Slice:** semana + crear con clic/arrastre + mover + borrar con deshacer. (S01, S07, S08, S16)
2. **Must:** día, mes, navegación, mini calendario, edición completa, todo el día, estirar, superpuestos, recurrencia + alcance, calendarios, zona horaria. (S02, S04, S09, S11, S12)
3. **Should:** agenda, N días, búsqueda, atajos, color, ajustes, recurrencia personalizada, recordatorios.
4. **Fase 2:** Supabase + auth, deploy.

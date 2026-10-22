# Recon map: Google Calendar (web)

Alcance: núcleo del calendario personal. Vistas día/semana/mes/agenda, crear, editar, mover y borrar eventos, recurrencia, recordatorios, varios calendarios propios, búsqueda, atajos de teclado y ajustes básicos.
Fuera del alcance de esta versión: invitados/RSVP, calendarios compartidos, reservas de citas, Meet, Tasks.
Para: uso propio / aprender.
Fecha: 2026-10-21

## Fuentes

| # | fuente | URL | notas |
| --- | --- | --- | --- |
| 1 | help: crear un evento | https://support.google.com/calendar/answer/72143?hl=en&co=GENIE.Platform%3DDesktop | quick create, botón Crear, Shift+C, campos del evento |
| 2 | help: eventos recurrentes | https://support.google.com/calendar/answer/37115?hl=en&co=GENIE.Platform%3DDesktop | menú "No se repite", límite de 730 ocurrencias, alcance al editar |
| 3 | help: vistas | https://support.google.com/calendar/answer/6110849?hl=en&co=GENIE.Platform%3DDesktop | Día, Semana, Mes, Año, Agenda, 4 días; mini calendario, Hoy, flechas |
| 4 | help: atajos de teclado | https://support.google.com/calendar/answer/37034?hl=en&co=GENIE.Platform%3DDesktop | j/k, t, g, 1-5, c, e, z, Supr, Esc, ? |
| 5 | help: ajustes | https://support.google.com/calendar/answer/6084644?hl=en&co=GENIE.Platform%3DDesktop | idioma/región, zona horaria + secundaria, reloj mundial, duración por defecto, notificaciones, vista |
| 6 | help: horario laboral | https://support.google.com/calendar/answer/7638168?hl=en&co=GENIE.Platform%3DDesktop | horas laborales por día |
| 7 | API pública: recurso Events | https://developers.google.com/workspace/calendar/api/v3/reference/events | modelo de datos casi completo: start/end, RRULE, instancias, recordatorios |
| 8 | tu propia cuenta | — | pendiente: confirmar estados vacío/error y tiempos de interacción usándola vos |

## Core loop

Ver tu semana de un vistazo y crear, mover o editar un evento en uno o dos clics.

## Pantallas

| ID | pantalla | ruta / cómo se llega | propósito | componentes clave | estados vistos |
| --- | --- | --- | --- | --- | --- |
| S01 | Grilla semana | `/week/:fecha` (por defecto) | vista principal: 7 columnas por horas | header de navegación, columna de horas, bloques de evento, línea de "ahora", fila de todo el día | vacía, con eventos, eventos superpuestos, con muchos eventos de todo el día |
| S02 | Grilla día | `/day/:fecha` | un solo día en detalle | igual que S01 con 1 columna | vacía, con eventos |
| S03 | Grilla 4 días / personalizada | `/custom/:fecha` | N días a elección | igual que S01 | — |
| S04 | Mes | `/month/:fecha` | panorama mensual | celdas por día, chips de evento, "+N más" | vacía, celda desbordada |
| S05 | Año | `/year/:año` | 12 mini meses | mini calendarios | — |
| S06 | Agenda (Schedule) | `/agenda` | lista cronológica de próximos eventos | lista agrupada por día | vacía ("no hay eventos"), con eventos |
| S07 | Popover de creación rápida | clic o arrastre en celda vacía | crear con título + hora sin salir de la grilla | input de título, tabs (evento/tarea), fecha-hora, "Más opciones", Guardar | nuevo, error de horario |
| S08 | Popover de detalle | clic en evento | ver resumen y acciones | título, fecha, recurrencia, calendario, botones editar/borrar/color | normal, evento recurrente |
| S09 | Página de edición completa | "Más opciones" / tecla e | todos los campos | título, fechas, todo el día, zona horaria, repetición, ubicación, descripción, recordatorios, color, ocupado/libre, visibilidad, calendario destino | nuevo, editando, cambios sin guardar, error |
| S10 | Modal de recurrencia personalizada | "Personalizado…" en repetición | armar la regla | cada N, días de semana, mensual por día/posición, fin (nunca / fecha / N veces) | — |
| S11 | Diálogo de alcance | guardar o borrar un evento recurrente | elegir a qué ocurrencias aplica | radio: este / este y los siguientes / todos | — |
| S12 | Sidebar izquierda | siempre visible (colapsable) | navegación y calendarios | botón Crear, mini calendario, lista "Mis calendarios" con checkbox y color | colapsada, abierta |
| S13 | Resultados de búsqueda | `/search?q=` o tecla / | encontrar eventos | input, lista de resultados | sin resultados, con resultados |
| S14 | Ajustes | `/settings` o tecla s | preferencias | secciones: general, zona horaria, eventos, vista, notificaciones, atajos, por calendario | — |
| S15 | Modal de atajos | tecla ? | referencia de teclado | tabla de atajos | — |
| S16 | Toast deshacer | tras borrar/mover | revertir rápido | snackbar con "Deshacer" | — |

## Flujos

```
F01 Crear un evento rápido
    S01 -> (clic/arrastre en hueco) S07 -> Guardar -> S01
    clics happy path: 2 (clic + Enter tras escribir el título)
    edge: arrastre que cruza medianoche, hueco de 15 min, título vacío ("(Sin título)")

F02 Crear un evento con todos los detalles
    S01 -> botón Crear o tecla c -> S09 -> Guardar -> S01
    clics: 3 + escritura
    edge: fin antes que inicio, zona horaria distinta al evento, salir con cambios sin guardar

F03 Mover / cambiar duración de un evento
    S01 -> arrastrar bloque (mover) o su borde inferior (duración) -> S16
    clics: 1 arrastre
    edge: soltar en otro día, en fila de todo el día, evento recurrente -> S11

F04 Crear un evento recurrente
    S09 -> Repetición -> preset o S10 -> Guardar
    edge: "último viernes del mes", 31 de cada mes, cruce de horario de verano, límite de 730

F05 Editar una ocurrencia de una serie
    S08 -> editar -> S09 -> Guardar -> S11 (este / siguientes / todos)
    edge: editar "este y los siguientes" parte la serie en dos

F06 Borrar evento (y deshacer)
    S08 -> borrar (o tecla Supr) -> [S11 si es recurrente] -> S16 -> Deshacer
    edge: deshacer tras borrar "todos"

F07 Navegar y cambiar de vista
    S01 <-> S02/S03/S04/S05/S06 con selector o teclas 1-5; j/k anterior/siguiente; t hoy; g ir a fecha; mini calendario
    edge: semana que cruza año, mes con 6 filas

F08 Mostrar / ocultar un calendario
    S12 -> checkbox de "Mis calendarios" -> las grillas se refrescan
    edge: ocultar el calendario por defecto

F09 Buscar un evento
    tecla / -> S13 -> clic en resultado -> S08
    edge: búsqueda sin resultados, evento recurrente aparece una vez o por ocurrencia

F10 Cambiar ajustes
    S14 -> zona horaria / primer día de semana / duración por defecto / recordatorio por defecto
    edge: cambiar zona horaria re-renderiza todos los eventos
```

## Componentes

| componente | variantes | estados | usado en |
| --- | --- | --- | --- |
| Botón | primario (Crear), secundario, texto, icono | default, hover, focus, disabled | todas |
| Bloque de evento (grilla horaria) | normal, corto (<30 min, una línea), superpuesto (ancho dividido), pasado (atenuado) | default, hover, seleccionado, arrastrando, redimensionando | S01-S03 |
| Chip de evento (todo el día / mes) | todo el día, multi-día, con hora | default, hover | S01-S04 |
| Línea "ahora" | — | — | S01-S03 |
| Mini calendario | — | día hoy, día seleccionado, fuera del mes | S12 |
| Selector de fecha | — | abierto, cerrado | S09, S10 |
| Selector de hora | intervalo 15 min, con duración | abierto, cerrado | S07, S09 |
| Selector de color | paleta fija de ~11 colores | seleccionado | S08, S09, S12 |
| Popover | crear, detalle | abierto, cerrando | S07, S08 |
| Modal / diálogo | recurrencia, alcance, confirmación, atajos | — | S10, S11, S15 |
| Toast | con acción "Deshacer" | visible, desapareciendo | S16 |
| Checkbox de calendario | con color del calendario | marcado, desmarcado | S12 |
| Selector de vista | dropdown | — | header |
| Input de búsqueda | — | vacío, escribiendo | header, S13 |

## Modelo de datos inferido

```
User       id, email, name, timezone, locale, week_start (0-6), default_duration_min,
           show_weekends, secondary_timezone, working_hours (json por día)
           evidencia: fuente 5, 6
           confianza: alta

Calendar   id, user_id, name, color, is_default, visible, default_reminders (json)
           evidencia: S12 "Mis calendarios", fuente 1 (elegir calendario destino)
           confianza: alta

Event      id, calendar_id, title, description, location,
           start_at, end_at (timestamptz; fin exclusivo),
           all_day (bool) + start_date, end_date para eventos de todo el día,
           timezone (IANA, obligatoria si es recurrente),
           rrule (texto iCalendar, nullable), exdates (lista de fechas excluidas),
           color (nullable: hereda del calendario), busy (bool, "transparency"),
           visibility (default | public | private), status (confirmed | tentative | cancelled)
           evidencia: fuente 7 (campos summary, start/end, recurrence, transparency, visibility, colorId, status)
           confianza: alta

EventException  id, event_id (serie), original_start (la fecha que tenía según la regla),
                + los campos que cambian, o cancelled = true
           evidencia: fuente 7 (recurringEventId, originalStartTime); S11 "solo este evento"
           confianza: alta

Reminder   id, event_id, method (popup | email), minutes_before
           evidencia: fuente 7 (hasta 5 por evento + recordatorios por defecto del calendario)
           confianza: alta
```

Relaciones: User 1-n Calendar, Calendar 1-n Event, Event 1-n EventException, Event 1-n Reminder.

Decisión clave: las series recurrentes se guardan como **una regla** (`rrule`) y se expanden a ocurrencias al leer un rango de fechas; las ocurrencias editadas o borradas se guardan como excepciones. Nunca se materializan las 730 filas.

## Matriz de features

Ver `features.csv`. Must: 17, should: 11, could: 6, skip: 5.

## Fuera de alcance (no se puede o no se debe clonar)

- La marca, el logo, los colores exactos y los textos de Google: diseño y copy propios.
- Integración con Gmail (eventos creados desde mails), Meet, Tasks, Keep: son otros productos.
- Calendarios de feriados y cumpleaños de Google Contacts: datos de Google. Se puede importar un feed ICS público de feriados como reemplazo.
- Invitados, RSVP y salas: posible fase 2 (opción "Núcleo + compartir").
- Sincronización con la cuenta Google real del usuario: posible fase 3 vía API oficial con tus propias credenciales.

## Tamaño

Pantallas 16, flujos 10, entidades 5.

Partes difíciles:
1. **Recurrencia y excepciones**: expandir RRULE por rango, editar "este y los siguientes" (partir la serie) y cruces de horario de verano. Usá una librería probada (`rrule.js` o `rrule` en Python), no lo escribas a mano.
2. **Drag & drop en la grilla horaria**: mover, redimensionar y crear arrastrando, con snap a 15 min, cambio de día y soporte táctil.
3. **Layout de eventos superpuestos**: calcular columnas y anchos cuando se pisan, como en Google.

Más tranqui que esas: zonas horarias (guardar en UTC + zona IANA del evento) y recordatorios (necesitan un job o notificaciones del navegador).

Tamaño: **M** (algunas semanas en ratos libres). El vertical slice (semana + crear/mover/borrar) es un fin de semana.

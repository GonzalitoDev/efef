# Build log

| ID | fecha | estado | falta / notas |
| --- | --- | --- | --- |
| shell | 2026-10-21 | done | Next.js 15 + TS, tokens CSS con modo oscuro, data layer `LocalStore` detrás de `DataStore` |
| S01 semana | 2026-10-21 | done | grilla horaria, línea de ahora, crear arrastrando, mover, estirar, superpuestos, fila de todo el día |
| S02 día / S03 4 días | 2026-10-21 | done | misma grilla; 4 días es la vista por defecto en celular |
| S04 mes | 2026-10-21 | done | multi-día se muestra como chip por día (no barra continua) |
| S05 año | — | no | could |
| S06 agenda | 2026-10-21 | done | próximos 60 días |
| S07 creación rápida | 2026-10-21 | done | |
| S08 detalle | 2026-10-21 | done | cambio de color directo desde el popover |
| S09 edición | 2026-10-21 | done | Ctrl+S guarda, Esc pregunta si hay cambios |
| S10 recurrencia personalizada | 2026-10-21 | done | cada N, días de semana, mensual por día o posición, fin |
| S11 alcance | 2026-10-21 | done | si cambia la regla, no ofrece "solo este" |
| S12 sidebar | 2026-10-21 | done | crear / editar / borrar calendarios |
| S13 búsqueda | 2026-10-21 | done | ±1 año, sin acentos |
| S14 ajustes | 2026-10-21 | partial | falta selector de zona horaria (usa la del navegador) |
| S15 atajos | 2026-10-21 | done | |
| S16 deshacer | 2026-10-21 | done | historial de 30 pasos, tecla z |

Más difícil de lo esperado: "este y los siguientes" con COUNT (hay que repartir las ocurrencias restantes) y que los eventos de todo el día nunca pasen por UTC.

## Verificación

- `npm test`: 12 tests de recurrencia, alcance y layout, corridos en Buenos Aires y en Nueva York (horario de verano).
- `npm run build`: build de producción OK.
- Click-through en Chromium headless (16 de 16 chequeos): crear arrastrando, mover, estirar, borrar + deshacer, mover una ocurrencia recurrente con alcance, editor con repetición semanal, agenda, mes, búsqueda, persistencia al recargar, 390 px sin scroll horizontal.
- Sin probar: arrastre táctil en un celular real, notificaciones reales.

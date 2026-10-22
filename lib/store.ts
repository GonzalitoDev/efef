import type { AgendaState } from "./types";
import { seedState } from "./seed";

/**
 * Interfaz de persistencia. Las pantallas solo hablan con esto.
 * Fase 1: LocalStore (localStorage). Fase 2: SupabaseStore con las mismas firmas
 * (ver replica/schema.sql).
 */
export interface DataStore {
  load(): AgendaState;
  save(state: AgendaState): void;
}

const KEY = "agenda:v1";

export class LocalStore implements DataStore {
  load(): AgendaState {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AgendaState;
        if (Array.isArray(parsed.calendars) && Array.isArray(parsed.events)) return parsed;
      }
    } catch {
      /* sin storage (modo privado, preview): arranca con datos de ejemplo */
    }
    return seedState(new Date());
  }

  save(state: AgendaState): void {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignorar */
    }
  }
}

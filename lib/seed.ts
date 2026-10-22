import { addDays, startOfWeek } from "date-fns";
import { localTimezone, toDateOnly } from "./dates";
import type { AgendaState, CalEvent } from "./types";

export const PALETTE = [
  { name: "Tomate", value: "#d14b3c" },
  { name: "Mandarina", value: "#e8833a" },
  { name: "Banana", value: "#e3b33b" },
  { name: "Albahaca", value: "#2f8f5b" },
  { name: "Salvia", value: "#4fb38a" },
  { name: "Pavo real", value: "#2a8bc9" },
  { name: "Arándano", value: "#4361c9" },
  { name: "Lavanda", value: "#7d86d6" },
  { name: "Uva", value: "#8a4fb3" },
  { name: "Flamenco", value: "#d9748f" },
  { name: "Grafito", value: "#62666d" },
];

/** Datos de ejemplo para que la primera carga no esté vacía */
export function seedState(today: Date): AgendaState {
  const tz = localTimezone();
  const mon = startOfWeek(today, { weekStartsOn: 1 });
  const at = (dayOffset: number, h: number, m = 0) => {
    const d = addDays(mon, dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const ev = (p: Partial<CalEvent> & Pick<CalEvent, "id" | "title" | "start" | "end">): CalEvent => ({
    calendarId: "personal",
    description: "",
    location: "",
    allDay: false,
    timezone: tz,
    rrule: null,
    color: null,
    busy: true,
    reminderMin: 10,
    ...p,
  });
  return {
    calendars: [
      { id: "personal", name: "Personal", color: "#4361c9", isDefault: true, visible: true },
      { id: "facultad", name: "Facultad", color: "#2f8f5b", isDefault: false, visible: true },
      { id: "proyectos", name: "Proyectos", color: "#e8833a", isDefault: false, visible: true },
    ],
    events: [
      ev({ id: "s1", calendarId: "facultad", title: "Base de datos", location: "Aula 12", start: at(0, 18), end: at(0, 21), rrule: "FREQ=WEEKLY;BYDAY=MO" }),
      ev({ id: "s2", calendarId: "facultad", title: "Programación II", start: at(2, 18), end: at(2, 20), rrule: "FREQ=WEEKLY;BYDAY=WE" }),
      ev({ id: "s3", calendarId: "proyectos", title: "Deploy a producción", start: at(1, 10), end: at(1, 11, 30) }),
      ev({ id: "s4", calendarId: "proyectos", title: "Code review", start: at(1, 11), end: at(1, 12) }),
      ev({ id: "s5", title: "Gimnasio", start: at(0, 8), end: at(0, 9), rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR" }),
      ev({ id: "s6", calendarId: "facultad", title: "Parcial", allDay: true, start: toDateOnly(addDays(mon, 3)), end: toDateOnly(addDays(mon, 4)), reminderMin: null }),
      ev({ id: "s7", title: "Asado con amigos", start: at(5, 13), end: at(5, 16), location: "Casa de Juan" }),
    ],
    exceptions: [],
    settings: { weekStart: 1, showWeekends: true, defaultDurationMin: 60 },
  };
}

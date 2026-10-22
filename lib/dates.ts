import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  differenceInCalendarDays,
} from "date-fns";
import { es } from "date-fns/locale";
import type { Settings, ViewKind } from "./types";

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

/** "YYYY-MM-DD" -> medianoche local */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date -> "YYYY-MM-DD" en hora local */
export function toDateOnly(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function fmt(d: Date, pattern: string): string {
  return format(d, pattern, { locale: es });
}

export function timeLabel(d: Date): string {
  return format(d, "H:mm");
}

export function localTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Redondea al múltiplo de `step` minutos más cercano */
export function snap(d: Date, step = 15): Date {
  const minutes = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  const out = new Date(d);
  out.setHours(0, Math.round(minutes / step) * step, 0, 0);
  return out;
}

/** Días visibles para las vistas de grilla horaria */
export function gridDays(view: ViewKind, anchor: Date, s: Settings): Date[] {
  const a = startOfDay(anchor);
  if (view === "day") return [a];
  if (view === "4days") return [0, 1, 2, 3].map((i) => addDays(a, i));
  const start = startOfWeek(a, { weekStartsOn: s.weekStart });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return s.showWeekends ? days : days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
}

/** Semanas (filas) de la vista mes */
export function monthWeeks(anchor: Date, s: Settings): Date[][] {
  const first = startOfWeek(startOfMonth(anchor), { weekStartsOn: s.weekStart });
  const last = endOfMonth(anchor);
  const weeks: Date[][] = [];
  let cur = first;
  while (cur <= last || weeks.length < 5) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cur, i));
    weeks.push(s.showWeekends ? week : week.filter((d) => d.getDay() !== 0 && d.getDay() !== 6));
    cur = addDays(cur, 7);
    if (weeks.length === 6) break;
  }
  return weeks;
}

/** Rango [start, end) de fechas que la vista necesita */
export function viewRange(view: ViewKind, anchor: Date, s: Settings): [Date, Date] {
  if (view === "month") {
    const weeks = monthWeeks(anchor, { ...s, showWeekends: true });
    return [weeks[0][0], addDays(weeks[weeks.length - 1][6], 1)];
  }
  if (view === "agenda") {
    const a = startOfDay(anchor);
    return [a, addDays(a, 60)];
  }
  const days = gridDays(view, anchor, { ...s, showWeekends: true });
  return [days[0], addDays(days[days.length - 1], 1)];
}

export function step(view: ViewKind, anchor: Date, dir: 1 | -1): Date {
  switch (view) {
    case "day":
      return addDays(anchor, dir);
    case "4days":
      return addDays(anchor, 4 * dir);
    case "week":
      return addWeeks(anchor, dir);
    case "month":
      return addMonths(anchor, dir);
    case "agenda":
      return addDays(anchor, 30 * dir);
  }
}

export function viewTitle(view: ViewKind, anchor: Date, s: Settings): string {
  if (view === "day") return cap(fmt(anchor, "EEEE d 'de' MMMM 'de' yyyy"));
  if (view === "month" || view === "agenda") return cap(fmt(anchor, "MMMM 'de' yyyy"));
  const days = gridDays(view, anchor, { ...s, showWeekends: true });
  const a = days[0];
  const b = days[days.length - 1];
  if (a.getMonth() === b.getMonth()) return cap(fmt(a, "MMMM 'de' yyyy"));
  if (a.getFullYear() === b.getFullYear()) return cap(`${fmt(a, "MMM")} – ${fmt(b, "MMM 'de' yyyy")}`);
  return cap(`${fmt(a, "MMM yyyy")} – ${fmt(b, "MMM yyyy")}`);
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function daysBetween(a: Date, b: Date): number {
  return differenceInCalendarDays(b, a);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

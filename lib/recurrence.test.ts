import { describe, expect, it } from "vitest";
import { deleteOccurrence, describeRule, expandAll, expandEvent, presets, updateOccurrence } from "./recurrence";
import { layoutAllDay, layoutDay } from "./layout";
import type { AgendaState, CalEvent, Occurrence } from "./types";

const cal = { id: "c1", name: "Personal", color: "#3b6", isDefault: true, visible: true };
const base: CalEvent = {
  id: "e1",
  calendarId: "c1",
  title: "Clase",
  description: "",
  location: "",
  allDay: false,
  start: new Date(2026, 9, 5, 9, 0).toISOString(), // lunes 5/10/2026 9:00 local
  end: new Date(2026, 9, 5, 10, 30).toISOString(),
  timezone: "local",
  rrule: "FREQ=WEEKLY;BYDAY=MO",
  color: null,
  busy: true,
  reminderMin: null,
};
const state = (ev: CalEvent = base): AgendaState => ({
  calendars: [cal],
  events: [ev],
  exceptions: [],
  settings: { weekStart: 1, showWeekends: true, defaultDurationMin: 60 },
});
const oct = (d: number, h = 0, m = 0) => new Date(2026, 9, d, h, m);
const range = [oct(1), new Date(2026, 11, 1)] as const;

describe("expansión", () => {
  it("genera ocurrencias semanales a la misma hora de pared", () => {
    const occ = expandEvent(base, [], new Date(2026, 9, 1), new Date(2027, 3, 1));
    expect(occ.length).toBeGreaterThan(20);
    for (const o of occ) {
      expect(o.start.getDay()).toBe(1);
      expect(o.start.getHours()).toBe(9); // también a través de cambios de horario
      expect((o.end.getTime() - o.start.getTime()) / 60000).toBe(90);
    }
    expect(occ[0].isFirst).toBe(true);
    expect(occ[1].isFirst).toBe(false);
  });

  it("evento sin repetición solo aparece si toca el rango", () => {
    const ev = { ...base, rrule: null };
    expect(expandEvent(ev, [], oct(5), oct(6))).toHaveLength(1);
    expect(expandEvent(ev, [], oct(6), oct(7))).toHaveLength(0);
  });

  it("calendarios ocultos no aparecen", () => {
    const s = state();
    s.calendars = [{ ...cal, visible: false }];
    expect(expandAll(s, ...range)).toHaveLength(0);
  });

  it("eventos de todo el día usan fechas, no horas", () => {
    const ev: CalEvent = { ...base, allDay: true, start: "2026-10-05", end: "2026-10-07", rrule: "FREQ=MONTHLY" };
    const occ = expandEvent(ev, [], oct(1), new Date(2027, 0, 1));
    expect(occ.map((o) => o.start.getDate())).toEqual([5, 5, 5]);
    expect(occ[0].end.getDate()).toBe(7);
    expect(occ[0].originalStart).toBe("2026-10-05");
  });
});

describe("edición por alcance", () => {
  const second = (s: AgendaState): Occurrence => expandAll(s, ...range)[1]; // 12/10

  it("solo este: crea una excepción y no toca el resto", () => {
    const s = state();
    const o = second(s);
    const moved = updateOccurrence(s, o, { title: "Parcial", start: oct(12, 14).toISOString(), end: oct(12, 16).toISOString() }, "this");
    const occ = expandAll(moved, ...range);
    expect(occ[1].title).toBe("Parcial");
    expect(occ[1].start.getHours()).toBe(14);
    expect(occ[0].title).toBe("Clase");
    expect(occ[2].title).toBe("Clase");
    expect(moved.exceptions).toHaveLength(1);
  });

  it("este y los siguientes: parte la serie en dos", () => {
    const s = state();
    const o = second(s);
    const next = updateOccurrence(s, o, { start: oct(12, 11).toISOString(), end: oct(12, 12).toISOString() }, "following");
    expect(next.events).toHaveLength(2);
    const occ = expandAll(next, ...range);
    expect(occ[0].start.getHours()).toBe(9);
    expect(occ.slice(1).every((x) => x.start.getHours() === 11)).toBe(true);
    // sin duplicados: una ocurrencia por lunes
    const mondays = new Set(occ.map((x) => x.start.toDateString()));
    expect(mondays.size).toBe(occ.length);
  });

  it("todos: mueve la serie entera y la realinea al nuevo día", () => {
    const s = state();
    const o = second(s);
    const next = updateOccurrence(s, o, { start: oct(13, 18).toISOString(), end: oct(13, 19).toISOString() }, "all");
    const occ = expandAll(next, ...range);
    expect(occ.every((x) => x.start.getDay() === 2 && x.start.getHours() === 18)).toBe(true);
    expect(occ[0].start.getDate()).toBe(6);
  });

  it("COUNT se reparte al partir la serie", () => {
    const s = state({ ...base, rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=5" });
    const o = second(s);
    const next = updateOccurrence(s, o, { title: "Nuevo" }, "following");
    const occ = expandAll(next, oct(1), new Date(2027, 0, 1));
    expect(occ).toHaveLength(5);
    expect(occ.filter((x) => x.title === "Nuevo")).toHaveLength(4);
  });

  it("borrar solo este / siguientes / todos", () => {
    const s = state();
    const o = second(s);
    const total = expandAll(s, ...range).length;
    expect(expandAll(deleteOccurrence(s, o, "this"), ...range)).toHaveLength(total - 1);
    expect(expandAll(deleteOccurrence(s, o, "following"), ...range)).toHaveLength(1);
    expect(expandAll(deleteOccurrence(s, o, "all"), ...range)).toHaveLength(0);
  });
});

describe("textos", () => {
  it("describe presets en español", () => {
    const d = oct(5, 9);
    expect(describeRule("FREQ=WEEKLY;BYDAY=MO", d)).toBe("Cada semana el lunes");
    expect(presets(oct(30)).find((p) => p.id === "monthlyNth")!.label).toBe("Todos los meses el último viernes");
    expect(describeRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=6", d)).toBe("Cada 2 semanas el lun, mié, 6 veces");
  });
});

describe("layout", () => {
  const mk = (id: string, s: Date, e: Date, allDay = false): Occurrence => ({
    key: id, eventId: id, originalStart: "", start: s, end: e, allDay, title: id, location: "", description: "",
    calendarId: "c1", color: null, recurring: false, isFirst: true,
  });

  it("eventos que se pisan comparten el ancho", () => {
    const p = layoutDay([mk("a", oct(5, 9), oct(5, 11)), mk("b", oct(5, 10), oct(5, 12)), mk("c", oct(5, 13), oct(5, 14))], oct(5));
    const a = p.find((x) => x.occ.key === "a")!;
    const b = p.find((x) => x.occ.key === "b")!;
    const c = p.find((x) => x.occ.key === "c")!;
    expect(a.width).toBe(0.5);
    expect(b.left).toBe(0.5);
    expect(c.width).toBe(1);
    expect(a.top).toBe(540);
  });

  it("barras multi-día ocupan filas distintas si se pisan", () => {
    const days = [5, 6, 7, 8, 9, 10, 11].map((d) => oct(d));
    const { bars, rows } = layoutAllDay([mk("x", oct(5), oct(8), true), mk("y", oct(7), oct(9), true)], days);
    expect(rows).toBe(2);
    expect(bars[0].span).toBe(3);
    expect(bars[1].startCol).toBe(2);
  });
});

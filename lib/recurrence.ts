import { RRule, Weekday, type Options } from "rrule";
import { DAY, parseDateOnly, toDateOnly, uid } from "./dates";
import type { AgendaState, CalEvent, EventException, EventPatch, Occurrence, Scope } from "./types";

/*
 * Las reglas se expanden en "tiempo flotante": la hora de pared local se guarda
 * en los campos UTC de un Date. Así "todos los lunes 9:00" sigue siendo 9:00
 * aunque haya cambio de horario de verano en el medio.
 */
const toFloating = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
const fromFloating = (f: Date) =>
  new Date(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate(), f.getUTCHours(), f.getUTCMinutes(), f.getUTCSeconds());

export function parseStamp(s: string, allDay: boolean): Date {
  return allDay ? parseDateOnly(s) : new Date(s);
}

export function toStamp(d: Date, allDay: boolean): string {
  return allDay ? toDateOnly(d) : d.toISOString();
}

export const eventStart = (ev: CalEvent) => parseStamp(ev.start, ev.allDay);
export const eventEnd = (ev: CalEvent) => parseStamp(ev.end, ev.allDay);

function parseRule(rrule: string): Partial<Options> {
  return RRule.parseString(rrule.replace(/^RRULE:/, ""));
}

export function ruleToString(opts: Partial<Options>): string {
  const clean = { ...opts };
  delete clean.dtstart;
  delete clean.tzid;
  return RRule.optionsToString(clean).replace(/^RRULE:/, "");
}

function buildRule(ev: CalEvent): RRule {
  return new RRule({ ...parseRule(ev.rrule!), dtstart: toFloating(eventStart(ev)) });
}

function applyPatchTimes(allDay: boolean, start: Date, end: Date, p: EventPatch) {
  const ad = p.allDay ?? allDay;
  return {
    allDay: ad,
    start: p.start !== undefined ? parseStamp(p.start, ad) : start,
    end: p.end !== undefined ? parseStamp(p.end, ad) : end,
  };
}

function makeOcc(ev: CalEvent, originalStart: string, start: Date, end: Date, p: EventPatch, isFirst: boolean): Occurrence {
  const t = applyPatchTimes(ev.allDay, start, end, p);
  return {
    key: `${ev.id}|${originalStart}`,
    eventId: ev.id,
    originalStart,
    start: t.start,
    end: t.end,
    allDay: t.allDay,
    title: p.title ?? ev.title,
    location: p.location ?? ev.location,
    description: p.description ?? ev.description,
    calendarId: p.calendarId ?? ev.calendarId,
    color: p.color !== undefined ? p.color : ev.color,
    recurring: !!ev.rrule,
    isFirst,
  };
}

const overlaps = (o: Occurrence, a: Date, b: Date) => o.start < b && (o.end > a || (o.end.getTime() === o.start.getTime() && o.start >= a));

/** Todas las apariciones de un evento que tocan [rangeStart, rangeEnd) */
export function expandEvent(ev: CalEvent, exceptions: EventException[], rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const start = eventStart(ev);
  const end = eventEnd(ev);
  if (!ev.rrule) {
    const o = makeOcc(ev, ev.start, start, end, {}, true);
    return overlaps(o, rangeStart, rangeEnd) ? [o] : [];
  }
  const dur = end.getTime() - start.getTime();
  const rule = buildRule(ev);
  const firstF = rule.after(rule.options.dtstart, true);
  const firstKey = firstF ? toStamp(fromFloating(firstF), ev.allDay) : ev.start;
  // margen para ocurrencias movidas a este rango y eventos largos
  const pad = 31 * DAY + dur;
  const dates = rule.between(toFloating(new Date(rangeStart.getTime() - pad)), toFloating(new Date(rangeEnd.getTime() + 31 * DAY)), true);
  const exMap = new Map(exceptions.filter((x) => x.eventId === ev.id).map((x) => [x.originalStart, x]));
  const out: Occurrence[] = [];
  for (const f of dates) {
    const s = fromFloating(f);
    const e = ev.allDay ? addDaysKeepWall(s, Math.round(dur / DAY)) : new Date(s.getTime() + dur);
    const key = toStamp(s, ev.allDay);
    const ex = exMap.get(key);
    if (ex?.cancelled) continue;
    const o = makeOcc(ev, key, s, e, ex?.overrides ?? {}, key === firstKey);
    if (overlaps(o, rangeStart, rangeEnd)) out.push(o);
  }
  return out;
}

function addDaysKeepWall(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function expandAll(state: AgendaState, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const visible = new Set(state.calendars.filter((c) => c.visible).map((c) => c.id));
  const out: Occurrence[] = [];
  for (const ev of state.events) {
    for (const o of expandEvent(ev, state.exceptions, rangeStart, rangeEnd)) {
      if (visible.has(o.calendarId)) out.push(o);
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
}

/* ---------- edición por alcance ---------- */

/** Corta la serie para que termine justo antes de `before` */
function truncateRule(ev: CalEvent, before: Date): string {
  const opts = parseRule(ev.rrule!);
  delete opts.count;
  opts.until = new Date(toFloating(before).getTime() - 1000);
  return ruleToString(opts);
}

/** Cuántas ocurrencias de la serie caen antes de `before` (para repartir COUNT) */
function countBefore(ev: CalEvent, before: Date): number {
  return buildRule(ev).between(new Date(0), new Date(toFloating(before).getTime() - 1000), true).length;
}

/** Si la serie es semanal con un único día, lo alinea con el nuevo inicio */
function realignWeekday(rrule: string, start: Date): string {
  const opts = parseRule(rrule);
  const by = opts.byweekday;
  const list = Array.isArray(by) ? by : by != null ? [by] : [];
  if (opts.freq === RRule.WEEKLY && list.length === 1) {
    opts.byweekday = [jsDayToWeekday(start.getDay())];
    return ruleToString(opts);
  }
  return rrule;
}

export function jsDayToWeekday(day: number): Weekday {
  return [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA][day];
}

function patchEvent(ev: CalEvent, p: EventPatch): CalEvent {
  return { ...ev, ...p };
}

export function updateOccurrence(state: AgendaState, occ: Occurrence, patch: EventPatch, scope: Scope): AgendaState {
  const ev = state.events.find((e) => e.id === occ.eventId);
  if (!ev) return state;

  if (!ev.rrule) {
    return { ...state, events: state.events.map((e) => (e.id === ev.id ? patchEvent(e, patch) : e)) };
  }

  if (scope === "this") {
    const others = state.exceptions.filter((x) => !(x.eventId === ev.id && x.originalStart === occ.originalStart));
    const prev = state.exceptions.find((x) => x.eventId === ev.id && x.originalStart === occ.originalStart);
    const overrides = { ...(prev?.overrides ?? {}), ...patch };
    return { ...state, exceptions: [...others, { eventId: ev.id, originalStart: occ.originalStart, cancelled: false, overrides }] };
  }

  const timeChanged = patch.start !== undefined || patch.end !== undefined || patch.allDay !== undefined;
  const newOcc = applyPatchTimes(occ.allDay, occ.start, occ.end, patch);

  if (scope === "all" || occ.isFirst) {
    let base: CalEvent = patchEvent(ev, { ...patch, start: ev.start, end: ev.end, allDay: ev.allDay });
    if (timeChanged) {
      const seriesStart = eventStart(ev);
      // misma fecha de inicio de la serie, desplazada lo mismo que la ocurrencia
      const shiftDays = Math.round((startOfDayMs(newOcc.start) - startOfDayMs(occ.start)) / DAY);
      const s = new Date(seriesStart);
      s.setDate(s.getDate() + shiftDays);
      if (!newOcc.allDay) s.setHours(newOcc.start.getHours(), newOcc.start.getMinutes(), 0, 0);
      else s.setHours(0, 0, 0, 0);
      const len = newOcc.end.getTime() - newOcc.start.getTime();
      const e = newOcc.allDay ? addDaysKeepWall(s, Math.max(1, Math.round(len / DAY))) : new Date(s.getTime() + len);
      base = {
        ...base,
        allDay: newOcc.allDay,
        start: toStamp(s, newOcc.allDay),
        end: toStamp(e, newOcc.allDay),
        rrule: realignWeekday(ev.rrule, s),
      };
    }
    return {
      ...state,
      events: state.events.map((e) => (e.id === ev.id ? base : e)),
      // si cambió la hora, las excepciones ya no corresponden a ninguna ocurrencia
      exceptions: timeChanged ? state.exceptions.filter((x) => x.eventId !== ev.id) : state.exceptions,
    };
  }

  // "este y los siguientes": corta la serie y crea una nueva desde esta ocurrencia
  const origStart = parseStamp(occ.originalStart, ev.allDay);
  const opts = parseRule(ev.rrule);
  const newId = uid();
  let newRule = ev.rrule;
  if (opts.count) {
    const remaining = opts.count - countBefore(ev, origStart);
    newRule = ruleToString({ ...opts, count: remaining });
  }
  const startForRule = newOcc.start;
  const next: CalEvent = {
    ...patchEvent(ev, patch),
    id: newId,
    allDay: newOcc.allDay,
    start: toStamp(newOcc.start, newOcc.allDay),
    end: toStamp(newOcc.end, newOcc.allDay),
    rrule: timeChanged ? realignWeekday(newRule, startForRule) : newRule,
  };
  const truncated: CalEvent = { ...ev, rrule: truncateRule(ev, origStart) };
  const keep = (x: EventException) => x.eventId !== ev.id || parseStamp(x.originalStart, ev.allDay) < origStart;
  const moved = timeChanged
    ? []
    : state.exceptions
        .filter((x) => x.eventId === ev.id && parseStamp(x.originalStart, ev.allDay) >= origStart)
        .map((x) => ({ ...x, eventId: newId }));
  return {
    ...state,
    events: [...state.events.map((e) => (e.id === ev.id ? truncated : e)), next],
    exceptions: [...state.exceptions.filter(keep), ...moved],
  };
}

export function deleteOccurrence(state: AgendaState, occ: Occurrence, scope: Scope): AgendaState {
  const ev = state.events.find((e) => e.id === occ.eventId);
  if (!ev) return state;
  const removeAll = () => ({
    ...state,
    events: state.events.filter((e) => e.id !== ev.id),
    exceptions: state.exceptions.filter((x) => x.eventId !== ev.id),
  });
  if (!ev.rrule || scope === "all" || (scope === "following" && occ.isFirst)) return removeAll();
  if (scope === "this") {
    const others = state.exceptions.filter((x) => !(x.eventId === ev.id && x.originalStart === occ.originalStart));
    return { ...state, exceptions: [...others, { eventId: ev.id, originalStart: occ.originalStart, cancelled: true, overrides: {} }] };
  }
  const origStart = parseStamp(occ.originalStart, ev.allDay);
  return {
    ...state,
    events: state.events.map((e) => (e.id === ev.id ? { ...e, rrule: truncateRule(e, origStart) } : e)),
    exceptions: state.exceptions.filter((x) => x.eventId !== ev.id || parseStamp(x.originalStart, ev.allDay) < origStart),
  };
}

function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/* ---------- textos y presets ---------- */

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ORD: Record<number, string> = { 1: "primer", 2: "segundo", 3: "tercer", 4: "cuarto", [-1]: "último" };
const WD_TO_JS = [1, 2, 3, 4, 5, 6, 0]; // rrule weekday (0=MO) -> js day

export function nthOfMonth(d: Date): number {
  const n = Math.ceil(d.getDate() / 7);
  const nextWeek = new Date(d);
  nextWeek.setDate(d.getDate() + 7);
  return nextWeek.getMonth() !== d.getMonth() && n >= 4 ? -1 : n;
}

export type Preset = { id: string; label: string; rrule: string | null };

export function presets(start: Date): Preset[] {
  const wd = jsDayToWeekday(start.getDay());
  const n = nthOfMonth(start);
  return [
    { id: "none", label: "No se repite", rrule: null },
    { id: "daily", label: "Todos los días", rrule: "FREQ=DAILY" },
    { id: "weekly", label: `Cada semana el ${DAY_NAMES[start.getDay()]}`, rrule: ruleToString({ freq: RRule.WEEKLY, byweekday: [wd] }) },
    { id: "monthlyNth", label: `Todos los meses el ${ORD[n]} ${DAY_NAMES[start.getDay()]}`, rrule: ruleToString({ freq: RRule.MONTHLY, byweekday: [wd.nth(n)] }) },
    { id: "monthlyDay", label: `Todos los meses el día ${start.getDate()}`, rrule: ruleToString({ freq: RRule.MONTHLY, bymonthday: [start.getDate()] }) },
    { id: "yearly", label: `Todos los años el ${start.getDate()} de ${MONTHS[start.getMonth()]}`, rrule: "FREQ=YEARLY" },
    { id: "weekdays", label: "Todos los días hábiles (lunes a viernes)", rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  ];
}

/** Texto legible en español para una regla */
export function describeRule(rrule: string | null, start: Date): string {
  if (!rrule) return "No se repite";
  const p = presets(start).find((x) => x.rrule === rrule);
  if (p) return p.label;
  const o = parseRule(rrule);
  const every = o.interval && o.interval > 1 ? o.interval : 1;
  const unit: Record<number, [string, string]> = {
    [RRule.DAILY]: ["día", "días"],
    [RRule.WEEKLY]: ["semana", "semanas"],
    [RRule.MONTHLY]: ["mes", "meses"],
    [RRule.YEARLY]: ["año", "años"],
  };
  const [one, many] = unit[o.freq ?? RRule.DAILY] ?? ["día", "días"];
  let txt = every === 1 ? `Cada ${one}` : `Cada ${every} ${many}`;
  const by = o.byweekday == null ? [] : Array.isArray(o.byweekday) ? o.byweekday : [o.byweekday];
  if (by.length) {
    const parts = by.map((w) => {
      const wk = typeof w === "number" ? new Weekday(w) : (w as Weekday);
      const name = DAY_SHORT[WD_TO_JS[wk.weekday]];
      return wk.n ? `${ORD[wk.n] ?? wk.n + "º"} ${name}` : name;
    });
    txt += ` el ${parts.join(", ")}`;
  }
  if (o.bymonthday != null) {
    const md = Array.isArray(o.bymonthday) ? o.bymonthday : [o.bymonthday];
    txt += ` el día ${md.join(", ")}`;
  }
  if (o.count) txt += `, ${o.count} veces`;
  else if (o.until) {
    const u = fromFloating(o.until);
    txt += `, hasta el ${u.getDate()} de ${MONTHS[u.getMonth()]} de ${u.getFullYear()}`;
  }
  return txt;
}

/** Opciones editables de una regla, para el modal de recurrencia personalizada */
export type CustomRule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  weekdays: number[]; // js days
  monthMode: "day" | "nth";
  end: "never" | "until" | "count";
  until: string; // YYYY-MM-DD
  count: number;
};

const FREQS = { DAILY: RRule.DAILY, WEEKLY: RRule.WEEKLY, MONTHLY: RRule.MONTHLY, YEARLY: RRule.YEARLY } as const;

export function customFromRule(rrule: string | null, start: Date): CustomRule {
  const base: CustomRule = {
    freq: "WEEKLY",
    interval: 1,
    weekdays: [start.getDay()],
    monthMode: "day",
    end: "never",
    until: toDateOnly(new Date(start.getFullYear(), start.getMonth() + 3, start.getDate())),
    count: 10,
  };
  if (!rrule) return base;
  const o = parseRule(rrule);
  const freq = (Object.keys(FREQS) as CustomRule["freq"][]).find((k) => FREQS[k] === o.freq) ?? "WEEKLY";
  const by = o.byweekday == null ? [] : Array.isArray(o.byweekday) ? o.byweekday : [o.byweekday];
  const wds = by.map((w) => (typeof w === "number" ? new Weekday(w) : (w as Weekday)));
  return {
    ...base,
    freq,
    interval: o.interval ?? 1,
    weekdays: freq === "WEEKLY" && wds.length ? wds.map((w) => WD_TO_JS[w.weekday]) : base.weekdays,
    monthMode: freq === "MONTHLY" && wds.some((w) => w.n) ? "nth" : "day",
    end: o.count ? "count" : o.until ? "until" : "never",
    until: o.until ? toDateOnly(fromFloating(o.until)) : base.until,
    count: o.count ?? base.count,
  };
}

export function ruleFromCustom(c: CustomRule, start: Date): string {
  const opts: Partial<Options> = { freq: FREQS[c.freq] };
  if (c.interval > 1) opts.interval = c.interval;
  if (c.freq === "WEEKLY") {
    const days = c.weekdays.length ? [...c.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) : [start.getDay()];
    opts.byweekday = days.map(jsDayToWeekday);
  }
  if (c.freq === "MONTHLY") {
    if (c.monthMode === "nth") opts.byweekday = [jsDayToWeekday(start.getDay()).nth(nthOfMonth(start))];
    else opts.bymonthday = [start.getDate()];
  }
  if (c.end === "count") opts.count = Math.max(1, Math.min(730, c.count));
  if (c.end === "until") {
    const u = parseDateOnly(c.until);
    opts.until = new Date(Date.UTC(u.getFullYear(), u.getMonth(), u.getDate(), 23, 59, 59));
  }
  return ruleToString(opts);
}

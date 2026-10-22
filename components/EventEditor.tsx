"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { DAY, MIN, parseDateOnly, toDateOnly } from "@/lib/dates";
import { customFromRule, describeRule, presets, ruleFromCustom, type CustomRule } from "@/lib/recurrence";
import { PALETTE } from "@/lib/seed";
import type { Calendar } from "@/lib/types";
import { Icon } from "./Icon";

export type Draft = {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  rrule: string | null;
  location: string;
  description: string;
  calendarId: string;
  color: string | null;
  busy: boolean;
  reminderMin: number | null;
};

export function draftFrom(o: {
  title: string; allDay: boolean; start: Date; end: Date; rrule: string | null; location: string; description: string;
  calendarId: string; color: string | null; busy: boolean; reminderMin: number | null;
}): Draft {
  const lastDay = o.allDay ? addDays(o.end, -1) : o.end;
  return {
    title: o.title,
    allDay: o.allDay,
    startDate: toDateOnly(o.start),
    startTime: format(o.start, "HH:mm"),
    endDate: toDateOnly(lastDay),
    endTime: format(o.end, "HH:mm"),
    rrule: o.rrule,
    location: o.location,
    description: o.description,
    calendarId: o.calendarId,
    color: o.color,
    busy: o.busy,
    reminderMin: o.reminderMin,
  };
}

/** Convierte el borrador en fechas reales (fin exclusivo) */
export function draftTimes(d: Draft): { start: Date; end: Date } {
  if (d.allDay) return { start: parseDateOnly(d.startDate), end: addDays(parseDateOnly(d.endDate), 1) };
  const at = (date: string, time: string) => {
    const x = parseDateOnly(date);
    const [h, m] = time.split(":").map(Number);
    x.setHours(h || 0, m || 0, 0, 0);
    return x;
  };
  return { start: at(d.startDate, d.startTime), end: at(d.endDate, d.endTime) };
}

const REMINDERS: [number | null, string][] = [
  [null, "Sin recordatorio"],
  [0, "A la hora del evento"],
  [5, "5 minutos antes"],
  [10, "10 minutos antes"],
  [30, "30 minutos antes"],
  [60, "1 hora antes"],
  [1440, "1 día antes"],
];

export function EventEditor(p: {
  heading: string;
  initial: Draft;
  calendars: Calendar[];
  onSave: (d: Draft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<Draft>(p.initial);
  const [custom, setCustom] = useState(false);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const { start, end } = draftTimes(d);
  const invalid = !(end > start);
  const dirty = JSON.stringify(d) !== JSON.stringify(p.initial);

  const presetList = useMemo(() => presets(start), [start.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const presetId = presetList.find((x) => x.rrule === d.rrule)?.id ?? "current";

  const close = () => {
    if (dirty && !window.confirm("¿Descartar los cambios sin guardar?")) return;
    p.onClose();
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setTouched(true);
        if (!invalid) p.onSave(d);
      }
      if (e.key === "Escape" && !custom) close();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  /** Mover el inicio arrastra el fin (mantiene la duración) y re-ancla la repetición */
  const changeStart = (date: string, time: string) => {
    const dur = end.getTime() - start.getTime();
    const next: Draft = { ...d, startDate: date, startTime: time };
    const ns = draftTimes(next).start;
    const ne = d.allDay ? addDays(ns, Math.max(1, Math.round(dur / DAY)) - 1) : new Date(ns.getTime() + dur);
    next.endDate = toDateOnly(ne);
    if (!d.allDay) next.endTime = format(ne, "HH:mm");
    if (presetId !== "current" && d.rrule) next.rrule = presets(ns).find((x) => x.id === presetId)?.rrule ?? d.rrule;
    setD(next);
  };

  const save = () => {
    setTouched(true);
    if (!invalid) p.onSave(d);
  };

  return (
    <div className="editor" role="dialog" aria-modal="true" aria-label={p.heading}>
      <div className="editor-top">
        <button className="icon-btn" onClick={close} aria-label="Cerrar">
          <Icon name="close" />
        </button>
        <input
          className="field"
          style={{ fontSize: 22, flex: 1, fontFamily: "var(--font-display)" }}
          placeholder="Agregá un título"
          value={d.title}
          autoFocus
          onChange={(e) => set("title", e.target.value)}
          aria-label="Título"
        />
        {p.onDelete && (
          <button className="btn danger hide-sm" onClick={p.onDelete}>
            Borrar
          </button>
        )}
        <button className="btn primary" onClick={save}>
          Guardar
        </button>
      </div>

      <div className="editor-body">
        <div className="grid2">
          <div>
            <label className="label" htmlFor="sd">
              Empieza
            </label>
            <div className="row">
              <input id="sd" className="input" type="date" value={d.startDate} onChange={(e) => e.target.value && changeStart(e.target.value, d.startTime)} />
              {!d.allDay && (
                <input className="input" type="time" step={900} value={d.startTime} onChange={(e) => e.target.value && changeStart(d.startDate, e.target.value)} aria-label="Hora de inicio" />
              )}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ed">
              Termina
            </label>
            <div className="row">
              <input id="ed" className="input" type="date" value={d.endDate} onChange={(e) => e.target.value && set("endDate", e.target.value)} />
              {!d.allDay && (
                <input className="input" type="time" step={900} value={d.endTime} onChange={(e) => e.target.value && set("endTime", e.target.value)} aria-label="Hora de fin" />
              )}
            </div>
          </div>
        </div>
        {touched && invalid && <div className="err" role="alert">El fin tiene que ser después del inicio. Cambiá la fecha u hora de fin.</div>}

        <div className="row" style={{ gap: 20 }}>
          <label className="radio">
            <input
              type="checkbox"
              checked={d.allDay}
              onChange={(e) => {
                const allDay = e.target.checked;
                setD((x) => ({
                  ...x,
                  allDay,
                  endDate: allDay ? x.endDate : x.startDate,
                  endTime: allDay ? x.endTime : format(new Date(draftTimes({ ...x, allDay: false }).start.getTime() + 60 * MIN), "HH:mm"),
                }));
              }}
            />
            Todo el día
          </label>
          <select
            className="btn"
            value={presetId}
            onChange={(e) => {
              if (e.target.value === "custom") return setCustom(true);
              if (e.target.value === "current") return;
              set("rrule", presetList.find((x) => x.id === e.target.value)?.rrule ?? null);
            }}
            aria-label="Repetición"
          >
            {presetList.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
            {presetId === "current" && <option value="current">{describeRule(d.rrule, start)}</option>}
            <option value="custom">Personalizada…</option>
          </select>
        </div>

        <div className="grid2">
          <div>
            <label className="label" htmlFor="loc">
              Ubicación
            </label>
            <input id="loc" className="input" style={{ width: "100%" }} value={d.location} onChange={(e) => set("location", e.target.value)} placeholder="Agregá una ubicación" />
          </div>
          <div>
            <label className="label" htmlFor="cal">
              Calendario
            </label>
            <select id="cal" className="input" style={{ width: "100%" }} value={d.calendarId} onChange={(e) => set("calendarId", e.target.value)}>
              {p.calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid2">
          <div>
            <label className="label" htmlFor="rem">
              Recordatorio
            </label>
            <select
              id="rem"
              className="input"
              style={{ width: "100%" }}
              value={d.reminderMin === null ? "none" : String(d.reminderMin)}
              onChange={(e) => set("reminderMin", e.target.value === "none" ? null : Number(e.target.value))}
            >
              {REMINDERS.map(([v, l]) => (
                <option key={l} value={v === null ? "none" : String(v)}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="busy">
              Mostrarme como
            </label>
            <select id="busy" className="input" style={{ width: "100%" }} value={d.busy ? "busy" : "free"} onChange={(e) => set("busy", e.target.value === "busy")}>
              <option value="busy">Ocupado</option>
              <option value="free">Disponible</option>
            </select>
          </div>
        </div>

        <div>
          <span className="label">Color</span>
          <div className="colors" role="radiogroup" aria-label="Color del evento">
            <button
              role="radio"
              aria-checked={d.color === null}
              className={`color-dot${d.color === null ? " on" : ""}`}
              style={{ ["--ev" as string]: p.calendars.find((c) => c.id === d.calendarId)?.color }}
              onClick={() => set("color", null)}
              aria-label="Color del calendario"
              title="Color del calendario"
            />
            {PALETTE.map((c) => (
              <button
                key={c.value}
                role="radio"
                aria-checked={d.color === c.value}
                className={`color-dot${d.color === c.value ? " on" : ""}`}
                style={{ ["--ev" as string]: c.value }}
                onClick={() => set("color", c.value)}
                aria-label={c.name}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="desc">
            Descripción
          </label>
          <textarea id="desc" className="input" style={{ width: "100%" }} rows={5} value={d.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        {p.onDelete && (
          <button className="btn danger" style={{ justifySelf: "start" }} onClick={p.onDelete}>
            Borrar evento
          </button>
        )}
      </div>

      {custom && (
        <CustomRecurrence
          start={start}
          initial={customFromRule(d.rrule, start)}
          onCancel={() => setCustom(false)}
          onDone={(r) => {
            set("rrule", r);
            setCustom(false);
          }}
        />
      )}
    </div>
  );
}

const DOW = ["D", "L", "M", "X", "J", "V", "S"];
const DOW_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function CustomRecurrence(p: { start: Date; initial: CustomRule; onCancel: () => void; onDone: (rrule: string) => void }) {
  const [c, setC] = useState<CustomRule>(p.initial);
  const order = [1, 2, 3, 4, 5, 6, 0];
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && p.onCancel();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  const units = { DAILY: ["día", "días"], WEEKLY: ["semana", "semanas"], MONTHLY: ["mes", "meses"], YEARLY: ["año", "años"] } as const;
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && p.onCancel()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Repetición personalizada">
        <h2>Repetición personalizada</h2>
        <div className="row">
          <span>Repetir cada</span>
          <input
            className="input"
            type="number"
            min={1}
            max={99}
            style={{ width: 64 }}
            value={c.interval}
            onChange={(e) => setC({ ...c, interval: Math.max(1, Number(e.target.value) || 1) })}
            aria-label="Intervalo"
          />
          <select className="input" value={c.freq} onChange={(e) => setC({ ...c, freq: e.target.value as CustomRule["freq"] })} aria-label="Unidad">
            {(Object.keys(units) as (keyof typeof units)[]).map((k) => (
              <option key={k} value={k}>
                {units[k][c.interval > 1 ? 1 : 0]}
              </option>
            ))}
          </select>
        </div>

        {c.freq === "WEEKLY" && (
          <div style={{ marginTop: 16 }}>
            <div className="label" style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 700, marginBottom: 6 }}>
              Se repite el
            </div>
            <div className="row" role="group" aria-label="Días de la semana">
              {order.map((day) => {
                const on = c.weekdays.includes(day);
                return (
                  <button
                    key={day}
                    className={`mini-day${on ? " today" : ""}`}
                    style={{ border: "1px solid var(--line)", width: 34, height: 34 }}
                    aria-pressed={on}
                    aria-label={DOW_NAMES[day]}
                    onClick={() => setC({ ...c, weekdays: on ? c.weekdays.filter((x) => x !== day) : [...c.weekdays, day] })}
                  >
                    {DOW[day]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {c.freq === "MONTHLY" && (
          <div style={{ marginTop: 16 }}>
            <select className="input" value={c.monthMode} onChange={(e) => setC({ ...c, monthMode: e.target.value as "day" | "nth" })} aria-label="Modo mensual">
              <option value="day">El día {p.start.getDate()} de cada mes</option>
              <option value="nth">{presets(p.start).find((x) => x.id === "monthlyNth")!.label.replace("Todos los meses el", "El")}</option>
            </select>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 700 }}>Termina</div>
          <label className="radio">
            <input type="radio" name="end" checked={c.end === "never"} onChange={() => setC({ ...c, end: "never" })} /> Nunca
          </label>
          <label className="radio">
            <input type="radio" name="end" checked={c.end === "until"} onChange={() => setC({ ...c, end: "until" })} /> El
            <input className="input" type="date" value={c.until} disabled={c.end !== "until"} onChange={(e) => setC({ ...c, until: e.target.value })} aria-label="Fecha de fin" />
          </label>
          <label className="radio">
            <input type="radio" name="end" checked={c.end === "count"} onChange={() => setC({ ...c, end: "count" })} /> Después de
            <input
              className="input"
              type="number"
              min={1}
              max={730}
              style={{ width: 72 }}
              value={c.count}
              disabled={c.end !== "count"}
              onChange={(e) => setC({ ...c, count: Number(e.target.value) || 1 })}
              aria-label="Cantidad de veces"
            />
            veces
          </label>
        </div>
        <p style={{ color: "var(--ink-2)", marginBottom: 0 }}>{describeRule(ruleFromCustom(c, p.start), p.start)}</p>
        <div className="foot">
          <button className="btn ghost" onClick={p.onCancel}>
            Cancelar
          </button>
          <button className="btn primary" onClick={() => p.onDone(ruleFromCustom(c, p.start))}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}


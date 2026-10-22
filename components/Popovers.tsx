"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cap, fmt, sameDay, timeLabel } from "@/lib/dates";
import { PALETTE } from "@/lib/seed";
import type { Calendar, Occurrence } from "@/lib/types";
import { Icon } from "./Icon";

type Point = { x: number; y: number };

function usePlacement(at: Point) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = at.x + 12;
    if (left + w > vw - 8) left = at.x - w - 12;
    left = Math.max(8, Math.min(left, vw - w - 8));
    const top = Math.max(8, Math.min(at.y - 40, vh - h - 8));
    setPos({ left, top });
  }, [at.x, at.y]);
  return { ref, pos };
}

export function whenText(o: { start: Date; end: Date; allDay: boolean }): string {
  if (o.allDay) {
    const last = new Date(o.end.getTime() - 1);
    if (sameDay(o.start, last)) return cap(fmt(o.start, "EEEE d 'de' MMMM"));
    return `${cap(fmt(o.start, "d 'de' MMMM"))} – ${fmt(last, "d 'de' MMMM")}`;
  }
  if (sameDay(o.start, o.end) || (o.end.getTime() - o.start.getTime() < 86400000 && o.end.getHours() === 0 && o.end.getMinutes() === 0))
    return `${cap(fmt(o.start, "EEEE d 'de' MMMM"))}, ${timeLabel(o.start)} – ${timeLabel(o.end)}`;
  return `${cap(fmt(o.start, "d 'de' MMMM, H:mm"))} – ${fmt(o.end, "d 'de' MMMM, H:mm")}`;
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}

export function QuickCreate(p: {
  at: Point;
  start: Date;
  end: Date;
  allDay: boolean;
  calendars: Calendar[];
  calendarId: string;
  onSave: (title: string, calendarId: string) => void;
  onMore: (title: string, calendarId: string) => void;
  onClose: () => void;
}) {
  const { ref, pos } = usePlacement(p.at);
  const [title, setTitle] = useState("");
  const [cal, setCal] = useState(p.calendarId);
  useEscape(p.onClose);
  return (
    <>
      <div className="backdrop" onPointerDown={p.onClose} />
      <div className="popover" ref={ref} style={pos} role="dialog" aria-label="Nuevo evento">
        <div className="pop-actions">
          <button className="icon-btn" onClick={p.onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            p.onSave(title, cal);
          }}
        >
          <input className="field" autoFocus placeholder="Agregá un título" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título" />
          <div className="pop-row" style={{ marginTop: 8 }}>
            <Icon name="clock" />
            <span>{whenText(p)}</span>
          </div>
          <div className="pop-row">
            <Icon name="calendar" />
            <select className="input" value={cal} onChange={(e) => setCal(e.target.value)} aria-label="Calendario">
              {p.calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
            <button type="button" className="btn ghost" onClick={() => p.onMore(title, cal)}>
              Más opciones
            </button>
            <button type="submit" className="btn primary">
              Guardar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export function EventDetail(p: {
  at: Point;
  occ: Occurrence;
  ruleText: string | null;
  calendar?: Calendar;
  color: string;
  onEdit: () => void;
  onDelete: () => void;
  onColor: (c: string | null) => void;
  onClose: () => void;
}) {
  const { ref, pos } = usePlacement(p.at);
  useEscape(p.onClose);
  const o = p.occ;
  return (
    <>
      <div className="backdrop" onPointerDown={p.onClose} />
      <div className="popover" ref={ref} style={pos} role="dialog" aria-label={o.title || "Evento"}>
        <div className="pop-actions">
          <button className="icon-btn" onClick={p.onEdit} aria-label="Editar evento" title="Editar (e)">
            <Icon name="edit" />
          </button>
          <button className="icon-btn" onClick={p.onDelete} aria-label="Borrar evento" title="Borrar (Supr)">
            <Icon name="trash" />
          </button>
          <button className="icon-btn" onClick={p.onClose} aria-label="Cerrar">
            <Icon name="close" />
          </button>
        </div>
        <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", gap: 12 }}>
          <span className="swatch" style={{ ["--ev" as string]: p.color, marginTop: 8 }} />
          <div style={{ minWidth: 0 }}>
            <h2 className="pop-title">{o.title || "(Sin título)"}</h2>
            <div style={{ color: "var(--ink-2)" }}>{whenText(o)}</div>
            {p.ruleText && <div style={{ color: "var(--ink-2)" }}>{p.ruleText}</div>}
          </div>
        </div>
        {o.location && (
          <div className="pop-row">
            <Icon name="pin" />
            <span>{o.location}</span>
          </div>
        )}
        {o.description && (
          <div className="pop-row">
            <Icon name="text" />
            <span style={{ whiteSpace: "pre-wrap" }}>{o.description}</span>
          </div>
        )}
        <div className="pop-row">
          <Icon name="calendar" />
          <span>{p.calendar?.name}</span>
        </div>
        <div className="colors" style={{ marginTop: 8, paddingLeft: 30 }} role="radiogroup" aria-label="Color del evento">
          {PALETTE.map((c) => (
            <button
              key={c.value}
              role="radio"
              aria-checked={p.color === c.value}
              aria-label={c.name}
              title={c.name}
              className={`color-dot${p.color === c.value ? " on" : ""}`}
              style={{ ["--ev" as string]: c.value }}
              onClick={() => p.onColor(c.value)}
            />
          ))}
        </div>
      </div>
    </>
  );
}


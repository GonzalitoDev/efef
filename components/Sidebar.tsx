"use client";

import { useState } from "react";
import { addDays, addMonths, startOfMonth, startOfWeek } from "date-fns";
import { cap, fmt, sameDay } from "@/lib/dates";
import type { Calendar, Settings } from "@/lib/types";
import { Icon } from "./Icon";

export function Sidebar(p: {
  anchor: Date;
  now: Date;
  settings: Settings;
  calendars: Calendar[];
  onCreate: () => void;
  onPick: (d: Date) => void;
  onToggle: (id: string) => void;
  onAddCalendar: () => void;
  onEditCalendar: (c: Calendar) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(p.anchor));
  const [lastAnchor, setLastAnchor] = useState(p.anchor);
  if (lastAnchor !== p.anchor) {
    setLastAnchor(p.anchor);
    setMonth(startOfMonth(p.anchor));
  }
  const first = startOfWeek(month, { weekStartsOn: p.settings.weekStart });
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));

  return (
    <aside className="sidebar" aria-label="Navegación">
      <button className="create-btn" onClick={p.onCreate}>
        <Icon name="plus" /> Crear
      </button>

      <div className="mini">
        <div className="mini-head">
          <span>{cap(fmt(month, "MMMM yyyy"))}</span>
          <span>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mes anterior">
              <Icon name="left" />
            </button>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente">
              <Icon name="right" />
            </button>
          </span>
        </div>
        <div className="mini-grid">
          {cells.slice(0, 7).map((d) => (
            <div key={`h${d.getDay()}`} className="dow">
              {fmt(d, "EEEEE").toUpperCase()}
            </div>
          ))}
          {cells.map((d) => (
            <button
              key={d.getTime()}
              className={`mini-day${d.getMonth() !== month.getMonth() ? " out" : ""}${sameDay(d, p.now) ? " today" : sameDay(d, p.anchor) ? " sel" : ""}`}
              onClick={() => p.onPick(d)}
              aria-label={fmt(d, "EEEE d 'de' MMMM 'de' yyyy")}
            >
              {d.getDate()}
            </button>
          ))}
        </div>
      </div>

      <div className="side-h">
        <span>Mis calendarios</span>
        <button className="icon-btn" onClick={p.onAddCalendar} aria-label="Agregar calendario">
          <Icon name="plus" />
        </button>
      </div>
      {p.calendars.map((c) => (
        <div key={c.id} className="cal-item" style={{ ["--c" as string]: c.color }}>
          <input id={`cal-${c.id}`} type="checkbox" checked={c.visible} onChange={() => p.onToggle(c.id)} />
          <label htmlFor={`cal-${c.id}`}>{c.name}</label>
          <button className="icon-btn" onClick={() => p.onEditCalendar(c)} aria-label={`Editar ${c.name}`} style={{ width: 28, height: 28 }}>
            <Icon name="edit" />
          </button>
        </div>
      ))}
    </aside>
  );
}

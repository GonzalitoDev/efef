"use client";

import { startOfDay } from "date-fns";
import { fmt, sameDay, timeLabel } from "@/lib/dates";
import type { Occurrence } from "@/lib/types";

type Point = { x: number; y: number };

/** Lista agrupada por día: vista agenda y resultados de búsqueda */
export function ListView(p: {
  occs: Occurrence[];
  now: Date;
  colorOf: (o: Occurrence) => string;
  onOpen: (o: Occurrence, at: Point) => void;
  empty: { title: string; text: string };
}) {
  if (!p.occs.length) {
    return (
      <div className="list">
        <div className="empty">
          <h2>{p.empty.title}</h2>
          <p>{p.empty.text}</p>
        </div>
      </div>
    );
  }
  const groups = new Map<number, Occurrence[]>();
  for (const o of p.occs) {
    const k = startOfDay(o.start).getTime();
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  return (
    <div className="list">
      {[...groups.entries()].map(([k, items]) => {
        const d = new Date(k);
        return (
          <div key={k} className="list-day">
            <div className={`list-date${sameDay(d, p.now) ? " today" : ""}`}>
              <b>{d.getDate()}</b>
              <span>{fmt(d, "MMM yyyy, EEE").replace(/\./g, "")}</span>
            </div>
            <div>
              {items.map((o) => (
                <button
                  key={o.key}
                  className="list-row"
                  style={{ ["--ev" as string]: p.colorOf(o) }}
                  onClick={(e) => p.onOpen(o, { x: e.clientX, y: e.clientY })}
                >
                  <span className="dot" />
                  <span className="tm">{o.allDay ? "Todo el día" : `${timeLabel(o.start)} – ${timeLabel(o.end)}`}</span>
                  <span>
                    <b>{o.title || "(Sin título)"}</b>
                    {o.location && <span className="tm">, {o.location}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

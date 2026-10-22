"use client";

import { addDays } from "date-fns";
import { fmt, sameDay, timeLabel } from "@/lib/dates";
import type { Occurrence } from "@/lib/types";

type Point = { x: number; y: number };

export function MonthView(p: {
  weeks: Date[][];
  anchor: Date;
  occs: Occurrence[];
  now: Date;
  colorOf: (o: Occurrence) => string;
  onOpen: (o: Occurrence, at: Point) => void;
  onCreateAllDay: (d: Date, at: Point) => void;
  onPickDay: (d: Date) => void;
}) {
  const cols = p.weeks[0]?.length ?? 7;
  const maxChips = p.weeks.length > 5 ? 2 : 3;
  return (
    <div className="month">
      <div className="month-dows" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {p.weeks[0]?.map((d) => (
          <div key={d.getDay()}>{fmt(d, "EEE").replace(".", "")}</div>
        ))}
      </div>
      <div className="month-grid" style={{ gridTemplateRows: `repeat(${p.weeks.length}, minmax(0, 1fr))` }}>
        {p.weeks.map((week) => (
          <div key={week[0].getTime()} className="month-week" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {week.map((d) => {
              const next = addDays(d, 1);
              const items = p.occs
                .filter((o) => o.start < next && (o.end > d || (o.end.getTime() === o.start.getTime() && sameDay(o.start, d))))
                .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
              const shown = items.slice(0, items.length > maxChips + 1 ? maxChips : maxChips + 1);
              const hidden = items.length - shown.length;
              const out = d.getMonth() !== p.anchor.getMonth();
              return (
                <div
                  key={d.getTime()}
                  className={`month-cell${out ? " out" : ""}${sameDay(d, p.now) ? " today" : ""}`}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) p.onCreateAllDay(d, { x: e.clientX, y: e.clientY });
                  }}
                >
                  <button className="month-num" onClick={() => p.onPickDay(d)} aria-label={`Ver el ${fmt(d, "EEEE d 'de' MMMM")}`}>
                    {d.getDate() === 1 ? fmt(d, "d MMM").replace(".", "") : d.getDate()}
                  </button>
                  {shown.map((o) => {
                    const block = o.allDay || o.end.getTime() - o.start.getTime() >= 86400000;
                    return (
                      <button
                        key={o.key}
                        className={`chip${block ? " allday" : ""}`}
                        style={{ ["--ev" as string]: p.colorOf(o) }}
                        onClick={(e) => p.onOpen(o, { x: e.clientX, y: e.clientY })}
                      >
                        {!block && <span className="dot" />}
                        {!o.allDay && <span className="tm">{timeLabel(o.start)}</span>}
                        <span className="tx">{o.title || "(Sin título)"}</span>
                      </button>
                    );
                  })}
                  {hidden > 0 && (
                    <button className="more" onClick={() => p.onPickDay(d)}>
                      {hidden} más
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

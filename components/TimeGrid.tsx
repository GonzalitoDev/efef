"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DAY, MIN, fmt, sameDay, timeLabel } from "@/lib/dates";
import { layoutAllDay, layoutDay } from "@/lib/layout";
import type { Occurrence } from "@/lib/types";

const HOUR_PX = 48;
const PX_PER_MIN = HOUR_PX / 60;
const STEP = 15;

type Point = { x: number; y: number };

type Drag =
  | { type: "create"; dayIdx: number; startMin: number; curMin: number; moved: boolean; x0: number; y0: number }
  | { type: "move"; occ: Occurrence; dayIdx: number; offsetMin: number; curMin: number; moved: boolean; x0: number; y0: number }
  | { type: "resize"; occ: Occurrence; curEnd: Date; moved: boolean; x0: number; y0: number };

type Props = {
  days: Date[];
  occs: Occurrence[];
  now: Date;
  colorOf: (o: Occurrence) => string;
  draft: { start: Date; end: Date } | null;
  defaultDurationMin: number;
  onCreate: (start: Date, end: Date, at: Point) => void;
  onCreateAllDay: (day: Date, at: Point) => void;
  onOpen: (o: Occurrence, at: Point) => void;
  onChange: (o: Occurrence, start: Date, end: Date) => void;
  onPickDay: (d: Date) => void;
};

const isAllDayRow = (o: Occurrence) => o.allDay || o.end.getTime() - o.start.getTime() >= DAY;
const snapMin = (m: number) => Math.round(m / STEP) * STEP;
const atMin = (day: Date, m: number) => {
  const d = new Date(day);
  d.setHours(0, m, 0, 0);
  return d;
};
const minutesOf = (day: Date, d: Date) => (d.getTime() - day.getTime()) / MIN + (d.getTimezoneOffset() - day.getTimezoneOffset());

export function TimeGrid(p: Props) {
  const { days, occs, now } = p;
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [sbw, setSbw] = useState(0);
  const cols = `var(--gutter, 64px) repeat(${days.length}, minmax(0, 1fr))`;

  const allDay = useMemo(() => layoutAllDay(occs.filter(isAllDayRow), days), [occs, days]);
  const timed = useMemo(() => occs.filter((o) => !isAllDayRow(o)), [occs]);
  const placed = useMemo(() => days.map((d) => layoutDay(timed, d, 18)), [timed, days]);

  // al entrar, scroll a una hora útil
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const h = days.some((d) => sameDay(d, now)) ? Math.max(0, now.getHours() - 2) : 7;
    el.scrollTop = h * HOUR_PX;
    setSbw(el.offsetWidth - el.clientWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length, days[0]?.getTime()]);

  const pointerToCell = (x: number, y: number) => {
    const body = bodyRef.current!.getBoundingClientRect();
    const minute = Math.min(24 * 60, Math.max(0, (y - body.top) / PX_PER_MIN));
    let idx = colRefs.current.findIndex((c) => {
      if (!c) return false;
      const r = c.getBoundingClientRect();
      return x >= r.left && x < r.right;
    });
    if (idx < 0) idx = x < (colRefs.current[0]?.getBoundingClientRect().left ?? 0) ? 0 : days.length - 1;
    return { idx, minute };
  };

  const begin = (d: Drag, e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = d;
    setDrag(d);
    const move = (ev: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      const moved = cur.moved || Math.abs(ev.clientX - cur.x0) > 4 || Math.abs(ev.clientY - cur.y0) > 4;
      const { idx, minute } = pointerToCell(ev.clientX, ev.clientY);
      let next: Drag;
      if (cur.type === "create") next = { ...cur, moved, curMin: minute };
      else if (cur.type === "move") next = { ...cur, moved, dayIdx: idx, curMin: minute };
      else {
        const day = days[pointerToCell(ev.clientX, ev.clientY).idx];
        let end = atMin(day, snapMin(minute));
        const minEnd = new Date(cur.occ.start.getTime() + STEP * MIN);
        if (end < minEnd) end = minEnd;
        next = { ...cur, moved, curEnd: end };
      }
      dragRef.current = next;
      setDrag(next);
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", esc);
      const cur = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!cur) return;
      const at = { x: ev.clientX, y: ev.clientY };
      if (cur.type === "create") {
        const day = days[cur.dayIdx];
        if (!cur.moved) {
          const s = atMin(day, Math.floor(cur.startMin / 30) * 30);
          p.onCreate(s, new Date(s.getTime() + p.defaultDurationMin * MIN), at);
        } else {
          const a = snapMin(Math.min(cur.startMin, cur.curMin));
          const b = Math.max(a + STEP, snapMin(Math.max(cur.startMin, cur.curMin)));
          p.onCreate(atMin(day, a), atMin(day, b), at);
        }
      } else if (cur.type === "move") {
        if (!cur.moved) return p.onOpen(cur.occ, at);
        const { start, end } = moveTarget(cur);
        if (start.getTime() !== cur.occ.start.getTime()) p.onChange(cur.occ, start, end);
      } else if (cur.moved && cur.curEnd.getTime() !== cur.occ.end.getTime()) {
        p.onChange(cur.occ, cur.occ.start, cur.curEnd);
      }
    };
    const esc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        dragRef.current = null;
        setDrag(null);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("keydown", esc);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", esc);
  };

  const moveTarget = (d: Extract<Drag, { type: "move" }>) => {
    const dur = d.occ.end.getTime() - d.occ.start.getTime();
    const start = atMin(days[d.dayIdx], snapMin(d.curMin - d.offsetMin));
    return { start, end: new Date(start.getTime() + dur) };
  };

  const onColDown = (e: React.PointerEvent, idx: number) => {
    if (e.button !== 0 || e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains("tg-line")) return;
    const { minute } = pointerToCell(e.clientX, e.clientY);
    begin({ type: "create", dayIdx: idx, startMin: minute, curMin: minute, moved: false, x0: e.clientX, y0: e.clientY }, e);
  };

  const onEvDown = (e: React.PointerEvent, occ: Occurrence, idx: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const { minute } = pointerToCell(e.clientX, e.clientY);
    const offsetMin = minute - minutesOf(days[idx], occ.start);
    begin({ type: "move", occ, dayIdx: idx, offsetMin, curMin: minute, moved: false, x0: e.clientX, y0: e.clientY }, e);
  };

  const onResizeDown = (e: React.PointerEvent, occ: Occurrence) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    begin({ type: "resize", occ, curEnd: occ.end, moved: false, x0: e.clientX, y0: e.clientY }, e);
  };

  // bloque fantasma mientras se arrastra / estira / crea
  let ghost: { idx: number; start: Date; end: Date; occ?: Occurrence } | null = null;
  if (drag?.moved && drag.type === "move") ghost = { idx: drag.dayIdx, ...moveTarget(drag), occ: drag.occ };
  if (drag?.moved && drag.type === "resize") {
    const idx = days.findIndex((d) => sameDay(d, drag.occ.start));
    if (idx >= 0) ghost = { idx, start: drag.occ.start, end: drag.curEnd, occ: drag.occ };
  }
  let draftBlock: { idx: number; start: Date; end: Date } | null = null;
  if (drag?.type === "create" && drag.moved) {
    const a = snapMin(Math.min(drag.startMin, drag.curMin));
    const b = Math.max(a + STEP, snapMin(Math.max(drag.startMin, drag.curMin)));
    draftBlock = { idx: drag.dayIdx, start: atMin(days[drag.dayIdx], a), end: atMin(days[drag.dayIdx], b) };
  } else if (p.draft) {
    const idx = days.findIndex((d) => sameDay(d, p.draft!.start));
    if (idx >= 0) draftBlock = { idx, ...p.draft };
  }

  const nowIdx = days.findIndex((d) => sameDay(d, now));
  const nowTop = nowIdx >= 0 ? minutesOf(days[nowIdx], now) * PX_PER_MIN : 0;
  const allDayH = Math.max(28, allDay.rows * 25 + 6);

  return (
    <div className="tg" style={{ ["--sbw" as string]: `${sbw}px` }}>
      <div className="tg-head" style={{ gridTemplateColumns: cols }}>
        <div className="tg-gutter" />
        {days.map((d) => (
          <div key={d.getTime()} className={`tg-dayhead${sameDay(d, now) ? " today" : ""}`}>
            <div className="tg-dow">{fmt(d, "EEE").replace(".", "")}</div>
            <button className="tg-num" onClick={() => p.onPickDay(d)} aria-label={`Ver el ${fmt(d, "EEEE d 'de' MMMM")}`}>
              {d.getDate()}
            </button>
          </div>
        ))}
      </div>

      <div className="tg-allday" style={{ gridTemplateColumns: `var(--gutter, 64px) 1fr` }}>
        <div className="tg-allday-label">todo el día</div>
        <div className="tg-allday-cells" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, height: allDayH }}>
          {days.map((d) => (
            <div
              key={d.getTime()}
              className="tg-allday-cell"
              onClick={(e) => p.onCreateAllDay(d, { x: e.clientX, y: e.clientY })}
              aria-label={`Crear evento de todo el día el ${fmt(d, "d 'de' MMMM")}`}
            />
          ))}
          {allDay.bars.map((b) => (
            <button
              key={b.occ.key}
              className={`bar${b.continuesBefore ? " cut-l" : ""}${b.continuesAfter ? " cut-r" : ""}`}
              style={{
                ["--ev" as string]: p.colorOf(b.occ),
                left: `calc(${(b.startCol / days.length) * 100}% + 2px)`,
                width: `calc(${(b.span / days.length) * 100}% - 4px)`,
                top: 3 + b.row * 25,
              }}
              onClick={(e) => p.onOpen(b.occ, { x: e.clientX, y: e.clientY })}
            >
              {!b.occ.allDay && `${timeLabel(b.occ.start)} `}
              {b.occ.title || "(Sin título)"}
            </button>
          ))}
        </div>
      </div>

      <div className="tg-scroll" ref={scrollRef}>
        <div className="tg-body" ref={bodyRef} style={{ gridTemplateColumns: cols }}>
          <div className="tg-hours">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="tg-hour-label">
                {h > 0 && <span>{h}:00</span>}
              </div>
            ))}
          </div>
          {days.map((d, idx) => (
            <div
              key={d.getTime()}
              ref={(el) => {
                colRefs.current[idx] = el;
              }}
              className={`tg-col${sameDay(d, now) ? " today" : ""}`}
              onPointerDown={(e) => onColDown(e, idx)}
              aria-label={fmt(d, "EEEE d 'de' MMMM")}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="tg-line" />
              ))}
              {placed[idx].map((pl) => {
                const short = pl.height < 40;
                const past = pl.occ.end < now;
                const dragging = drag?.moved && (drag.type === "move" || drag.type === "resize") && drag.occ.key === pl.occ.key;
                return (
                  <div
                    key={pl.occ.key}
                    role="button"
                    tabIndex={0}
                    className={`ev${short ? " short" : ""}${past ? " past" : ""}${dragging ? " dragging" : ""}`}
                    style={{
                      ["--ev" as string]: p.colorOf(pl.occ),
                      top: pl.top * PX_PER_MIN + 1,
                      height: pl.height * PX_PER_MIN - 2,
                      left: `calc(${pl.left * 100}% + 2px)`,
                      width: `calc(${pl.width * 100}% - 6px)`,
                    }}
                    onPointerDown={(e) => onEvDown(e, pl.occ, idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        p.onOpen(pl.occ, { x: r.right, y: r.top });
                      }
                    }}
                    aria-label={`${pl.occ.title || "(Sin título)"}, ${timeLabel(pl.occ.start)} a ${timeLabel(pl.occ.end)}`}
                  >
                    <div className="t">{pl.occ.title || "(Sin título)"}</div>
                    <div className="s">
                      {timeLabel(pl.occ.start)} – {timeLabel(pl.occ.end)}
                      {pl.occ.location && !short ? `, ${pl.occ.location}` : ""}
                    </div>
                    {sameDay(new Date(pl.occ.end.getTime() - 1), d) && (
                      <div className="resize" onPointerDown={(e) => onResizeDown(e, pl.occ)} aria-hidden="true" />
                    )}
                  </div>
                );
              })}
              {ghost && ghost.idx === idx && (
                <div
                  className="ev ghost"
                  style={{
                    ["--ev" as string]: ghost.occ ? p.colorOf(ghost.occ) : "var(--accent)",
                    top: minutesOf(d, ghost.start) * PX_PER_MIN + 1,
                    height: Math.max(18, (ghost.end.getTime() - ghost.start.getTime()) / MIN) * PX_PER_MIN - 2,
                    left: 2,
                    right: 4,
                  }}
                >
                  <div className="t">{ghost.occ?.title || "(Sin título)"}</div>
                  <div className="s">
                    {timeLabel(ghost.start)} – {timeLabel(ghost.end)}
                  </div>
                </div>
              )}
              {draftBlock && draftBlock.idx === idx && (
                <div
                  className="ev draft"
                  style={{
                    top: minutesOf(d, draftBlock.start) * PX_PER_MIN + 1,
                    height: Math.max(18, (draftBlock.end.getTime() - draftBlock.start.getTime()) / MIN) * PX_PER_MIN - 2,
                    left: 2,
                    right: 4,
                  }}
                >
                  <div className="t">(Sin título)</div>
                  <div className="s">
                    {timeLabel(draftBlock.start)} – {timeLabel(draftBlock.end)}
                  </div>
                </div>
              )}
              {idx === nowIdx && <div className="now-line" style={{ top: nowTop }} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


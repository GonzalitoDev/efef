import type { Occurrence } from "./types";

export type Placed = { occ: Occurrence; top: number; height: number; left: number; width: number };

/**
 * Ubica los eventos con hora de un día en columnas cuando se superponen.
 * top/height en minutos desde el inicio del día; left/width como fracción (0..1).
 */
export function layoutDay(occs: Occurrence[], dayStart: Date, minHeight = 20): Placed[] {
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const items = occs
    .filter((o) => !o.allDay && o.start < dayEnd && o.end > dayStart)
    .map((o) => {
      const s = Math.max(0, (o.start.getTime() - dayStart.getTime()) / 60000);
      const e = Math.min((dayEnd.getTime() - dayStart.getTime()) / 60000, (o.end.getTime() - dayStart.getTime()) / 60000);
      return { occ: o, s, e: Math.max(e, s + minHeight) };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const out: Placed[] = [];
  let cluster: { occ: Occurrence; s: number; e: number; col: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = Math.max(0, ...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) {
      // se estira a la derecha mientras las columnas siguientes estén libres
      let span = 1;
      for (let k = c.col + 1; k < cols; k++) {
        if (cluster.some((o) => o.col === k && o.s < c.e && o.e > c.s)) break;
        span++;
      }
      out.push({ occ: c.occ, top: c.s, height: c.e - c.s, left: c.col / cols, width: span / cols });
    }
    cluster = [];
  };

  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush();
    const colEnds: number[] = [];
    for (const c of cluster) colEnds[c.col] = Math.max(colEnds[c.col] ?? -1, c.e);
    let col = 0;
    while (colEnds[col] !== undefined && colEnds[col] > it.s) col++;
    cluster.push({ ...it, col });
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}

export type Bar = { occ: Occurrence; startCol: number; span: number; row: number; continuesBefore: boolean; continuesAfter: boolean };

/** Barras de eventos de todo el día / multi-día sobre una fila de días */
export function layoutAllDay(occs: Occurrence[], days: Date[]): { bars: Bar[]; rows: number } {
  if (!days.length) return { bars: [], rows: 0 };
  const first = days[0];
  const lastEnd = new Date(days[days.length - 1]);
  lastEnd.setDate(lastEnd.getDate() + 1);
  const idx = (d: Date) => days.findIndex((x) => x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate());

  const items = occs
    .filter((o) => o.start < lastEnd && o.end > first)
    .map((o) => {
      let s = idx(o.start);
      const continuesBefore = o.start < first;
      if (s < 0) s = continuesBefore ? 0 : days.findIndex((d) => d > o.start);
      const lastDay = new Date(o.end.getTime() - 1);
      let e = idx(lastDay);
      const continuesAfter = o.end > lastEnd;
      if (e < 0) e = continuesAfter ? days.length - 1 : findLastBefore(days, lastDay);
      return { occ: o, s, e, continuesBefore, continuesAfter };
    })
    .filter((x) => x.s >= 0 && x.e >= x.s)
    .sort((a, b) => a.s - b.s || b.e - b.s - (a.e - a.s));

  const rowEnds: number[] = [];
  const bars: Bar[] = [];
  for (const it of items) {
    let row = 0;
    while (rowEnds[row] !== undefined && rowEnds[row] >= it.s) row++;
    rowEnds[row] = it.e;
    bars.push({ occ: it.occ, startCol: it.s, span: it.e - it.s + 1, row, continuesBefore: it.continuesBefore, continuesAfter: it.continuesAfter });
  }
  return { bars, rows: rowEnds.length };
}

function findLastBefore(days: Date[], d: Date): number {
  let r = -1;
  days.forEach((x, i) => {
    if (x <= d) r = i;
  });
  return r;
}

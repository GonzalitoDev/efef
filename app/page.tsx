"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, startOfDay } from "date-fns";
import { MIN, gridDays, localTimezone, monthWeeks, parseDateOnly, step, toDateOnly, uid, viewRange, viewTitle } from "@/lib/dates";
import { deleteOccurrence, describeRule, expandAll, toStamp, updateOccurrence } from "@/lib/recurrence";
import { LocalStore } from "@/lib/store";
import { seedState } from "@/lib/seed";
import type { AgendaState, CalEvent, Calendar, EventPatch, Occurrence, Scope, ViewKind } from "@/lib/types";
import { TimeGrid } from "@/components/TimeGrid";
import { MonthView } from "@/components/MonthView";
import { ListView } from "@/components/ListView";
import { Sidebar } from "@/components/Sidebar";
import { EventDetail, QuickCreate } from "@/components/Popovers";
import { EventEditor, draftFrom, draftTimes, type Draft } from "@/components/EventEditor";
import { CalendarDialog, GoToDateDialog, ScopeDialog, SettingsDialog, ShortcutsDialog, Toast } from "@/components/Dialogs";
import { Icon } from "@/components/Icon";

type Point = { x: number; y: number };
type Popover =
  | { kind: "create"; start: Date; end: Date; allDay: boolean; at: Point }
  | { kind: "detail"; occ: Occurrence; at: Point };
type EditorState = { mode: "new" | "edit"; occ?: Occurrence; initial: Draft };
type PendingScope =
  | { action: "save"; occ: Occurrence; apply: (s: AgendaState, scope: Scope) => AgendaState; msg: string; allowThis: boolean }
  | { action: "delete"; occ: Occurrence };

const VIEW_LABEL: Record<ViewKind, string> = { day: "Día", week: "Semana", "4days": "4 días", month: "Mes", agenda: "Agenda" };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Page() {
  const store = useMemo(() => new LocalStore(), []);
  const [data, setData] = useState<AgendaState | null>(null);
  const history = useRef<AgendaState[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<ViewKind>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [sideOpen, setSideOpen] = useState(true);
  const [pop, setPop] = useState<Popover | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pending, setPending] = useState<PendingScope | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo: boolean; id: number } | null>(null);
  const [dialog, setDialog] = useState<null | "settings" | "shortcuts" | "goto" | { cal?: Calendar }>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifState, setNotifState] = useState("default");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setData(store.load());
    try {
      const v = window.localStorage.getItem("agenda:view") as ViewKind | null;
      if (v && v in VIEW_LABEL) setView(v);
      else if (window.innerWidth < 760) setView("4days");
    } catch {}
    if (window.innerWidth < 760) setSideOpen(false);
    setNotifState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [store]);

  const changeView = (v: ViewKind) => {
    setView(v);
    try {
      window.localStorage.setItem("agenda:view", v);
    } catch {}
  };

  const commit = useCallback(
    (next: AgendaState, msg: string) => {
      setData((prev) => {
        if (prev) history.current = [...history.current.slice(-29), prev];
        return next;
      });
      store.save(next);
      setToast({ msg, undo: true, id: Date.now() });
    },
    [store],
  );

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) return;
    setData(prev);
    store.save(prev);
    setPop(null);
    setToast({ msg: "Listo, se deshizo el cambio", undo: false, id: Date.now() });
  }, [store]);

  const occs = useMemo(() => {
    if (!data) return [];
    const [a, b] = viewRange(view, anchor, data.settings);
    return expandAll(data, a, b);
  }, [data, view, anchor]);

  const searchResults = useMemo(() => {
    if (!data || query.trim().length < 2) return [];
    const q = norm(query.trim());
    const a = addDays(now, -365);
    const b = addDays(now, 365);
    return expandAll(data, a, b)
      .filter((o) => norm(`${o.title} ${o.location} ${o.description}`).includes(q))
      .slice(0, 50);
  }, [data, query, now]);

  // recordatorios con notificaciones del navegador
  const lastCheck = useRef(Date.now());
  useEffect(() => {
    if (!data || notifState !== "granted") return;
    const from = lastCheck.current;
    const to = now.getTime();
    lastCheck.current = to;
    const soon = expandAll(data, new Date(from), addDays(now, 2));
    for (const o of soon) {
      const ev = data.events.find((e) => e.id === o.eventId);
      if (!ev || ev.reminderMin === null || o.allDay) continue;
      const fire = o.start.getTime() - ev.reminderMin * MIN;
      if (fire > from && fire <= to) {
        try {
          new Notification(o.title || "(Sin título)", { body: ev.reminderMin ? `Empieza en ${ev.reminderMin} min` : "Empieza ahora" });
        } catch {}
      }
    }
  }, [now, data, notifState]);

  const calendarOf = (o: Occurrence) => data?.calendars.find((c) => c.id === o.calendarId);
  const colorOf = useCallback(
    (o: Occurrence) => o.color ?? data?.calendars.find((c) => c.id === o.calendarId)?.color ?? "#62666d",
    [data],
  );
  const defaultCal = data?.calendars.find((c) => c.isDefault) ?? data?.calendars[0];

  /* ---------- acciones ---------- */

  const createEvent = (fields: Omit<CalEvent, "id" | "timezone">, msg = "Evento creado") => {
    if (!data) return;
    commit({ ...data, events: [...data.events, { ...fields, id: uid(), timezone: localTimezone() }] }, msg);
  };

  const askOrApply = (occ: Occurrence, apply: (s: AgendaState, scope: Scope) => AgendaState, msg: string, allowThis = true) => {
    if (!data) return;
    if (occ.recurring) setPending({ action: "save", occ, apply, msg, allowThis });
    else commit(apply(data, "all"), msg);
  };

  const onDragChange = (occ: Occurrence, start: Date, end: Date) => {
    const patch: EventPatch = { start: toStamp(start, false), end: toStamp(end, false) };
    askOrApply(occ, (s, scope) => updateOccurrence(s, occ, patch, scope), "Evento actualizado");
  };

  const requestDelete = (occ: Occurrence) => {
    if (!data) return;
    setPop(null);
    setEditor(null);
    if (occ.recurring) setPending({ action: "delete", occ });
    else commit(deleteOccurrence(data, occ, "all"), "Evento borrado");
  };

  const openNew = (start?: Date, end?: Date, allDay = false, title = "", calendarId?: string) => {
    if (!data) return;
    let s = start;
    if (!s) {
      s = new Date(anchor);
      const n = new Date();
      if (startOfDay(n).getTime() === anchor.getTime()) s.setHours(n.getHours() + 1, 0, 0, 0);
      else s.setHours(9, 0, 0, 0);
    }
    const e = end ?? (allDay ? addDays(s, 1) : new Date(s.getTime() + data.settings.defaultDurationMin * MIN));
    setPop(null);
    setEditor({
      mode: "new",
      initial: draftFrom({
        title, allDay, start: s, end: e, rrule: null, location: "", description: "",
        calendarId: calendarId ?? defaultCal!.id, color: null, busy: true, reminderMin: allDay ? null : 10,
      }),
    });
  };

  const openEdit = (occ: Occurrence) => {
    const ev = data?.events.find((e) => e.id === occ.eventId);
    if (!ev) return;
    setPop(null);
    setEditor({
      mode: "edit",
      occ,
      initial: draftFrom({ ...occ, rrule: ev.rrule, busy: ev.busy, reminderMin: ev.reminderMin }),
    });
  };

  const saveEditor = (d: Draft) => {
    if (!data || !editor) return;
    const { start, end } = draftTimes(d);
    if (editor.mode === "new") {
      createEvent({
        calendarId: d.calendarId, title: d.title.trim(), description: d.description, location: d.location, allDay: d.allDay,
        start: toStamp(start, d.allDay), end: toStamp(end, d.allDay), rrule: d.rrule, color: d.color, busy: d.busy, reminderMin: d.reminderMin,
      });
      setEditor(null);
      return;
    }
    const occ = editor.occ!;
    const init = editor.initial;
    const patch: EventPatch = {};
    if (d.title !== init.title) patch.title = d.title.trim();
    if (d.description !== init.description) patch.description = d.description;
    if (d.location !== init.location) patch.location = d.location;
    if (d.calendarId !== init.calendarId) patch.calendarId = d.calendarId;
    if (d.color !== init.color) patch.color = d.color;
    if (d.busy !== init.busy) patch.busy = d.busy;
    if (d.reminderMin !== init.reminderMin) patch.reminderMin = d.reminderMin;
    const timesChanged = (["allDay", "startDate", "startTime", "endDate", "endTime"] as const).some((k) => d[k] !== init[k]);
    if (timesChanged) Object.assign(patch, { allDay: d.allDay, start: toStamp(start, d.allDay), end: toStamp(end, d.allDay) });
    const ruleChanged = d.rrule !== init.rrule;
    setEditor(null);
    if (!Object.keys(patch).length && !ruleChanged) return;

    const apply = (s: AgendaState, scope: Scope): AgendaState => {
      let next = updateOccurrence(s, occ, patch, scope);
      if (!ruleChanged) return next;
      if (!occ.recurring || scope === "all" || occ.isFirst) {
        // la serie (o el evento suelto) pasa a la nueva regla anclada en esta ocurrencia
        next = {
          ...next,
          events: next.events.map((e) =>
            e.id === occ.eventId ? { ...e, allDay: d.allDay, start: toStamp(start, d.allDay), end: toStamp(end, d.allDay), rrule: d.rrule } : e,
          ),
          exceptions: next.exceptions.filter((x) => x.eventId !== occ.eventId),
        };
      } else {
        // "este y los siguientes": la serie nueva quedó al final
        const created = next.events[next.events.length - 1];
        next = { ...next, events: next.events.map((e) => (e.id === created.id ? { ...e, rrule: d.rrule } : e)) };
      }
      return next;
    };
    askOrApply(occ, apply, "Evento actualizado", !ruleChanged);
  };

  const setColor = (occ: Occurrence, color: string | null) => {
    setPop(null);
    askOrApply(occ, (s, scope) => updateOccurrence(s, occ, { color }, scope), "Color cambiado");
  };

  const goTo = (d: Date, v?: ViewKind) => {
    setAnchor(startOfDay(d));
    if (v) changeView(v);
  };

  /* ---------- atajos ---------- */

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (editor || pending || dialog) return;
      const k = e.key;
      const detail = pop?.kind === "detail" ? pop.occ : null;
      if (detail && k === "e") return void (e.preventDefault(), openEdit(detail));
      if (detail && (k === "Delete" || k === "Backspace")) return void (e.preventDefault(), requestDelete(detail));
      if (pop) return;
      const map: Record<string, () => void> = {
        c: () => openNew(),
        t: () => goTo(new Date()),
        j: () => setAnchor((a) => step(view, a, 1)),
        n: () => setAnchor((a) => step(view, a, 1)),
        k: () => setAnchor((a) => step(view, a, -1)),
        p: () => setAnchor((a) => step(view, a, -1)),
        g: () => setDialog("goto"),
        "1": () => changeView("day"), d: () => changeView("day"),
        "2": () => changeView("week"), w: () => changeView("week"),
        "3": () => changeView("month"), m: () => changeView("month"),
        "4": () => changeView("4days"), x: () => changeView("4days"),
        "5": () => changeView("agenda"), a: () => changeView("agenda"),
        "/": () => searchRef.current?.focus(),
        "?": () => setDialog("shortcuts"),
        z: () => undo(),
        s: () => setDialog("settings"),
      };
      const fn = map[k];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (!data) return <div className="app" aria-busy="true" />;

  const center = (): Point => ({ x: window.innerWidth / 2 - 180, y: window.innerHeight / 3 });
  const openDetail = (occ: Occurrence, at: Point) => setPop({ kind: "detail", occ, at });
  const ev = pop?.kind === "detail" ? data.events.find((e) => e.id === pop.occ.eventId) : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" onClick={() => setSideOpen((o) => !o)} aria-label="Menú" aria-expanded={sideOpen}>
          <Icon name="menu" />
        </button>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            {now.getDate()}
          </span>
          <span>Agenda</span>
        </div>
        <button className="btn" onClick={() => goTo(new Date())}>
          Hoy
        </button>
        <button className="icon-btn" onClick={() => setAnchor(step(view, anchor, -1))} aria-label="Anterior">
          <Icon name="left" />
        </button>
        <button className="icon-btn" onClick={() => setAnchor(step(view, anchor, 1))} aria-label="Siguiente">
          <Icon name="right" />
        </button>
        <h1 className="title">{viewTitle(view, anchor, data.settings)}</h1>
        <div className="spacer" />
        <div className="search">
          <Icon name="search" />
          <input
            ref={searchRef}
            type="search"
            placeholder="Buscar"
            aria-label="Buscar eventos"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                setSearchOpen(false);
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          {searchOpen && query.trim().length >= 2 && (
            <>
              <div className="backdrop" onPointerDown={() => setSearchOpen(false)} />
              <div className="search-results" role="listbox" aria-label="Resultados">
                {searchResults.length === 0 ? (
                  <div className="empty" style={{ padding: 20 }}>
                    No hay eventos con “{query.trim()}”. Probá con otra palabra.
                  </div>
                ) : (
                  searchResults.map((o) => (
                    <button
                      key={o.key}
                      className="list-row"
                      style={{ ["--ev" as string]: colorOf(o) }}
                      onClick={() => {
                        setSearchOpen(false);
                        goTo(o.start, view === "agenda" ? "week" : view);
                        openDetail(o, center());
                      }}
                    >
                      <span className="dot" />
                      <span className="tm">{o.start.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span>{o.title || "(Sin título)"}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <select className="btn" value={view} onChange={(e) => changeView(e.target.value as ViewKind)} aria-label="Vista">
          {(Object.keys(VIEW_LABEL) as ViewKind[]).map((v) => (
            <option key={v} value={v}>
              {VIEW_LABEL[v]}
            </option>
          ))}
        </select>
        <button className="icon-btn hide-sm" onClick={() => setDialog("shortcuts")} aria-label="Atajos de teclado" title="Atajos (?)">
          <Icon name="keyboard" />
        </button>
        <button className="icon-btn" onClick={() => setDialog("settings")} aria-label="Ajustes">
          <Icon name="settings" />
        </button>
      </header>

      <div className={`body${sideOpen ? "" : " collapsed"}`}>
        <Sidebar
          anchor={anchor}
          now={now}
          settings={data.settings}
          calendars={data.calendars}
          onCreate={() => openNew()}
          onPick={(d) => {
            goTo(d);
            if (window.innerWidth < 760) setSideOpen(false);
          }}
          onToggle={(id) => {
            const next = { ...data, calendars: data.calendars.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)) };
            setData(next);
            store.save(next);
          }}
          onAddCalendar={() => setDialog({})}
          onEditCalendar={(c) => setDialog({ cal: c })}
        />
        <main className="main">
          {(view === "day" || view === "week" || view === "4days") && (
            <TimeGrid
              days={gridDays(view, anchor, data.settings)}
              occs={occs}
              now={now}
              colorOf={colorOf}
              defaultDurationMin={data.settings.defaultDurationMin}
              draft={pop?.kind === "create" && !pop.allDay ? { start: pop.start, end: pop.end } : null}
              onCreate={(start, end, at) => setPop({ kind: "create", start, end, allDay: false, at })}
              onCreateAllDay={(d, at) => setPop({ kind: "create", start: d, end: addDays(d, 1), allDay: true, at })}
              onOpen={openDetail}
              onChange={onDragChange}
              onPickDay={(d) => goTo(d, "day")}
            />
          )}
          {view === "month" && (
            <MonthView
              weeks={monthWeeks(anchor, data.settings)}
              anchor={anchor}
              occs={occs}
              now={now}
              colorOf={colorOf}
              onOpen={openDetail}
              onCreateAllDay={(d, at) => setPop({ kind: "create", start: d, end: addDays(d, 1), allDay: true, at })}
              onPickDay={(d) => goTo(d, "day")}
            />
          )}
          {view === "agenda" && (
            <ListView
              occs={occs}
              now={now}
              colorOf={colorOf}
              onOpen={openDetail}
              empty={{ title: "Nada en los próximos 60 días", text: "Tocá Crear o apretá c para agendar algo." }}
            />
          )}
        </main>
      </div>

      {pop?.kind === "create" && (
        <QuickCreate
          at={pop.at}
          start={pop.start}
          end={pop.end}
          allDay={pop.allDay}
          calendars={data.calendars}
          calendarId={defaultCal!.id}
          onClose={() => setPop(null)}
          onSave={(title, calendarId) => {
            createEvent({
              calendarId, title: title.trim(), description: "", location: "", allDay: pop.allDay,
              start: toStamp(pop.start, pop.allDay), end: toStamp(pop.end, pop.allDay), rrule: null, color: null, busy: true,
              reminderMin: pop.allDay ? null : 10,
            });
            setPop(null);
          }}
          onMore={(title, calendarId) => openNew(pop.start, pop.end, pop.allDay, title, calendarId)}
        />
      )}

      {pop?.kind === "detail" && (
        <EventDetail
          at={pop.at}
          occ={pop.occ}
          ruleText={ev?.rrule ? describeRule(ev.rrule, pop.occ.start) : null}
          calendar={calendarOf(pop.occ)}
          color={colorOf(pop.occ)}
          onClose={() => setPop(null)}
          onEdit={() => openEdit(pop.occ)}
          onDelete={() => requestDelete(pop.occ)}
          onColor={(c) => setColor(pop.occ, c)}
        />
      )}

      {editor && (
        <EventEditor
          heading={editor.mode === "new" ? "Nuevo evento" : "Editar evento"}
          initial={editor.initial}
          calendars={data.calendars}
          onClose={() => setEditor(null)}
          onSave={saveEditor}
          onDelete={editor.occ ? () => requestDelete(editor.occ!) : undefined}
        />
      )}

      {pending && (
        <ScopeDialog
          action={pending.action}
          allowFollowing={!pending.occ.isFirst}
          allowThis={pending.action === "delete" || pending.allowThis}
          onClose={() => setPending(null)}
          onPick={(scope) => {
            const p = pending;
            setPending(null);
            if (p.action === "delete") commit(deleteOccurrence(data, p.occ, scope), "Evento borrado");
            else {
              commit(p.apply(data, scope), p.msg);
            }
          }}
        />
      )}

      {dialog === "settings" && (
        <SettingsDialog
          settings={data.settings}
          notifState={notifState}
          onEnableNotifications={async () => {
            try {
              setNotifState(await Notification.requestPermission());
            } catch {
              setNotifState("unsupported");
            }
          }}
          onReset={() => {
            commit(seedState(new Date()), "Datos de ejemplo restablecidos");
            setDialog(null);
          }}
          onSave={(s) => {
            commit({ ...data, settings: s }, "Ajustes guardados");
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "shortcuts" && <ShortcutsDialog onClose={() => setDialog(null)} />}
      {dialog === "goto" && (
        <GoToDateDialog
          initial={toDateOnly(anchor)}
          onClose={() => setDialog(null)}
          onGo={(d) => {
            goTo(parseDateOnly(d));
            setDialog(null);
          }}
        />
      )}
      {dialog && typeof dialog === "object" && (
        <CalendarDialog
          initial={dialog.cal}
          canDelete={data.calendars.length > 1}
          onClose={() => setDialog(null)}
          onSave={(name, color) => {
            const cals = dialog.cal
              ? data.calendars.map((c) => (c.id === dialog.cal!.id ? { ...c, name, color } : c))
              : [...data.calendars, { id: uid(), name, color, isDefault: false, visible: true }];
            commit({ ...data, calendars: cals }, dialog.cal ? "Calendario guardado" : "Calendario creado");
            setDialog(null);
          }}
          onDelete={
            dialog.cal
              ? () => {
                  const id = dialog.cal!.id;
                  let cals = data.calendars.filter((c) => c.id !== id);
                  if (!cals.some((c) => c.isDefault)) cals = cals.map((c, i) => (i === 0 ? { ...c, isDefault: true } : c));
                  const evIds = new Set(data.events.filter((e) => e.calendarId === id).map((e) => e.id));
                  commit(
                    {
                      ...data,
                      calendars: cals,
                      events: data.events.filter((e) => !evIds.has(e.id)),
                      exceptions: data.exceptions.filter((x) => !evIds.has(x.eventId)),
                    },
                    "Calendario borrado",
                  );
                  setDialog(null);
                }
              : undefined
          }
        />
      )}

      {toast && <Toast key={toast.id} msg={toast.msg} onUndo={toast.undo ? undo : undefined} onDone={() => setToast(null)} />}
    </div>
  );
}

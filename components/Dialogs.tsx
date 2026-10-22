"use client";

import { useEffect, useRef, useState } from "react";
import { PALETTE } from "@/lib/seed";
import type { Calendar, Scope, Settings } from "@/lib/types";

function Modal(p: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && p.onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={p.label}>
        {p.children}
      </div>
    </div>
  );
}

export function ScopeDialog(p: { action: "save" | "delete"; allowFollowing: boolean; allowThis?: boolean; onPick: (s: Scope) => void; onClose: () => void }) {
  const allowThis = p.allowThis ?? true;
  const [scope, setScope] = useState<Scope>(allowThis ? "this" : p.allowFollowing ? "following" : "all");
  const title = p.action === "delete" ? "Borrar evento recurrente" : "Editar evento recurrente";
  return (
    <Modal label={title} onClose={p.onClose}>
      <h2>{title}</h2>
      <div role="radiogroup">
        {allowThis && (
          <label className="radio">
            <input type="radio" name="scope" checked={scope === "this"} onChange={() => setScope("this")} autoFocus /> Este evento
          </label>
        )}
        {p.allowFollowing && (
          <label className="radio">
            <input type="radio" name="scope" checked={scope === "following"} onChange={() => setScope("following")} /> Este y los siguientes
          </label>
        )}
        <label className="radio">
          <input type="radio" name="scope" checked={scope === "all"} onChange={() => setScope("all")} /> Todos los eventos
        </label>
      </div>
      <div className="foot">
        <button className="btn ghost" onClick={p.onClose}>
          Cancelar
        </button>
        <button className={`btn primary`} onClick={() => p.onPick(scope)}>
          {p.action === "delete" ? "Borrar" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}

export function SettingsDialog(p: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onEnableNotifications: () => void;
  notifState: string;
  onReset: () => void;
  onClose: () => void;
}) {
  const [s, setS] = useState(p.settings);
  return (
    <Modal label="Ajustes" onClose={p.onClose}>
      <h2>Ajustes</h2>
      <div style={{ display: "grid", gap: 14 }}>
        <label>
          <div className="label" style={{ fontWeight: 700, color: "var(--ink-2)", fontSize: 13, marginBottom: 6 }}>
            La semana empieza el
          </div>
          <select className="input" value={s.weekStart} onChange={(e) => setS({ ...s, weekStart: Number(e.target.value) as Settings["weekStart"] })}>
            <option value={1}>Lunes</option>
            <option value={0}>Domingo</option>
            <option value={6}>Sábado</option>
          </select>
        </label>
        <label>
          <div style={{ fontWeight: 700, color: "var(--ink-2)", fontSize: 13, marginBottom: 6 }}>Duración de los eventos nuevos</div>
          <select className="input" value={s.defaultDurationMin} onChange={(e) => setS({ ...s, defaultDurationMin: Number(e.target.value) })}>
            {[15, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} minutos` : m === 60 ? "1 hora" : `${m / 60} horas`}
              </option>
            ))}
          </select>
        </label>
        <label className="radio">
          <input type="checkbox" checked={s.showWeekends} onChange={(e) => setS({ ...s, showWeekends: e.target.checked })} /> Mostrar fines de semana
        </label>
        <div>
          <div style={{ fontWeight: 700, color: "var(--ink-2)", fontSize: 13, marginBottom: 6 }}>Recordatorios</div>
          {p.notifState === "granted" ? (
            <span>Las notificaciones del navegador están activadas.</span>
          ) : p.notifState === "denied" ? (
            <span>El navegador bloqueó las notificaciones. Habilitalas desde la configuración del sitio.</span>
          ) : p.notifState === "unsupported" ? (
            <span>Este navegador no soporta notificaciones.</span>
          ) : (
            <button className="btn" onClick={p.onEnableNotifications}>
              Activar notificaciones
            </button>
          )}
        </div>
        <div>
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm("Se borran todos tus eventos y calendarios y vuelven los datos de ejemplo. ¿Seguir?")) p.onReset();
            }}
          >
            Restablecer datos de ejemplo
          </button>
        </div>
      </div>
      <div className="foot">
        <button className="btn ghost" onClick={p.onClose}>
          Cancelar
        </button>
        <button className="btn primary" onClick={() => p.onSave(s)}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

export function CalendarDialog(p: { initial?: Calendar; canDelete: boolean; onSave: (name: string, color: string) => void; onDelete?: () => void; onClose: () => void }) {
  const [name, setName] = useState(p.initial?.name ?? "");
  const [color, setColor] = useState(p.initial?.color ?? PALETTE[5].value);
  const title = p.initial ? "Editar calendario" : "Nuevo calendario";
  return (
    <Modal label={title} onClose={p.onClose}>
      <h2>{title}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) p.onSave(name.trim(), color);
        }}
      >
        <input className="field" autoFocus placeholder="Nombre del calendario" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} aria-label="Nombre" />
        <div className="colors" style={{ marginTop: 16 }} role="radiogroup" aria-label="Color">
          {PALETTE.map((c) => (
            <button
              type="button"
              key={c.value}
              role="radio"
              aria-checked={color === c.value}
              aria-label={c.name}
              title={c.name}
              className={`color-dot${color === c.value ? " on" : ""}`}
              style={{ ["--ev" as string]: c.value }}
              onClick={() => setColor(c.value)}
            />
          ))}
        </div>
        <div className="foot">
          {p.initial && p.onDelete && (
            <button
              type="button"
              className="btn danger"
              style={{ marginRight: "auto" }}
              disabled={!p.canDelete}
              title={p.canDelete ? undefined : "No podés borrar tu único calendario"}
              onClick={() => {
                if (window.confirm(`Se borra "${p.initial!.name}" con todos sus eventos. ¿Seguir?`)) p.onDelete!();
              }}
            >
              Borrar
            </button>
          )}
          <button type="button" className="btn ghost" onClick={p.onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

const SHORTCUTS: [string[], string][] = [
  [["c"], "Crear evento"],
  [["t"], "Ir a hoy"],
  [["j"], "Período siguiente"],
  [["k"], "Período anterior"],
  [["g"], "Ir a una fecha"],
  [["1", "d"], "Vista día"],
  [["2", "w"], "Vista semana"],
  [["3", "m"], "Vista mes"],
  [["4", "x"], "Vista 4 días"],
  [["5", "a"], "Vista agenda"],
  [["/"], "Buscar"],
  [["e"], "Editar el evento abierto"],
  [["Supr"], "Borrar el evento abierto"],
  [["z"], "Deshacer"],
  [["Ctrl", "s"], "Guardar en la edición"],
  [["Esc"], "Cerrar"],
  [["?"], "Ver atajos"],
];

export function ShortcutsDialog(p: { onClose: () => void }) {
  return (
    <Modal label="Atajos de teclado" onClose={p.onClose}>
      <h2>Atajos de teclado</h2>
      <table className="kbd-table">
        <tbody>
          {SHORTCUTS.map(([keys, label]) => (
            <tr key={label}>
              <td>{label}</td>
              <td style={{ textAlign: "right" }}>
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="foot">
        <button className="btn primary" onClick={p.onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  );
}

export function GoToDateDialog(p: { initial: string; onGo: (d: string) => void; onClose: () => void }) {
  const [v, setV] = useState(p.initial);
  return (
    <Modal label="Ir a una fecha" onClose={p.onClose}>
      <h2>Ir a una fecha</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (v) p.onGo(v);
        }}
      >
        <input className="input" type="date" autoFocus value={v} onChange={(e) => setV(e.target.value)} aria-label="Fecha" />
        <div className="foot">
          <button type="button" className="btn ghost" onClick={p.onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            Ir
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Toast(p: { msg: string; onUndo?: () => void; onDone: () => void }) {
  const done = useRef(p.onDone);
  done.current = p.onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{p.msg}</span>
      {p.onUndo && <button onClick={p.onUndo}>Deshacer</button>}
    </div>
  );
}

export type ViewKind = "day" | "week" | "4days" | "month" | "agenda";

export type Calendar = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  visible: boolean;
};

/**
 * Evento base. Si allDay, start/end son "YYYY-MM-DD" (end exclusivo).
 * Si no, start/end son ISO en UTC (end exclusivo).
 */
export type CalEvent = {
  id: string;
  calendarId: string;
  title: string;
  description: string;
  location: string;
  allDay: boolean;
  start: string;
  end: string;
  timezone: string;
  rrule: string | null; // RFC 5545 sin DTSTART, ej "FREQ=WEEKLY;BYDAY=MO"
  color: string | null;
  busy: boolean;
  reminderMin: number | null;
};

export type EventPatch = Partial<
  Pick<CalEvent, "title" | "description" | "location" | "allDay" | "start" | "end" | "color" | "calendarId" | "busy" | "reminderMin">
>;

/** Ocurrencia editada ("solo este") o borrada de una serie */
export type EventException = {
  eventId: string;
  originalStart: string; // mismo formato que CalEvent.start
  cancelled: boolean;
  overrides: EventPatch;
};

export type Settings = {
  weekStart: 0 | 1 | 6;
  showWeekends: boolean;
  defaultDurationMin: number;
};

export type AgendaState = {
  calendars: Calendar[];
  events: CalEvent[];
  exceptions: EventException[];
  settings: Settings;
};

/** Una aparición concreta de un evento en el calendario */
export type Occurrence = {
  key: string; // eventId + originalStart
  eventId: string;
  originalStart: string;
  start: Date; // todo el día: medianoche local
  end: Date; // exclusivo
  allDay: boolean;
  title: string;
  location: string;
  description: string;
  calendarId: string;
  color: string | null;
  recurring: boolean;
  isFirst: boolean;
};

export type Scope = "this" | "following" | "all";

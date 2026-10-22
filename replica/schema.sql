-- Agenda (clon de Google Calendar) - esquema para Supabase / Postgres
-- Fase 2: la app arranca con un data layer local y migra a esto sin tocar pantallas.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  locale text not null default 'es-AR',
  week_start smallint not null default 1 check (week_start between 0 and 6),
  default_duration_min int not null default 60 check (default_duration_min > 0),
  show_weekends boolean not null default true,
  secondary_timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  color text not null,
  is_default boolean not null default false,
  visible boolean not null default true,
  default_reminders jsonb not null default '[{"method":"popup","minutes":10}]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on calendars (user_id);
create unique index one_default_calendar on calendars (user_id) where is_default;

create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id uuid not null references calendars(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  location text not null default '',
  all_day boolean not null default false,
  start_at timestamptz,            -- eventos con hora
  end_at timestamptz,              -- exclusivo
  start_date date,                 -- eventos de todo el día
  end_date date,                   -- exclusivo
  timezone text not null,          -- IANA, se usa para expandir la recurrencia
  rrule text,                      -- RFC 5545 sin DTSTART, null = no se repite
  color text,                      -- null = color del calendario
  busy boolean not null default true,
  visibility text not null default 'default' check (visibility in ('default','public','private')),
  reminders jsonb,                 -- null = recordatorios por defecto del calendario
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timed_or_all_day check (
    (all_day and start_date is not null and end_date > start_date and start_at is null)
    or (not all_day and start_at is not null and end_at > start_at and start_date is null)
  )
);
create index on events (calendar_id);
create index on events (user_id, start_at);
create index on events (user_id, start_date);
create index on events (user_id) where rrule is not null;

-- Ocurrencias editadas ("solo este evento") o borradas de una serie
create table event_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_start timestamptz not null,   -- inicio que tenía según la regla
  cancelled boolean not null default false,
  overrides jsonb not null default '{}', -- campos que cambian (title, start_at, end_at, ...)
  created_at timestamptz not null default now(),
  unique (event_id, original_start)
);
create index on event_exceptions (user_id);

-- RLS: cada usuario ve y toca solo lo suyo
alter table profiles enable row level security;
alter table calendars enable row level security;
alter table events enable row level security;
alter table event_exceptions enable row level security;

create policy own_profile on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy own_calendars on calendars for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_events on events for all using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and exists (select 1 from calendars c where c.id = calendar_id and c.user_id = auth.uid())
);
create policy own_exceptions on event_exceptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

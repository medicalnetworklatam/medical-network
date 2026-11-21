-- =============================================================================
-- Migration 7: checklist templates, the client layer, client details and
-- "Mis dudas"
-- =============================================================================
-- Apply ONCE, after migrations 1 to 6, by pasting this whole file into
-- Supabase's SQL Editor and pressing "Run". See supabase/README.md.
--
-- Like the earlier migrations, everything runs inside one transaction
-- (BEGIN ... COMMIT): if any line fails, nothing at all is changed.
--
-- What it changes (decisions of 20 Nov 2026, see DECISIONS.md "Changes on
-- 20 Nov 2026"):
--   1. Codes may contain "_" as well as "-" (the owner's route keys, e.g.
--      medico_drittstaat, and step codes, e.g. bw_via, need it).
--   2. routes: the four permanent route codes and their Spanish names.
--   3. checklist_items: new columns for the owner's templates (block,
--      official number, place in the envelope, Dónde, Plazo, warning,
--      Caduca, "no aplica" by default and its reason, the owner's code).
--      Read through the existing rule (migration 3); only admins write.
--   4. checklist_templates: one row per Bundesland + route with the block
--      titles, the cover texts and the info cards. Same read rule as the
--      checklist items.
--   5. client_item_settings: the client layer, per client and step
--      ("aplica" / "no aplica", reason, personal note). Admins write; a paid
--      client reads only their own rows, for items they can read.
--   6. client_details: the client's country and an optional header line.
--      Admins write; a paid client reads their own.
--   7. client_dudas: "Mis dudas", one text per client. A paid client reads
--      and writes only their own; admins read all.
--
-- Everything is shown by the website as plain text, never as HTML.
-- Nothing here takes a user ID and returns another user's data.
--
-- The site that is live before this migration keeps working: it reads only
-- the checklist columns it knows, and doesn't know the new tables.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Codes may contain "_"
-- -----------------------------------------------------------------------------
-- Migration 1 allowed only a-z, 0-9 and single hyphens between them. Now a
-- single "_" or "-" may sit between letters and digits. Every code that was
-- allowed before is still allowed (e.g. 'rls-test-route', 'by-kp-010').
alter table public.routes drop constraint routes_code_check;
alter table public.routes add constraint routes_code_check
  check (code ~ '^[a-z0-9]+([_-][a-z0-9]+)*$');

alter table public.checklist_items drop constraint checklist_items_code_check;
alter table public.checklist_items add constraint checklist_items_code_check
  check (code ~ '^[a-z0-9]+([_-][a-z0-9]+)*$');

-- -----------------------------------------------------------------------------
-- 2. The four routes
-- -----------------------------------------------------------------------------
-- Permanent codes (the owner's route keys). Never rename or delete them;
-- retire one with archived = true. A plain insert on purpose: if one of
-- these codes already existed, the whole migration stops and nothing changes.
insert into public.routes (code, name, sort_order) values
  ('medico_drittstaat',   'Médico · título de fuera de la UE',              1),
  ('medico_ue',           'Médico · título de la UE, el EEE o Suiza',       2),
  ('dentista_drittstaat', 'Dentista · título de fuera de la UE',            3),
  ('dentista_ue',         'Dentista · título de la UE, el EEE o Suiza',     4);

-- -----------------------------------------------------------------------------
-- 3. checklist_items: the template's step fields
-- -----------------------------------------------------------------------------
-- title and body (migration 1) hold the step's title and description.
-- All new fields are plain text shown as plain text. {pais} and
-- {genero:x|y} stay in the stored text; the website fills them in.
-- block may be empty for items that don't come from a template.
alter table public.checklist_items
  add column block            smallint check (block between 1 and 5),
  add column official_number  text check (char_length(official_number) between 1 and 50),
  add column sobre_order      integer check (sobre_order >= 1),  -- NULL = not in the envelope
  add column donde            text,
  add column plazo            text,
  add column aviso            text,
  add column caduca           text,
  add column na_default       boolean not null default false,  -- "no aplica" by default
  add column na_reason        text,
  add column source_code      text check (source_code ~ '^[a-z0-9]+(_[a-z0-9]+)*$');

-- When an item comes from a template (source_code filled in), its readable
-- code is always <state>-<route>-<owner's code>, e.g. bw-medico_drittstaat-bw8.
alter table public.checklist_items add constraint checklist_items_code_from_source
  check (source_code is null or code = state || '-' || route || '-' || source_code);

comment on column public.checklist_items.block is 'Template block 1-5. NULL for items not from a template.';
comment on column public.checklist_items.official_number is 'Display text, e.g. "6", "pág. 4", "—".';
comment on column public.checklist_items.sobre_order is 'Place in the envelope (tarjetas.sobre.orden). NULL = not in the envelope.';
comment on column public.checklist_items.na_default is 'True when the step is "no aplica" by default in the template.';
comment on column public.checklist_items.na_reason is 'Why the step may not apply (also kept when na_default is false).';
comment on column public.checklist_items.source_code is 'The owner''s step code, e.g. bw8. Not stable over time: see DECISIONS.md.';

-- Grants: reading needs nothing new. Migration 1 granted SELECT on the
-- whole table, so the new columns are readable under the existing rule
-- (migration 3: a paid client, their own state and route, not archived).
-- Writing: the same column lists as before plus the new columns. The
-- policies (migration 1) let only admins insert or update. Still no delete.
grant insert (block, official_number, sobre_order, donde, plazo, aviso, caduca,
              na_default, na_reason, source_code)
  on public.checklist_items to authenticated;
grant update (block, official_number, sobre_order, donde, plazo, aviso, caduca,
              na_default, na_reason, source_code)
  on public.checklist_items to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Trigger functions shared by the new tables
-- -----------------------------------------------------------------------------
-- A "trigger" is code the database runs by itself on every change. These
-- run with the caller's rights (not SECURITY DEFINER): they only tidy up the
-- row being written.

-- Sets updated_at to now(), whatever was sent.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- client_item_settings: trims reason and note (spaces, tabs, line breaks at
-- both ends); text that is empty after trimming becomes NULL.
create function private.tidy_client_item_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reason     := nullif(btrim(new.reason, E' \t\r\n'), '');
  new.note       := nullif(btrim(new.note,   E' \t\r\n'), '');
  new.updated_at := now();
  return new;
end;
$$;

-- client_details: the same for country and header_line.
create function private.tidy_client_details()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.country     := nullif(btrim(new.country,     E' \t\r\n'), '');
  new.header_line := nullif(btrim(new.header_line, E' \t\r\n'), '');
  new.updated_at  := now();
  return new;
end;
$$;

-- client_dudas: trims the text (empty stays allowed: that clears it) and
-- sets the date.
create function private.tidy_client_dudas()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.body       := btrim(coalesce(new.body, ''), E' \t\r\n');
  new.updated_at := now();
  return new;
end;
$$;

-- Nobody may call these directly (the database runs them).
revoke all on function private.set_updated_at()            from public, anon, authenticated;
revoke all on function private.tidy_client_item_settings() from public, anon, authenticated;
revoke all on function private.tidy_client_details()       from public, anon, authenticated;
revoke all on function private.tidy_client_dudas()         from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. checklist_templates: block titles, cover and cards per state + route
-- -----------------------------------------------------------------------------
-- cover, blocks and cards are "jsonb" (Postgres's type for structured JSON
-- data). The website shows every text in them as plain text.
-- Never deleted (no delete grant).
create table public.checklist_templates (
  state         public.state_code not null,
  route         text not null references public.routes (code),
  title         text not null check (char_length(title) between 1 and 300),
  rules_label   text check (char_length(rules_label) between 1 and 200),  -- e.g. 'Reforma del 01/11/2026'
  generated_on  date,                                                     -- the owner's "generada"
  cover         jsonb not null default '{}'::jsonb check (jsonb_typeof(cover)  = 'object'),
  blocks        jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  cards         jsonb not null default '{}'::jsonb check (jsonb_typeof(cards)  = 'object'),
  updated_at    timestamptz not null default now(),
  primary key (state, route)
);
comment on table public.checklist_templates is
  'One per Bundesland + route: block titles, cover texts and info cards of the checklist. '
  'Same read rule as checklist_items. Written by admins (or the SQL Editor); never deleted.';

create trigger set_updated_at
  before insert or update on public.checklist_templates
  for each row execute function private.set_updated_at();

alter table public.checklist_templates enable row level security;

revoke all on public.checklist_templates from public, anon, authenticated;
grant select on public.checklist_templates to authenticated;
grant insert (state, route, title, rules_label, generated_on, cover, blocks, cards)
  on public.checklist_templates to authenticated;
grant update (title, rules_label, generated_on, cover, blocks, cards)
  on public.checklist_templates to authenticated;

-- Read: exactly like checklist_items (migration 3), without "archived".
create policy "checklist_templates: paid read own state and route, admins all"
  on public.checklist_templates for select to authenticated
  using (
    (select private.is_admin())
    or (
      (select private.has_paid_access())
      and (select private.my_state()) is not null
      and state = (select private.my_state())
      and (select private.my_route()) is not null
      and route = (select private.my_route())
    )
  );
create policy "checklist_templates: admins add"
  on public.checklist_templates for insert to authenticated
  with check ((select private.is_admin()));
create policy "checklist_templates: admins change"
  on public.checklist_templates for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- 6. client_item_settings: the client layer, per client and step
-- -----------------------------------------------------------------------------
-- applies: true = "aplica", false = "no aplica", NULL = the template's default.
-- Deleting a login deletes its rows. Items are never deleted.
-- No delete grant: an admin resets a step by setting applies, reason and note
-- back to empty.
create table public.client_item_settings (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  item_id     uuid not null references public.checklist_items (id),
  applies     boolean,
  reason      text check (char_length(reason) between 1 and 500),
  note        text check (char_length(note)   between 1 and 2000),
  updated_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);
comment on table public.client_item_settings is
  'Client layer of the checklist, set by admins. applies NULL = template default. '
  'A paid client reads only their own rows, for items they can read.';

create trigger tidy_client_item_settings
  before insert or update on public.client_item_settings
  for each row execute function private.tidy_client_item_settings();

alter table public.client_item_settings enable row level security;

revoke all on public.client_item_settings from public, anon, authenticated;
grant select on public.client_item_settings to authenticated;
grant insert (user_id, item_id, applies, reason, note) on public.client_item_settings to authenticated;
grant update (applies, reason, note)                   on public.client_item_settings to authenticated;

-- Read: admins all; a paid client only their own rows, and only for items
-- they can read. The EXISTS runs with the reader's rights, so the
-- checklist_items rule (migration 3) decides: their state, their route,
-- not archived.
create policy "client_item_settings: own rows for visible items, admins all"
  on public.client_item_settings for select to authenticated
  using (
    (select private.is_admin())
    or (
      user_id = (select auth.uid())
      and (select private.has_paid_access())
      and exists (select 1 from public.checklist_items i where i.id = client_item_settings.item_id)
    )
  );
create policy "client_item_settings: admins add"
  on public.client_item_settings for insert to authenticated
  with check ((select private.is_admin()));
create policy "client_item_settings: admins change"
  on public.client_item_settings for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- 7. client_details: country and header line, per client
-- -----------------------------------------------------------------------------
-- Not in profiles on purpose: clients may update their own profile row.
create table public.client_details (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  country      text check (char_length(country)     between 1 and 100),  -- fills {pais}
  header_line  text check (char_length(header_line) between 1 and 300),  -- fills {perfil}
  updated_at   timestamptz not null default now()
);
comment on table public.client_details is
  'Per-client checklist details, set by admins. A paid client reads their own.';

create trigger tidy_client_details
  before insert or update on public.client_details
  for each row execute function private.tidy_client_details();

alter table public.client_details enable row level security;

revoke all on public.client_details from public, anon, authenticated;
grant select on public.client_details to authenticated;
grant insert (user_id, country, header_line) on public.client_details to authenticated;
grant update (country, header_line)          on public.client_details to authenticated;

create policy "client_details: paid read own, admins read all"
  on public.client_details for select to authenticated
  using (
    (select private.is_admin())
    or (user_id = (select auth.uid()) and (select private.has_paid_access()))
  );
create policy "client_details: admins add"
  on public.client_details for insert to authenticated
  with check ((select private.is_admin()));
create policy "client_details: admins change"
  on public.client_details for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- 8. client_dudas: "Mis dudas", one text per client
-- -----------------------------------------------------------------------------
-- The website sends only user_id (it must be the writer's own) and body.
-- The database trims the text and sets updated_at. Up to 4,000 characters
-- after trimming; empty is allowed (that clears it). No delete grant.
create table public.client_dudas (
  user_id     uuid primary key default auth.uid()
              references public.profiles (id) on delete cascade,
  body        text not null default '' check (char_length(body) <= 4000),
  updated_at  timestamptz not null default now()
);
comment on table public.client_dudas is
  '"Mis dudas": written by the client (paid) for themselves only; admins read all.';

create trigger tidy_client_dudas
  before insert or update on public.client_dudas
  for each row execute function private.tidy_client_dudas();

alter table public.client_dudas enable row level security;

revoke all on public.client_dudas from public, anon, authenticated;
grant select                  on public.client_dudas to authenticated;
grant insert (user_id, body)  on public.client_dudas to authenticated;
grant update (body)           on public.client_dudas to authenticated;
-- No update on user_id: a row can never be moved to another user.

-- Read: a paid user their own; admins all.
create policy "client_dudas: paid read own, admins read all"
  on public.client_dudas for select to authenticated
  using (
    (select private.is_admin())
    or (user_id = (select auth.uid()) and (select private.has_paid_access()))
  );
-- Write: only one's own row, with paid access. An admin can't write a
-- client's dudas (only their own row, like anyone).
create policy "client_dudas: paid add own"
  on public.client_dudas for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.has_paid_access()));
create policy "client_dudas: paid change own"
  on public.client_dudas for update to authenticated
  using      (user_id = (select auth.uid()) and (select private.has_paid_access()))
  with check (user_id = (select auth.uid()) and (select private.has_paid_access()));

commit;

-- =============================================================================
-- Migration 8: "Mis documentos", files the MNL team uploads for one client
-- =============================================================================
-- Apply ONCE, after migrations 1 to 7, by pasting this whole file into
-- Supabase's SQL Editor and pressing "Run". See supabase/README.md.
--
-- Like the earlier migrations, everything runs inside one transaction
-- (BEGIN ... COMMIT): if any line fails, nothing at all is changed, the
-- storage part at the end included.
--
-- What it changes (decision of 21 Nov 2026, night, see DECISIONS.md):
--   1. client_documents: one row per PDF the team uploaded for a client.
--      A paid client reads only their own rows; admins read, add and
--      delete any; nobody changes a row.
--   2. STORAGE (last section): a private bucket "client-files" for the
--      files themselves (a bucket is a folder in Supabase Storage), PDF
--      only, at most 10 MB, and the rules on storage.objects:
--        - a client reads (and lists) a file only when a client_documents
--          row with exactly that path exists and they can read that row
--          (so: it is their own, and they are paid)
--        - admins read every file in the bucket
--        - only admins upload and delete files; nobody replaces or moves one
--
-- File path in the bucket: <client id>/<random uuid>.pdf
-- The uploaded file's own name is never part of the path; it is kept as
-- plain text in client_documents.file_name.
--
-- Same pattern as news files (migration 5). The site that is live before
-- this migration keeps working with it: it doesn't know the new table or
-- the bucket. The NEW site reads client_documents, so apply this migration
-- BEFORE merging the website change.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. client_documents
-- -----------------------------------------------------------------------------
-- Deleting a login deletes its profile, and that deletes its rows here
-- ("on delete cascade"). The files in storage are NOT deleted with them
-- (known limit, accepted): such a file has no row any more, so no client
-- can read it (section 2) and no screen lists it; admins can still read
-- and delete it.
create table public.client_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  path        text not null unique,
  file_name   text not null,                      -- plain text, shown to the client
  created_at  timestamptz not null default now(),
  -- The path is "<this client's id>/<random uuid>.pdf", nothing else.
  -- (Postgres writes uuids in lowercase, and so does the website.)
  constraint client_documents_path_format check (
    path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    and split_part(path, '/', 1) = user_id::text
  ),
  -- 1 to 200 characters, with no spaces, tabs or line breaks at either end
  -- (the website removes them before sending; anything else is refused)
  constraint client_documents_file_name_format check (
    char_length(file_name) between 1 and 200
    and file_name = btrim(file_name, E' \t\r\n')
  )
);
comment on table public.client_documents is
  '"Mis documentos": PDFs the team uploaded for one client. The file is in the storage bucket '
  'client-files at "path". A paid client reads their own rows; only admins add and delete.';
comment on column public.client_documents.file_name is
  'The uploaded file''s name, as plain text (never part of the path).';

-- The website asks for "this client's files, newest first".
create index client_documents_user_id_created_at_idx
  on public.client_documents (user_id, created_at desc);

alter table public.client_documents enable row level security;

-- Grants ("Automatically expose new tables" is off in this project, so
-- nothing is reachable until it is granted here):
--   - logged-out visitors: nothing
--   - logged in: read and delete; add only user_id, path and file_name
--     (the database sets id and created_at); no update at all, so a row
--     can never be moved to another client or another file
-- The policies below then decide which rows, and that only admins write.
revoke all on public.client_documents from public, anon, authenticated;
grant select, delete on public.client_documents to authenticated;
grant insert (user_id, path, file_name) on public.client_documents to authenticated;

-- Read: admins read every row; a client reads only their own rows, and
-- only while they have paid access (a free client sees nothing).
create policy "client_documents: paid read own, admins read all"
  on public.client_documents for select to authenticated
  using (
    (select private.is_admin())
    or (user_id = (select auth.uid()) and (select private.has_paid_access()))
  );

-- Add and delete: admins only. (No update rule and no update grant:
-- nobody changes a row.)
create policy "client_documents: admins add"
  on public.client_documents for insert to authenticated
  with check ((select private.is_admin()));
create policy "client_documents: admins delete"
  on public.client_documents for delete to authenticated
  using ((select private.is_admin()));

-- =============================================================================
-- 2. STORAGE: the bucket "client-files" and its rules on storage.objects
-- =============================================================================
-- Supabase keeps every stored file as one row of storage.objects (bucket_id
-- = the bucket, name = the path). The Storage service reads and writes that
-- table with the logged-in person's own role, so these RLS rules decide who
-- may download, list, make a signed link for, upload or delete a file.
--
-- On purpose, this section does NOT:
--   - switch RLS on for storage.objects: Supabase already has it on, and
--     only the table's owner (Supabase's storage role, not you) could
--     change that
--   - grant or revoke anything on storage.objects: Supabase manages those
--     grants itself; the rules below are what limit access
--   - add a rule to change ("update") files: with no such rule, nobody can
--     replace a file or move it to another path, admins included

-- The bucket: private (no public links; every download needs a login or a
-- signed link), at most 10 MB per file, PDF only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-files',
  'client-files',
  false,
  10485760,  -- 10 MB = 10 × 1024 × 1024 bytes
  array['application/pdf']
);

-- Read (download, signed links, listing a folder):
--   - admins: every file in the bucket, also one whose row is gone, so
--     they can still find and delete it
--   - everyone else: only a file with a client_documents row of exactly
--     that path. That row's own rule (section 1) checks that it is the
--     reader's own and that they are paid. A file without a row is
--     invisible to clients, also when listing their own folder.
-- Comparing two texts (path = name) can never fail, whatever the name.
create policy "client-files: read own documents, admins read all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'client-files'
    and (
      (select private.is_admin())
      or exists (
        select 1 from public.client_documents d where d.path = objects.name
      )
    )
  );

-- Upload: admins only, and only to "<an existing profile's id>/<uuid>.pdf".
-- The folder is compared as text (p.id::text = ...), so a name that isn't a
-- uuid is simply refused, never an error.
create policy "client-files: admins upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'client-files'
    and (select private.is_admin())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    and exists (
      select 1 from public.profiles p
       where p.id::text = (storage.foldername(objects.name))[1]
    )
  );

-- Delete: admins only.
create policy "client-files: admins delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'client-files' and (select private.is_admin()));

commit;

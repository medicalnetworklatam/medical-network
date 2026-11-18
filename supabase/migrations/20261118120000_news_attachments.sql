-- =============================================================================
-- Migration 5: photos and PDFs attached to Novedades posts
-- =============================================================================
-- Apply ONCE, after migrations 1 to 4, by pasting this whole file into
-- Supabase's SQL Editor and pressing "Run". See supabase/README.md.
--
-- Like the earlier migrations, everything runs inside one transaction
-- (BEGIN ... COMMIT): if any line fails, nothing at all is changed, the
-- storage part at the end included.
--
-- What it changes (decision of 18 Nov 2026, see DECISIONS.md):
--   1. news_attachments: one row per photo or PDF of a news post. Clients
--      read the rows of the posts they can see; only admins write.
--   2. STORAGE (last section): a private bucket "news-files" for the files
--      themselves (a bucket is a folder in Supabase Storage), and the rules
--      on storage.objects:
--        - a client reads a file only when a news_attachments row with
--          exactly that path exists and they can read that row (so: they
--          can see its post)
--        - admins read every file in the bucket
--        - only admins upload, change and delete files
--
-- File path in the bucket: <post id>/<random uuid>.<jpg|png|webp|pdf>
-- The uploaded file's own name is never part of the path; it is kept as
-- plain text in news_attachments.file_name.
--
-- The site that is live before this migration keeps working with it: it
-- doesn't know the new table or the bucket.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. news_attachments
-- -----------------------------------------------------------------------------
-- Deleting a post deletes its rows here ("on delete cascade"). The files in
-- storage are NOT deleted with them: the admin form never deletes posts, so
-- this only happens when a post is deleted by hand in the SQL Editor. Such a
-- file has no row any more, so clients can't read it (section 2).
create table public.news_attachments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.news_posts (id) on delete cascade,
  kind        text not null check (kind in ('image', 'pdf')),
  path        text not null unique,
  file_name   text not null                       -- plain text, shown for PDFs
              check (char_length(file_name) between 1 and 200),
  description text                                -- plain text, the photo's alt text
              check (char_length(description) between 1 and 200),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  -- The path is "<this post's id>/<random uuid>.<ending>", nothing else.
  -- (Postgres writes uuids in lowercase, and so does the website.)
  constraint news_attachments_path_format check (
    path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'
    and split_part(path, '/', 1) = post_id::text
  ),
  -- The ending matches the kind: .pdf is a pdf, the others are photos.
  constraint news_attachments_kind_matches_path check (
    (kind = 'pdf') = (path like '%.pdf')
  )
);
comment on table public.news_attachments is
  'Photos and PDFs of news posts. The file is in the storage bucket news-files at "path". '
  'Visible exactly when the post is visible; written by admins only.';
comment on column public.news_attachments.file_name is
  'The uploaded file''s name, as plain text (never part of the path).';
comment on column public.news_attachments.description is
  'Optional, photos only: the alt text. Plain text.';

-- The website asks for "the files of these posts, in order".
create index news_attachments_post_id_sort_order_idx
  on public.news_attachments (post_id, sort_order);

alter table public.news_attachments enable row level security;

-- Grants ("Automatically expose new tables" is off in this project, so
-- nothing is reachable until it is granted here):
--   - logged-out visitors: nothing
--   - logged in: read and delete; insert only the content columns (the
--     database sets id and created_at); update only sort_order, so a file
--     can never be moved to another post or path
-- The policies below then decide which rows, and that only admins write.
revoke all on public.news_attachments from public, anon, authenticated;
grant select, delete on public.news_attachments to authenticated;
grant insert (post_id, kind, path, file_name, description, sort_order)
  on public.news_attachments to authenticated;
grant update (sort_order) on public.news_attachments to authenticated;

-- Read: exactly when the reader can see the post. The EXISTS runs with the
-- reader's rights, so the news_posts rule (migration 2) decides: published,
-- date has come, paid_only, the reader's state. Admins see every post, so
-- they see every row.
create policy "news_attachments: read when the post is visible"
  on public.news_attachments for select to authenticated
  using (
    exists (select 1 from public.news_posts p where p.id = news_attachments.post_id)
  );

-- Write: admins only.
create policy "news_attachments: admins insert"
  on public.news_attachments for insert to authenticated
  with check ((select private.is_admin()));
create policy "news_attachments: admins update"
  on public.news_attachments for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "news_attachments: admins delete"
  on public.news_attachments for delete to authenticated
  using ((select private.is_admin()));

-- =============================================================================
-- 2. STORAGE: the bucket "news-files" and its rules on storage.objects
-- =============================================================================
-- Supabase keeps every stored file as one row of storage.objects (bucket_id
-- = the bucket, name = the path). The Storage service reads and writes that
-- table with the logged-in person's own role, so these RLS rules decide who
-- may download, list, upload, change or delete a file.
--
-- On purpose, this section does NOT:
--   - switch RLS on for storage.objects: Supabase already has it on, and
--     only the table's owner (Supabase's storage role, not you) could
--     change that
--   - grant or revoke anything on storage.objects: Supabase manages those
--     grants itself; the rules below are what limit access

-- The bucket: private (no public links; every download needs a login or a
-- signed link), at most 10 MB per file, and only these four file types.
-- Never SVG or HTML.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-files',
  'news-files',
  false,
  10485760,  -- 10 MB = 10 × 1024 × 1024 bytes
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Read (download, signed links, listing a folder):
--   - admins: every file in the bucket, also one whose row is gone, so
--     they can still find and delete it
--   - everyone else: only a file with a news_attachments row of exactly
--     that path. That row's own rule (section 1) checks that the reader
--     can see the post. A file without a row (its row was removed but the
--     file wasn't, or the upload's row was never saved) is invisible to
--     clients, also when listing the post's folder.
-- Comparing two texts (path = name) can never fail, whatever the name.
create policy "news-files: read attached files, admins read all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'news-files'
    and (
      (select private.is_admin())
      or exists (
        select 1 from public.news_attachments a where a.path = objects.name
      )
    )
  );

-- Upload: admins only, and only to "<an existing post's id>/<uuid>.<ending>".
-- The folder is compared as text (p.id::text = ...), so a name that isn't a
-- uuid is simply refused, never an error.
create policy "news-files: admins upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'news-files'
    and (select private.is_admin())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'
    and exists (
      select 1 from public.news_posts p
       where p.id::text = (storage.foldername(objects.name))[1]
    )
  );

-- Change (the website never does it, but replacing a file would): admins
-- only, and the new name must follow the same rule.
create policy "news-files: admins update"
  on storage.objects for update to authenticated
  using (bucket_id = 'news-files' and (select private.is_admin()))
  with check (
    bucket_id = 'news-files'
    and (select private.is_admin())
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$'
  );

-- Delete: admins only.
create policy "news-files: admins delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'news-files' and (select private.is_admin()));

commit;

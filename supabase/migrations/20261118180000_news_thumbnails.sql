-- =============================================================================
-- Migration 6: small copies of the photos in Novedades posts
-- =============================================================================
-- Apply ONCE, after migrations 1 to 5, by pasting this whole file into
-- Supabase's SQL Editor and pressing "Run". See supabase/README.md.
--
-- Like the earlier migrations, everything runs inside one transaction
-- (BEGIN ... COMMIT): if any line fails, nothing at all is changed.
--
-- What it changes (decision of 18 Nov 2026, evening, see DECISIONS.md):
--   1. news_attachments.thumb_path: where the photo's small copy (about
--      480 px, JPEG) is stored in the bucket news-files. The admin form
--      makes it automatically when a photo is uploaded; the Novedades list
--      shows it in the preview's tiles. Photos uploaded before this
--      migration have none (empty, NULL); PDFs never have one.
--   2. STORAGE: the read rule of news-files now also lets a client read a
--      small copy, exactly when they can read its photo's row. The upload,
--      change and delete rules stay as they are: a small copy's name
--      ("<post id>/<uuid>.jpg") already follows them.
--
-- The site that is live before this migration keeps working with it: it
-- never asks for the new column, and its rows simply have no small copy.
-- The NEW site asks for thumb_path, so apply this migration BEFORE merging
-- the website change.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. news_attachments.thumb_path
-- -----------------------------------------------------------------------------
-- "unique": two rows can never point to the same small copy.
alter table public.news_attachments
  add column thumb_path text unique;

-- Empty, or all of these:
--   - the row is a photo (a PDF row never has a small copy)
--   - "<post id>/<random uuid>.jpg", lowercase, like path
--   - in this row's own post's folder
--   - never the photo itself
alter table public.news_attachments
  add constraint news_attachments_thumb_path_format check (
    thumb_path is null
    or (
      kind = 'image'
      and thumb_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
      and split_part(thumb_path, '/', 1) = post_id::text
      and thumb_path <> path
    )
  );

comment on column public.news_attachments.thumb_path is
  'Photos only, optional: the small copy (about 480 px, JPEG) in the bucket news-files. '
  'Readable exactly when the row is. Set once when the row is added; never changed.';

-- Grants: thumb_path can be sent when a row is added, never changed later
-- (the update grant stays sort_order only, from migration 5). The policies
-- of migration 5 still decide that only admins add rows.
grant insert (thumb_path) on public.news_attachments to authenticated;

-- =============================================================================
-- 2. STORAGE: the read rule of news-files
-- =============================================================================
-- Same rule as in migration 5, with one addition: a file may also be the
-- small copy (thumb_path) of a row the reader can see. ALTER POLICY changes
-- only the condition; the rule's name, command (read) and role stay.
--   - admins: every file in the bucket, also one whose row is gone, so they
--     can still find and delete it
--   - everyone else: only a file that is the photo or PDF (path) or the
--     small copy (thumb_path) of a news_attachments row they can read. That
--     row's own rule (migration 5) checks that they can see the post. A
--     file without a row is invisible to clients.
alter policy "news-files: read attached files, admins read all"
  on storage.objects
  using (
    bucket_id = 'news-files'
    and (
      (select private.is_admin())
      or exists (
        select 1 from public.news_attachments a
         where a.path = objects.name
            or a.thumb_path = objects.name
      )
    )
  );

commit;

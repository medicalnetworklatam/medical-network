-- =============================================================================
-- RLS check: proves the access rules from migrations 1 to 8 work.
-- =============================================================================
-- Paste this whole file into Supabase's SQL Editor and press "Run".
-- Run it after every migration, and again after any change to policies or
-- grants. It is safe to run as often as you like.
--
-- What it does:
--   1. Checks a few safety nets on the whole database (RLS on every table,
--      nothing for logged-out visitors, and so on).
--   2. Creates 8 fake logins (clients A to G, and an admin), test routes,
--      test checklist items, test news posts and test community posts, and
--      (migration 7) test checklist templates, client-layer rows, client
--      details and dudas. Everything it creates is marked "rls-test", or
--      belongs to a fake login, so it can be found and removed. The admin also uploads
--      a few test files into the "news-files" bucket (rows in
--      storage.objects, no real file content), each in a test news post's
--      folder, plus small copies of the test photos (migration 6), and
--      removes them all again at the end. In the same way (migration 8),
--      the admin uploads a few test PDFs into the "client-files" bucket,
--      in test clients' folders, and they are removed at the end too.
--   3. Pretends to be each of them in turn, the same way the website would be
--      after a login, and checks what they can and can't see or change.
--   4. Deletes everything it created.
--
-- Result:
--   - Success: the result panel shows "ALL RLS TESTS PASSED".
--   - Failure: you get an error starting with "FAIL:" that says which check
--     failed. All test data is thrown away automatically, because the error
--     undoes everything the script did.
--
-- Your real data is never touched: the checks only look at the test rows.
-- Don't give real routes, checklist codes or news titles names that start
-- with "rls-test" / "[rls-test]", or the clean-up step would delete them.
-- =============================================================================

do $test$
declare
  -- the fake users
  a      uuid := gen_random_uuid();   -- client A: free plan, no state at first, no name
  b      uuid := gen_random_uuid();   -- client B: paid, Bayern, "José" "Pérez García"
  c      uuid := gen_random_uuid();   -- client C: paid, no state, no name
  adm    uuid := gen_random_uuid();   -- an admin: "María Fernanda" "García López"
  d      uuid := gen_random_uuid();   -- client D: paid, Thüringen, "Ana" "Ruiz"
  -- migration 7 (set up in its own section near the end)
  ce     uuid := gen_random_uuid();   -- client E: paid, Bayern, the other test route
  cf     uuid := gen_random_uuid();   -- client F: paid, Thüringen, B's route
  cg     uuid := gen_random_uuid();   -- client G: paid, Bayern, B's route (exactly like B)
  -- test content
  item_active    uuid;
  item_archived  uuid;
  item_other_state  uuid;   -- for Thüringen, on client B's route
  item_other_route  uuid;   -- for Bayern, on another route
  test_items     uuid[];    -- the four test items above
  n_free         uuid;   -- published, for Bayern, free for everyone
  n_paid         uuid;   -- published, for Bayern, paid_only (by default)
  n_draft        uuid;   -- not published
  n_future       uuid;   -- published, but its date is tomorrow
  n_all          uuid;   -- published, for all states, free for everyone
  n_other        uuid;   -- published, for Thüringen, free for everyone
  p_adm          uuid;   -- community post by the admin
  p_b            uuid;   -- community post by client B
  p_c1           uuid;   -- community post by client C, before C has a name
  p_c2           uuid;   -- community post by client C, after setting a first name
  p_b_chat       uuid;   -- client B's message in Bayern's chat
  p_d_chat       uuid;   -- client D's message in Thüringen's chat
  -- test files (migration 5): "<post id>/<uuid>.<ending>" in the bucket
  -- news-files, one per test post, each with a news_attachments row...
  f_free         text;
  f_paid         text;
  f_draft        text;
  f_future       text;
  f_all          text;
  f_other        text;
  -- ...and one in the paid Bayern post's folder with NO row
  f_orphan       text;
  test_files     text[];   -- the seven test files above
  -- small copies of photos (migration 6), in the same folders: one for each
  -- test photo above (free, paid, draft, Thüringen)...
  t_free         text;
  t_paid         text;
  t_draft        text;
  t_other        text;
  -- ...a photo with a small copy in the future post (its other file is a PDF)...
  fp_future      text;
  t_future       text;
  -- ...and a photo with a small copy in the paid Bayern post whose row the
  -- admin removes, leaving both files behind
  f_removed      text;
  t_removed      text;
  thumb_files    text[];   -- the eight files of migration 6 above
  -- client documents (migration 8): "<client id>/<uuid>.pdf" in the bucket
  -- client-files. B has two with a row and one with NO row; G and A (free)
  -- one each, with a row.
  doc_b1         text;
  doc_b2         text;
  doc_b_orphan   text;
  doc_g          text;
  doc_a          text;
  doc_files      text[];   -- the five files above
  names          text[];
  -- the 16 state codes (the same list as public.state_code in migration 1)
  states  text[] := array['bw', 'by', 'be', 'bb', 'hb', 'hh', 'he', 'mv',
                          'ni', 'nw', 'rp', 'sl', 'sn', 'st', 'sh', 'th'];
  s       text;          -- one state code, in loops
  -- helpers
  all_news  uuid[];      -- every test news post
  rc     bigint;         -- rows changed by the last statement
  cnt    bigint;
  txt    text;
  fn     text;
  rel    text;
  i      int;            -- loop counter
  ok     int := 0;       -- passed checks
begin
  -- ---------------------------------------------------------------------------
  -- Setup, as you (postgres) in the SQL Editor
  -- ---------------------------------------------------------------------------
  insert into auth.users (instance_id, id, aud, role, email,
                          raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', a,   'authenticated', 'authenticated',
     'rls-test-a@example.invalid',     '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', b,   'authenticated', 'authenticated',
     'rls-test-b@example.invalid',     '{}',
     '{"first_name": "José", "last_names": "Pérez García"}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', c,   'authenticated', 'authenticated',
     'rls-test-c@example.invalid',     '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', adm, 'authenticated', 'authenticated',
     'rls-test-admin@example.invalid', '{}',
     '{"first_name": "María Fernanda", "last_names": "García López"}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', d,   'authenticated', 'authenticated',
     'rls-test-d@example.invalid',     '{}',
     '{"first_name": "Ana", "last_names": "Ruiz"}', now(), now());

  -- CHECK: a profile was created automatically for each new login
  select count(*) into cnt from public.profiles
   where id in (a, b, c, adm) and plan = 'free' and not is_admin
     and email like 'rls-test-%@example.invalid';
  if cnt <> 4 then raise exception 'FAIL: new logins did not get a free, non-admin profile each'; end if;
  ok := ok + 1;

  -- CHECK: first_name and last_names were copied from the invite's data
  select count(*) into cnt from public.profiles
   where id = b and first_name = 'José' and last_names = 'Pérez García';
  if cnt <> 1 then raise exception 'FAIL: a new login did not get first_name and last_names from the invite'; end if;
  select count(*) into cnt from public.profiles
   where id = a and first_name is null and last_names is null;
  if cnt <> 1 then raise exception 'FAIL: a login invited without a name did not get empty names'; end if;
  ok := ok + 1;

  -- CHECK: logged-out visitors may run no function in the private schema,
  -- and nobody may call a trigger function directly
  for fn in
    select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace = 'private'::regnamespace
       and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    raise exception 'FAIL: logged-out visitors may run the function %', fn;
  end loop;
  for fn in
    select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace = 'private'::regnamespace
       and p.prorettype = 'trigger'::regtype
       and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  loop
    raise exception 'FAIL: logged-in users may call the trigger function % directly', fn;
  end loop;
  if not has_function_privilege('authenticated', 'private.my_state()', 'EXECUTE') then
    raise exception 'FAIL: logged-in users may not run private.my_state(), which the news rule needs';
  end if;
  ok := ok + 1;

  -- CHECK: logged-in users may run private.my_route(), which the checklist
  -- rule needs (the loop above already proves logged-out visitors can't)
  if not has_function_privilege('authenticated', 'private.my_route()', 'EXECUTE') then
    raise exception 'FAIL: logged-in users may not run private.my_route(), which the checklist rule needs';
  end if;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Safety nets on the whole database (not only the test rows)
  -- ---------------------------------------------------------------------------
  -- CHECK: every table in public has Row Level Security switched on
  for rel in
    select c.oid::regclass::text from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'p')            -- tables and partitioned tables
       and not c.relrowsecurity
  loop
    raise exception 'FAIL: the table % has Row Level Security switched off', rel;
  end loop;
  ok := ok + 1;

  -- CHECK: logged-out visitors have no rights at all on any table or view in
  -- public, not even on single columns
  for rel in
    select c.oid::regclass::text from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'p', 'v', 'm', 'f')
       and (has_table_privilege('anon', c.oid,
              'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
            or has_any_column_privilege('anon', c.oid,
              'SELECT, INSERT, UPDATE, REFERENCES'))
  loop
    raise exception 'FAIL: logged-out visitors have rights on %', rel;
  end loop;
  ok := ok + 1;

  -- CHECK: every SECURITY DEFINER function in our schemas (public, private)
  -- has a fixed search_path, so nobody can trick it with a look-alike table
  for fn in
    select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
       and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
                        where cfg like 'search_path=%')
  loop
    raise exception 'FAIL: the SECURITY DEFINER function % has no fixed search_path', fn;
  end loop;
  ok := ok + 1;

  -- CHECK: there are no views in public (a view can skip the RLS rules of the
  -- tables it reads)
  for rel in
    select c.oid::regclass::text from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('v', 'm')
  loop
    raise exception 'FAIL: public has the view %', rel;
  end loop;
  ok := ok + 1;

  -- CHECK: nobody may change is_admin through the website, but admins can
  -- still change the columns the admin screens send
  if has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE')
  or has_column_privilege('anon', 'public.profiles', 'is_admin', 'UPDATE') then
    raise exception 'FAIL: the website has the right to change is_admin';
  end if;
  if not (has_column_privilege('authenticated', 'public.profiles', 'main_state', 'UPDATE')
      and has_column_privilege('authenticated', 'public.profiles', 'route', 'UPDATE')
      and has_column_privilege('authenticated', 'public.profiles', 'plan', 'UPDATE')
      and has_column_privilege('authenticated', 'public.profiles', 'first_name', 'UPDATE')
      and has_column_privilege('authenticated', 'public.profiles', 'last_names', 'UPDATE')) then
    raise exception 'FAIL: the website lost the right to change main_state, route, plan or the names';
  end if;
  ok := ok + 1;

  -- CHECK: on community posts, the website may send only the text and the
  -- state: not the "Equipo MNL" field, the author, the name, the date or the id
  if not (has_column_privilege('authenticated', 'public.community_posts', 'body', 'INSERT')
      and has_column_privilege('authenticated', 'public.community_posts', 'state', 'INSERT')) then
    raise exception 'FAIL: the website may not send the text or the state of a community post';
  end if;
  if has_column_privilege('authenticated', 'public.community_posts', 'is_staff', 'INSERT')
  or has_column_privilege('authenticated', 'public.community_posts', 'author_id', 'INSERT')
  or has_column_privilege('authenticated', 'public.community_posts', 'author_name', 'INSERT')
  or has_column_privilege('authenticated', 'public.community_posts', 'created_at', 'INSERT')
  or has_column_privilege('authenticated', 'public.community_posts', 'id', 'INSERT')
  or has_any_column_privilege('authenticated', 'public.community_posts', 'UPDATE') then
    raise exception 'FAIL: the website may send more than the text and the state of a community post, or edit posts';
  end if;
  ok := ok + 1;

  -- CHECK: the website's roles (logged out and logged in) can't run Supabase's
  -- public.rls_auto_enable(). Where that function doesn't exist (the local
  -- test database), there is nothing to run.
  if to_regprocedure('public.rls_auto_enable()') is not null
     and (has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
       or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')) then
    raise exception 'FAIL: the website''s roles can run public.rls_auto_enable()';
  end if;
  ok := ok + 1;

  -- CHECK: on news_attachments the website may change only sort_order, and
  -- may not send the id or the date (the database sets them)
  if not (has_column_privilege('authenticated', 'public.news_attachments', 'post_id', 'INSERT')
      and has_column_privilege('authenticated', 'public.news_attachments', 'path', 'INSERT')
      and has_column_privilege('authenticated', 'public.news_attachments', 'sort_order', 'UPDATE')) then
    raise exception 'FAIL: the website lost the right to add attachments or change their order';
  end if;
  if has_column_privilege('authenticated', 'public.news_attachments', 'id', 'INSERT')
  or has_column_privilege('authenticated', 'public.news_attachments', 'created_at', 'INSERT')
  or has_column_privilege('authenticated', 'public.news_attachments', 'post_id', 'UPDATE')
  or has_column_privilege('authenticated', 'public.news_attachments', 'kind', 'UPDATE')
  or has_column_privilege('authenticated', 'public.news_attachments', 'path', 'UPDATE')
  or has_column_privilege('authenticated', 'public.news_attachments', 'file_name', 'UPDATE')
  or has_column_privilege('authenticated', 'public.news_attachments', 'description', 'UPDATE') then
    raise exception 'FAIL: the website may send more than it should on news_attachments';
  end if;
  ok := ok + 1;

  -- CHECK (migration 6): the website may send a small copy's path when it
  -- adds a row, but never change it afterwards
  if not has_column_privilege('authenticated', 'public.news_attachments', 'thumb_path', 'INSERT') then
    raise exception 'FAIL: the website may not send thumb_path when it adds an attachment';
  end if;
  if has_column_privilege('authenticated', 'public.news_attachments', 'thumb_path', 'UPDATE')
  or has_column_privilege('anon', 'public.news_attachments', 'thumb_path', 'INSERT') then
    raise exception 'FAIL: thumb_path can be changed, or sent by a logged-out visitor';
  end if;
  ok := ok + 1;

  -- CHECK: the bucket news-files is private, at most 10 MB per file, and
  -- takes only JPEG, PNG, WebP and PDF
  select count(*) into cnt from storage.buckets
   where id = 'news-files'
     and public is false
     and file_size_limit = 10485760
     and cardinality(allowed_mime_types) = 4
     and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if cnt <> 1 then
    raise exception 'FAIL: the bucket news-files is missing, public, or has the wrong size limit or file types';
  end if;
  ok := ok + 1;

  -- CHECK: storage.objects has Row Level Security on, and the four rules of
  -- migration 5 (read, upload, update, delete)
  select count(*) into cnt from pg_class
   where oid = 'storage.objects'::regclass and relrowsecurity;
  if cnt <> 1 then raise exception 'FAIL: storage.objects has Row Level Security switched off'; end if;
  select count(*) into cnt from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'news-files:%';
  if cnt <> 4 then raise exception 'FAIL: storage.objects has % news-files rules instead of 4', cnt; end if;
  ok := ok + 1;

  -- Supabase may refuse to delete storage rows with plain SQL ("use the
  -- Storage API instead"). This lets the test remove its own test files.
  -- It lasts only until the end of this test run.
  perform set_config('storage.allow_delete_query', 'true', true);

  -- You can make someone an admin from the SQL Editor
  update public.profiles set is_admin = true where id = adm;

  -- CHECK: the SQL Editor (you, postgres) can give and take away is_admin
  select count(*) into cnt from public.profiles where id = adm and is_admin;
  if cnt <> 1 then raise exception 'FAIL: the SQL Editor could not make the admin an admin'; end if;
  update public.profiles set is_admin = true  where id = c;
  update public.profiles set is_admin = false where id = c;
  select count(*) into cnt from public.profiles where id = c and not is_admin;
  if cnt <> 1 then raise exception 'FAIL: the SQL Editor could not take away is_admin'; end if;
  ok := ok + 1;

  -- Test content (also created by you, so the checks below don't depend on it)
  insert into public.routes (code, name) values ('rls-test-route', 'Ruta de prueba');
  insert into public.checklist_items (code, state, route, title)
    values ('rls-test-001', 'by', 'rls-test-route', 'Prueba activa')
    returning id into item_active;
  insert into public.checklist_items (code, state, route, title, archived)
    values ('rls-test-002', 'by', 'rls-test-route', 'Prueba archivada', true)
    returning id into item_archived;
  insert into public.routes (code, name) values ('rls-test-route-otra', 'Otra ruta de prueba');
  insert into public.checklist_items (code, state, route, title)
    values ('rls-test-004', 'th', 'rls-test-route', 'Prueba de otro estado')
    returning id into item_other_state;
  insert into public.checklist_items (code, state, route, title)
    values ('rls-test-005', 'by', 'rls-test-route-otra', 'Prueba de otra ruta')
    returning id into item_other_route;
  test_items := array[item_active, item_archived, item_other_state, item_other_route];
  insert into public.news_posts (title, state, published, paid_only)
    values ('[rls-test] gratis', 'by', true, false) returning id into n_free;
  insert into public.news_posts (title, state, published, paid_only)
    values ('[rls-test] de pago', 'by', true, true) returning id into n_paid;
  insert into public.news_posts (title, state, published, paid_only)
    values ('[rls-test] borrador', 'by', false, false) returning id into n_draft;
  insert into public.news_posts (title, state, published, paid_only, published_at)
    values ('[rls-test] futuro', 'by', true, false, now() + interval '1 day')
    returning id into n_future;
  insert into public.news_posts (title, state, published, paid_only)
    values ('[rls-test] todos los estados', null, true, false) returning id into n_all;
  insert into public.news_posts (title, state, published, paid_only)
    values ('[rls-test] Thüringen', 'th', true, false) returning id into n_other;
  all_news := array[n_free, n_paid, n_draft, n_future, n_all, n_other];
  -- Client D: paid, Thüringen (for the state chat checks)
  update public.profiles set plan = 'paid', main_state = 'th' where id = d;

  -- ===========================================================================
  -- As the ADMIN (logged in on the website)
  -- ===========================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: admin can add a route, a checklist item and a news post
  insert into public.routes (code, name) values ('rls-test-route-2', 'Ruta de prueba 2');
  insert into public.checklist_items (code, state, route, title)
    values ('rls-test-003', 'th', 'rls-test-route-2', 'Prueba del admin');
  insert into public.news_posts (title, state) values ('[rls-test] del admin', 'th');
  ok := ok + 1;

  -- CHECK: a new news post is paid_only (and not published) unless the admin changes it
  select count(*) into cnt from public.news_posts
   where title = '[rls-test] del admin' and paid_only and not published;
  if cnt <> 1 then raise exception 'FAIL: a new news post is not paid_only and unpublished by default'; end if;
  ok := ok + 1;

  -- CHECK: admin can change another user's plan, main state and route
  update public.profiles
     set plan = 'paid', main_state = 'by', route = 'rls-test-route'
   where id = b;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not change client B''s plan/state/route'; end if;
  update public.profiles set plan = 'paid' where id = c;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not change client C''s plan'; end if;
  ok := ok + 1;

  -- CHECK: admin can post on the board; the name comes from first_name and
  -- last_names ("María Fernanda" + "García López" -> "María G.")
  insert into public.community_posts (body) values ('Bienvenidos al tablón')
    returning id into p_adm;
  select author_name into txt from public.community_posts where id = p_adm;
  if txt is distinct from 'María G.' then
    raise exception 'FAIL: admin''s author name is "%" instead of "María G."', txt;
  end if;
  ok := ok + 1;

  -- CHECK: the admin's board post has an empty state and is marked as staff
  -- ("Equipo MNL") by the database
  select count(*) into cnt from public.community_posts
   where id = p_adm and state is null and is_staff;
  if cnt <> 1 then raise exception 'FAIL: the admin''s board post is not on the board, or not marked as staff'; end if;
  ok := ok + 1;

  -- CHECK: the admin (who has no state) posts in the chat of each of the 16
  -- states, and each message is marked as staff
  begin
    foreach s in array states loop
      insert into public.community_posts (body, state) values ('[rls-test] chat ' || s, s);
    end loop;
  exception when sqlstate 'PT429' then
    raise exception 'FAIL: the speed limit stopped the admin';
  end;
  select count(distinct state) into cnt from public.community_posts
   where author_id = adm and state is not null and is_staff;
  if cnt <> 16 then raise exception 'FAIL: the admin posted staff messages in % state chats instead of 16', cnt; end if;
  ok := ok + 1;

  -- CHECK: admins are exempt from the speed limit: that was 17 posts in one
  -- minute, and three more still go through
  begin
    insert into public.community_posts (body)
      select '[rls-test] aviso ' || g from generate_series(1, 3) g;
  exception when sqlstate 'PT429' then
    raise exception 'FAIL: the speed limit stopped the admin';
  end;
  select count(*) into cnt from public.community_posts
   where author_id = adm and created_at > now() - interval '1 minute';
  if cnt <> 20 then raise exception 'FAIL: the admin has % posts within a minute instead of 20', cnt; end if;
  ok := ok + 1;

  -- CHECK: even an admin cannot set the staff field themselves
  begin
    insert into public.community_posts (body, is_staff) values ('x', false);
    raise exception 'FAIL: admin set is_staff on a post';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- ---------------------------------------------------------------------------
  -- Photos and PDFs of news posts (migration 5), still as the admin
  -- ---------------------------------------------------------------------------
  -- One test file per test news post, added the way the website does it:
  -- first the file (a row in storage.objects, which is what the Storage
  -- service writes on upload), then its news_attachments row. Plus one file
  -- with NO row, in the paid Bayern post's folder: like an upload whose row
  -- was never saved, or a file whose row was removed but the file wasn't.
  f_free   := n_free::text   || '/' || gen_random_uuid()::text || '.jpg';
  f_paid   := n_paid::text   || '/' || gen_random_uuid()::text || '.png';
  f_draft  := n_draft::text  || '/' || gen_random_uuid()::text || '.webp';
  f_future := n_future::text || '/' || gen_random_uuid()::text || '.pdf';
  f_all    := n_all::text    || '/' || gen_random_uuid()::text || '.pdf';
  f_other  := n_other::text  || '/' || gen_random_uuid()::text || '.jpg';
  f_orphan := n_paid::text   || '/' || gen_random_uuid()::text || '.jpg';
  test_files := array[f_free, f_paid, f_draft, f_future, f_all, f_other, f_orphan];
  -- Small copies are always ".jpg" (migration 6)
  t_free    := n_free::text   || '/' || gen_random_uuid()::text || '.jpg';
  t_paid    := n_paid::text   || '/' || gen_random_uuid()::text || '.jpg';
  t_draft   := n_draft::text  || '/' || gen_random_uuid()::text || '.jpg';
  t_other   := n_other::text  || '/' || gen_random_uuid()::text || '.jpg';
  fp_future := n_future::text || '/' || gen_random_uuid()::text || '.jpg';
  t_future  := n_future::text || '/' || gen_random_uuid()::text || '.jpg';
  f_removed := n_paid::text   || '/' || gen_random_uuid()::text || '.jpg';
  t_removed := n_paid::text   || '/' || gen_random_uuid()::text || '.jpg';
  thumb_files := array[t_free, t_paid, t_draft, t_other, fp_future, t_future, f_removed, t_removed];

  -- CHECK: admin can upload files to the bucket and add their rows
  insert into storage.objects (bucket_id, name)
    select 'news-files', unnest(test_files);
  get diagnostics rc = row_count;
  if rc <> 7 then raise exception 'FAIL: admin uploaded % of 7 test files', rc; end if;
  -- The small copies of the photos (migration 6) are uploaded too, before
  -- the rows, the way the website does it: photo, small copy, then the row
  insert into storage.objects (bucket_id, name)
    select 'news-files', unnest(thumb_files);
  get diagnostics rc = row_count;
  if rc <> 8 then raise exception 'FAIL: admin uploaded % of 8 test files of migration 6', rc; end if;
  insert into public.news_attachments (post_id, kind, path, file_name, description, sort_order, thumb_path)
  values (n_free,   'image', f_free,   'foto.jpg',      'Una foto de prueba', 0, t_free),
         (n_paid,   'image', f_paid,   'captura.png',   null, 0, t_paid),
         (n_draft,  'image', f_draft,  'borrador.webp', null, 0, t_draft),
         (n_future, 'pdf',   f_future, 'futuro.pdf',    null, 0, null),
         (n_all,    'pdf',   f_all,    'todos.pdf',     null, 0, null),
         (n_other,  'image', f_other,  'thueringen.jpg', null, 0, t_other);
  get diagnostics rc = row_count;
  if rc <> 6 then raise exception 'FAIL: admin added % of 6 attachment rows', rc; end if;
  ok := ok + 1;

  -- CHECK (migration 6): admin adds a photo with a small copy to the future
  -- post, and one to the paid Bayern post; then removes the second one's
  -- row the way the website starts removing a photo (row first). Its two
  -- files stay behind, like when deleting the files fails.
  insert into public.news_attachments (post_id, kind, path, file_name, sort_order, thumb_path)
  values (n_future, 'image', fp_future, 'futura.jpg',  1, t_future),
         (n_paid,   'image', f_removed, 'quitada.jpg', 1, t_removed);
  get diagnostics rc = row_count;
  if rc <> 2 then raise exception 'FAIL: admin added % of 2 photo rows with a small copy', rc; end if;
  delete from public.news_attachments where path = f_removed;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not remove the row of a photo with a small copy'; end if;
  ok := ok + 1;

  -- CHECK (migration 6): not even an admin can change a small copy's path
  begin
    update public.news_attachments set thumb_path = null where path = f_free;
    raise exception 'FAIL: admin changed the small copy of an attachment';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: admin can change the order of a post's files, but nothing else
  -- of an attachment row (not its post, path, kind or name)
  update public.news_attachments set sort_order = 1 where path = f_free;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not change the order of a file'; end if;
  begin
    update public.news_attachments set path = f_orphan where path = f_free;
    raise exception 'FAIL: admin changed the path of an attachment';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.news_attachments set file_name = 'otro.jpg' where path = f_free;
    raise exception 'FAIL: admin changed the file name of an attachment';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: the bucket refuses badly named files, even from an admin: the
  -- uploaded file's own name, a folder that isn't a post, a folder that
  -- isn't a uuid at all, a sub-folder, or another ending (SVG, HTML)
  names := array[
    n_free::text || '/foto-de-maria.jpg',
    gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.jpg',
    'no-es-un-uuid/' || gen_random_uuid()::text || '.jpg',
    n_free::text || '/carpeta/' || gen_random_uuid()::text || '.jpg',
    n_free::text || '/' || gen_random_uuid()::text || '.svg',
    n_free::text || '/' || gen_random_uuid()::text || '.html',
    n_free::text || '/' || upper(gen_random_uuid()::text) || '.jpg'];
  foreach txt in array names loop
    begin
      insert into storage.objects (bucket_id, name) values ('news-files', txt);
      raise exception 'FAIL: admin uploaded a file named %', txt;
    exception when insufficient_privilege then null;
    end;
  end loop;
  ok := ok + 1;

  -- CHECK: an attachment row must point into its own post's folder, with a
  -- uuid as the name and an ending that matches its kind; file_name 1 to 200
  -- characters; description empty or 1 to 200 characters
  for i in 1 .. 7 loop
    begin
      case i
        when 1 then  -- another post's folder
          insert into public.news_attachments (post_id, kind, path, file_name)
            values (n_free, 'image', n_paid::text || '/' || gen_random_uuid()::text || '.jpg', 'x.jpg');
        when 2 then  -- the uploaded file's own name in the path
          insert into public.news_attachments (post_id, kind, path, file_name)
            values (n_free, 'image', n_free::text || '/foto.jpg', 'foto.jpg');
        when 3 then  -- a photo with a .pdf ending
          insert into public.news_attachments (post_id, kind, path, file_name)
            values (n_free, 'image', n_free::text || '/' || gen_random_uuid()::text || '.pdf', 'x.pdf');
        when 4 then  -- a PDF with a .jpg ending
          insert into public.news_attachments (post_id, kind, path, file_name)
            values (n_free, 'pdf', n_free::text || '/' || gen_random_uuid()::text || '.jpg', 'x.jpg');
        when 5 then  -- file name of 201 characters
          insert into public.news_attachments (post_id, kind, path, file_name)
            values (n_free, 'pdf', n_free::text || '/' || gen_random_uuid()::text || '.pdf', repeat('a', 197) || '.pdf');
        when 6 then  -- empty file name
          insert into public.news_attachments (post_id, kind, path, file_name)
            values (n_free, 'pdf', n_free::text || '/' || gen_random_uuid()::text || '.pdf', '');
        when 7 then  -- empty description (no description is NULL)
          insert into public.news_attachments (post_id, kind, path, file_name, description)
            values (n_free, 'image', n_free::text || '/' || gen_random_uuid()::text || '.jpg', 'x.jpg', '');
      end case;
      raise exception 'FAIL: news_attachments accepted bad row number % of this check', i;
    exception when check_violation then null;
    end;
  end loop;
  ok := ok + 1;

  -- CHECK (migration 6): a small copy only belongs to a photo, in its own
  -- post's folder, as "<uuid>.jpg" in lowercase, and is never the photo
  -- itself
  for i in 1 .. 5 loop
    begin
      case i
        when 1 then  -- a PDF with a small copy
          insert into public.news_attachments (post_id, kind, path, file_name, thumb_path)
            values (n_free, 'pdf', n_free::text || '/' || gen_random_uuid()::text || '.pdf', 'x.pdf',
                    n_free::text || '/' || gen_random_uuid()::text || '.jpg');
        when 2 then  -- the small copy in another post's folder
          insert into public.news_attachments (post_id, kind, path, file_name, thumb_path)
            values (n_free, 'image', n_free::text || '/' || gen_random_uuid()::text || '.jpg', 'x.jpg',
                    n_paid::text || '/' || gen_random_uuid()::text || '.jpg');
        when 3 then  -- the small copy is the photo itself
          txt := n_free::text || '/' || gen_random_uuid()::text || '.jpg';
          insert into public.news_attachments (post_id, kind, path, file_name, thumb_path)
            values (n_free, 'image', txt, 'x.jpg', txt);
        when 4 then  -- a small copy that isn't a .jpg
          insert into public.news_attachments (post_id, kind, path, file_name, thumb_path)
            values (n_free, 'image', n_free::text || '/' || gen_random_uuid()::text || '.jpg', 'x.jpg',
                    n_free::text || '/' || gen_random_uuid()::text || '.png');
        when 5 then  -- a small copy in capitals
          insert into public.news_attachments (post_id, kind, path, file_name, thumb_path)
            values (n_free, 'image', n_free::text || '/' || gen_random_uuid()::text || '.jpg', 'x.jpg',
                    n_free::text || '/' || upper(gen_random_uuid()::text) || '.jpg');
      end case;
      raise exception 'FAIL: news_attachments accepted bad small copy number % of this check', i;
    exception when check_violation then null;
    end;
  end loop;
  ok := ok + 1;

  -- ===========================================================================
  -- As CLIENT A (free plan, no state yet)
  -- ===========================================================================
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: A sees exactly one profile, their own
  select count(*) into cnt from public.profiles;
  if cnt <> 1 then raise exception 'FAIL: client A sees % profiles instead of only their own', cnt; end if;
  select count(*) into cnt from public.profiles where id = a;
  if cnt <> 1 then raise exception 'FAIL: client A cannot see their own profile'; end if;
  ok := ok + 1;

  -- CHECK: A can change their own first name and last names
  update public.profiles set first_name = 'Cliente', last_names = 'A' where id = a;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: client A could not change their own name'; end if;
  ok := ok + 1;

  -- CHECK: A cannot change client B's profile
  update public.profiles set first_name = 'hacked' where id = b;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client A changed client B''s profile'; end if;
  ok := ok + 1;

  -- CHECK: A cannot make themselves paid
  begin
    update public.profiles set plan = 'paid' where id = a;
    raise exception 'FAIL: client A changed their own plan';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: A cannot make themselves admin
  begin
    update public.profiles set is_admin = true where id = a;
    raise exception 'FAIL: client A made themselves admin';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: A cannot change their own route
  begin
    update public.profiles set route = 'rls-test-route' where id = a;
    raise exception 'FAIL: client A changed their own route';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: A, with no state chosen, sees no news at all, not even the free
  -- Bayern post or the free all-states post
  select count(*) into cnt from public.news_posts where id = any (all_news);
  if cnt <> 0 then raise exception 'FAIL: client A, with no state, sees % test news posts instead of 0', cnt; end if;
  ok := ok + 1;

  -- CHECK: A cannot choose a state that doesn't exist
  begin
    update public.profiles set main_state = 'xx' where id = a;
    raise exception 'FAIL: client A chose a state that doesn''t exist';
  exception when check_violation then ok := ok + 1;
  end;

  -- CHECK: A can choose their state once, while it is empty
  update public.profiles set main_state = 'by' where id = a;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: client A could not choose their state'; end if;
  ok := ok + 1;

  -- CHECK: once chosen, A can't change it or clear it
  begin
    update public.profiles set main_state = 'nw' where id = a;
    raise exception 'FAIL: client A changed their state after choosing it';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.profiles set main_state = null where id = a;
    raise exception 'FAIL: client A cleared their state after choosing it';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: A (free, Bayern) now sees only the free, published, current news
  -- for Bayern and for all states; not Thüringen's post
  select count(*) into cnt from public.news_posts where id = any (all_news);
  if cnt <> 2 then raise exception 'FAIL: free client A (Bayern) sees % test news posts instead of 2', cnt; end if;
  select count(*) into cnt from public.news_posts where id in (n_free, n_all);
  if cnt <> 2 then raise exception 'FAIL: free client A cannot see the free Bayern post and the all-states post'; end if;
  ok := ok + 1;

  -- CHECK: A (free, Bayern) reads the files (rows and stored files) of
  -- exactly those two posts: the free Bayern post and the all-states post
  select count(*) into cnt from public.news_attachments where path = any (test_files);
  if cnt <> 2 then raise exception 'FAIL: free client A reads % test attachment rows instead of 2', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = any (test_files);
  if cnt <> 2 then raise exception 'FAIL: free client A reads % test files instead of 2', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name in (f_free, f_all);
  if cnt <> 2 then raise exception 'FAIL: free client A cannot read the files of the free and the all-states post'; end if;
  ok := ok + 1;

  -- CHECK: A (free) can't read the file of the paid-only Bayern post
  select count(*) into cnt from public.news_attachments where path = f_paid;
  if cnt <> 0 then raise exception 'FAIL: free client A reads the attachment row of a paid-only post'; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = f_paid;
  if cnt <> 0 then raise exception 'FAIL: free client A reads the file of a paid-only post'; end if;
  ok := ok + 1;

  -- CHECK (migration 6): A reads the small copy of exactly the photo A can
  -- read (the free Bayern post's), not the paid-only post's
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = any (thumb_files);
  if cnt <> 1 then raise exception 'FAIL: free client A reads % small copies instead of 1', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = t_free;
  if cnt <> 1 then raise exception 'FAIL: free client A cannot read the small copy of a photo they can see'; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = t_paid;
  if cnt <> 0 then raise exception 'FAIL: free client A reads the small copy of a paid-only photo'; end if;
  ok := ok + 1;

  -- CHECK: A cannot change their profile's email copy or create/delete profiles
  begin
    update public.profiles set email = 'other@example.invalid' where id = a;
    raise exception 'FAIL: client A changed the email in their profile';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.profiles (id) values (gen_random_uuid());
    raise exception 'FAIL: client A created a profile';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    delete from public.profiles where id = a;
    raise exception 'FAIL: client A deleted a profile';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: A (free) cannot read any checklist item
  select count(*) into cnt from public.checklist_items
   where id in (item_active, item_archived);
  if cnt <> 0 then raise exception 'FAIL: free client A can read checklist items'; end if;
  ok := ok + 1;

  -- CHECK: A (free) cannot tick a checklist item
  begin
    insert into public.progress (user_id, item_id) values (a, item_active);
    raise exception 'FAIL: free client A ticked a checklist item';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: A cannot write routes, checklist items or news
  begin
    insert into public.routes (code, name) values ('rls-test-hack', 'x');
    raise exception 'FAIL: client A added a route';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.checklist_items (state, route, title) values ('by', 'rls-test-route', 'x');
    raise exception 'FAIL: client A added a checklist item';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.news_posts (title, state) values ('x', 'by');
    raise exception 'FAIL: client A added a news post';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  update public.news_posts set title = 'hacked' where id = n_free;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client A changed a news post'; end if;
  delete from public.news_posts where id = n_free;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client A deleted a news post'; end if;
  ok := ok + 1;

  -- CHECK: A (free) cannot read the community board...
  select count(*) into cnt from public.community_posts;
  if cnt <> 0 then raise exception 'FAIL: free client A can read % community posts', cnt; end if;
  ok := ok + 1;
  -- ...cannot post on it...
  begin
    insert into public.community_posts (body) values ('Hola');
    raise exception 'FAIL: free client A posted on the community board';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  -- ...and cannot delete someone else's post
  delete from public.community_posts where id = p_adm;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: free client A deleted the admin''s community post'; end if;
  ok := ok + 1;

  -- CHECK: A (free, Bayern) sees nothing of Bayern's chat and cannot post in it
  select count(*) into cnt from public.community_posts where state = 'by';
  if cnt <> 0 then raise exception 'FAIL: free client A can read % messages of their state''s chat', cnt; end if;
  begin
    insert into public.community_posts (body, state) values ('Hola', 'by');
    raise exception 'FAIL: free client A posted in their state''s chat';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- ===========================================================================
  -- As CLIENT B (paid plan, Bayern set by the admin)
  -- ===========================================================================
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: B cannot change the state the admin set
  begin
    update public.profiles set main_state = 'nw' where id = b;
    raise exception 'FAIL: client B changed the state the admin set';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: B (paid) reads the active checklist item but not the archived one
  select count(*) into cnt from public.checklist_items where id = item_active;
  if cnt <> 1 then raise exception 'FAIL: paid client B cannot read an active checklist item'; end if;
  select count(*) into cnt from public.checklist_items where id = item_archived;
  if cnt <> 0 then raise exception 'FAIL: paid client B can read an archived checklist item'; end if;
  ok := ok + 1;

  -- CHECK: B (paid, Bayern, rls-test-route) reads only their own item: not
  -- Thüringen's item, and not the item for another route
  select count(*) into cnt from public.checklist_items where id = any (test_items);
  if cnt <> 1 then raise exception 'FAIL: paid client B reads % test checklist items instead of only their own', cnt; end if;
  select count(*) into cnt from public.checklist_items where id = item_other_state;
  if cnt <> 0 then raise exception 'FAIL: paid client B can read another state''s checklist item'; end if;
  select count(*) into cnt from public.checklist_items where id = item_other_route;
  if cnt <> 0 then raise exception 'FAIL: paid client B can read another route''s checklist item'; end if;
  ok := ok + 1;

  -- CHECK: B cannot tick another state's item or another route's item
  begin
    insert into public.progress (user_id, item_id) values (b, item_other_state);
    raise exception 'FAIL: client B ticked another state''s checklist item';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.progress (user_id, item_id) values (b, item_other_route);
    raise exception 'FAIL: client B ticked another route''s checklist item';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: B cannot send their own tick date
  begin
    insert into public.progress (user_id, item_id, done_at)
      values (b, item_active, '2000-01-01');
    raise exception 'FAIL: client B set done_at themselves';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: B ticks an item; the database sets the date
  insert into public.progress (user_id, item_id) values (b, item_active);
  select count(*) into cnt from public.progress
   where user_id = b and item_id = item_active and done_at > now() - interval '1 minute';
  if cnt <> 1 then raise exception 'FAIL: paid client B could not tick an item'; end if;
  ok := ok + 1;

  -- CHECK: B cannot tick for client A, nor tick an archived item
  begin
    insert into public.progress (user_id, item_id) values (a, item_active);
    raise exception 'FAIL: client B ticked an item for client A';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.progress (user_id, item_id) values (b, item_archived);
    raise exception 'FAIL: client B ticked an archived item';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: B (paid, Bayern) sees the free and paid Bayern posts and the
  -- all-states post; not the draft, the future post or Thüringen's post
  select count(*) into cnt from public.news_posts where id = any (all_news);
  if cnt <> 3 then raise exception 'FAIL: paid client B sees % test news posts instead of 3', cnt; end if;
  select count(*) into cnt from public.news_posts where id in (n_free, n_paid, n_all);
  if cnt <> 3 then raise exception 'FAIL: paid client B cannot see Bayern''s posts and the all-states post'; end if;
  ok := ok + 1;

  -- CHECK: B (paid, Bayern) reads the files of the free and the paid Bayern
  -- post and of the all-states post; not Thüringen's
  select count(*) into cnt from public.news_attachments where path = any (test_files);
  if cnt <> 3 then raise exception 'FAIL: paid client B reads % test attachment rows instead of 3', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = any (test_files);
  if cnt <> 3 then raise exception 'FAIL: paid client B reads % test files instead of 3', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name in (f_free, f_paid, f_all);
  if cnt <> 3 then raise exception 'FAIL: paid client B cannot read the files of the posts they can see'; end if;
  ok := ok + 1;

  -- CHECK: the files of a draft and of a scheduled (future) post are hidden
  -- from clients, rows and files alike
  select count(*) into cnt from public.news_attachments where path in (f_draft, f_future);
  if cnt <> 0 then raise exception 'FAIL: paid client B reads attachment rows of a draft or future post'; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name in (f_draft, f_future);
  if cnt <> 0 then raise exception 'FAIL: paid client B reads files of a draft or future post'; end if;
  ok := ok + 1;

  -- CHECK: a file in the folder of a post B can see, but with no
  -- attachment row, is invisible to B
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = f_orphan;
  if cnt <> 0 then raise exception 'FAIL: paid client B reads a file that has no attachment row'; end if;
  ok := ok + 1;

  -- CHECK: listing the paid Bayern post's folder (what the Storage service
  -- does for "list") shows B only the files of a row: the photo and its
  -- small copy (migration 6); not the file with no row, and not the two
  -- files whose row was removed
  select coalesce(array_agg(name order by name), '{}') into names from storage.objects
   where bucket_id = 'news-files' and name like n_paid::text || '/%';
  if names <> (select array_agg(x order by x) from unnest(array[f_paid, t_paid]) as x) then
    raise exception 'FAIL: listing a post''s folder shows paid client B % files instead of only the 2 with a row', cardinality(names);
  end if;
  ok := ok + 1;

  -- CHECK (migration 6): B (paid, Bayern) reads the small copies of exactly
  -- the photos B can read: the free and the paid Bayern post's; not
  -- Thüringen's
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = any (thumb_files);
  if cnt <> 2 then raise exception 'FAIL: paid client B reads % small copies instead of 2', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name in (t_free, t_paid);
  if cnt <> 2 then raise exception 'FAIL: paid client B cannot read the small copies of the photos they can see'; end if;
  ok := ok + 1;

  -- CHECK (migration 6): the small copies of a draft's photo and of a
  -- scheduled (future) post's photo are hidden from B, like the photos
  select count(*) into cnt from storage.objects
   where bucket_id = 'news-files' and name in (t_draft, fp_future, t_future);
  if cnt <> 0 then raise exception 'FAIL: paid client B reads % files of a draft or future photo', cnt; end if;
  ok := ok + 1;

  -- CHECK (migration 6): once a photo's row is removed, its small copy (and
  -- the photo) are invisible to B, although B can see the post
  select count(*) into cnt from storage.objects
   where bucket_id = 'news-files' and name in (f_removed, t_removed);
  if cnt <> 0 then raise exception 'FAIL: paid client B reads % files of a removed photo row', cnt; end if;
  ok := ok + 1;

  -- CHECK: B cannot upload a file or add an attachment row...
  begin
    insert into storage.objects (bucket_id, name)
      values ('news-files', n_free::text || '/' || gen_random_uuid()::text || '.jpg');
    raise exception 'FAIL: client B uploaded a file to news-files';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.news_attachments (post_id, kind, path, file_name)
      values (n_free, 'image', n_free::text || '/' || gen_random_uuid()::text || '.jpg', 'x.jpg');
    raise exception 'FAIL: client B added an attachment row';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: ...nor change or delete them, not even the ones B can read
  update public.news_attachments set sort_order = 9 where path in (f_free, f_paid);
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B changed the order of a file'; end if;
  delete from public.news_attachments where path in (f_free, f_paid);
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B deleted an attachment row'; end if;
  update storage.objects set name = n_free::text || '/' || gen_random_uuid()::text || '.jpg'
   where bucket_id = 'news-files' and name = f_free;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B renamed a file'; end if;
  update storage.objects set metadata = '{}'
   where bucket_id = 'news-files' and name = any (test_files);
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B changed a file'; end if;
  delete from storage.objects where bucket_id = 'news-files' and name = any (test_files);
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B deleted a file'; end if;
  ok := ok + 1;

  -- CHECK: B (paid) still cannot change or delete checklist items
  update public.checklist_items set title = 'hacked' where id = item_active;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B changed a checklist item'; end if;
  begin
    delete from public.checklist_items where id = item_archived;
    raise exception 'FAIL: client B deleted a checklist item';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: B cannot see client A's profile
  select count(*) into cnt from public.profiles where id = a;
  if cnt <> 0 then raise exception 'FAIL: client B can see client A''s profile'; end if;
  ok := ok + 1;

  -- CHECK: B (paid) reads the board, including the admin's post
  select count(*) into cnt from public.community_posts where id = p_adm;
  if cnt <> 1 then raise exception 'FAIL: paid client B cannot read the community board'; end if;
  ok := ok + 1;

  -- CHECK: B posts; the database trims the text and sets the author, the
  -- name ("José" + "Pérez García" -> "José P.") and the date
  insert into public.community_posts (body) values (E'  Hola desde Bayern \n ')
    returning id into p_b;
  select count(*) into cnt from public.community_posts
   where id = p_b and body = 'Hola desde Bayern' and author_id = b
     and author_name = 'José P.' and created_at > now() - interval '1 minute';
  if cnt <> 1 then raise exception 'FAIL: client B''s post did not get the trimmed text, author, "José P." and date'; end if;
  ok := ok + 1;

  -- CHECK: B cannot send the author, the author name or the date
  begin
    insert into public.community_posts (author_id, body) values (a, 'x');
    raise exception 'FAIL: client B set author_id on a post';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.community_posts (author_name, body) values ('Otra persona', 'x');
    raise exception 'FAIL: client B set author_name on a post';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.community_posts (created_at, body) values ('2000-01-01', 'x');
    raise exception 'FAIL: client B set created_at on a post';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: B cannot post an empty post, a post of only spaces, or a post
  -- over 2,000 characters; exactly 2,000 is fine
  begin
    insert into public.community_posts (body) values ('');
    raise exception 'FAIL: client B posted an empty post';
  exception when check_violation then ok := ok + 1;
  end;
  begin
    insert into public.community_posts (body) values (E'   \n\t  ');
    raise exception 'FAIL: client B posted a post of only spaces';
  exception when check_violation then ok := ok + 1;
  end;
  begin
    insert into public.community_posts (body) values (repeat('x', 2001));
    raise exception 'FAIL: client B posted a post over 2,000 characters';
  exception when check_violation then ok := ok + 1;
  end;
  insert into public.community_posts (body) values (repeat('x', 2000));
  ok := ok + 1;

  -- CHECK: B cannot edit their own post
  begin
    update public.community_posts set body = 'editado' where id = p_b;
    raise exception 'FAIL: client B edited their own post';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: B cannot delete the admin's post
  delete from public.community_posts where id = p_adm;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B deleted the admin''s post'; end if;
  ok := ok + 1;

  -- CHECK: B (paid, Bayern) sees the board plus only Bayern's chat: the
  -- admin's one message there, and no other state's messages
  select count(*) into cnt from public.community_posts
   where state is not null and author_id in (a, b, c, d, adm);
  if cnt <> 1 then raise exception 'FAIL: client B (Bayern) sees % test chat messages instead of 1', cnt; end if;
  select count(*) into cnt from public.community_posts where state <> 'by';
  if cnt <> 0 then raise exception 'FAIL: client B (Bayern) sees % messages of other states'' chats', cnt; end if;
  select count(*) into cnt from public.community_posts where state = 'by' and author_id = adm;
  if cnt <> 1 then raise exception 'FAIL: client B cannot see the admin''s message in Bayern''s chat'; end if;
  select count(*) into cnt from public.community_posts where state is null and id = p_adm;
  if cnt <> 1 then raise exception 'FAIL: client B lost the board'; end if;
  ok := ok + 1;

  -- CHECK: B posts in Bayern's chat; the database sets the name, and a
  -- member's posts (board and chat) are never marked as staff
  insert into public.community_posts (body, state) values ('Hola, Bayern', 'by')
    returning id into p_b_chat;
  select count(*) into cnt from public.community_posts
   where id = p_b_chat and state = 'by' and author_id = b
     and author_name = 'José P.' and not is_staff;
  if cnt <> 1 then raise exception 'FAIL: client B''s chat message did not get the state, author and name, or is marked as staff'; end if;
  select count(*) into cnt from public.community_posts where author_id = b and is_staff;
  if cnt <> 0 then raise exception 'FAIL: % of client B''s posts are marked as staff', cnt; end if;
  ok := ok + 1;

  -- CHECK: B cannot post in another state's chat
  begin
    insert into public.community_posts (body, state) values ('Hola, Thüringen', 'th');
    raise exception 'FAIL: client B posted in another state''s chat';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: B cannot post to a state that doesn't exist
  begin
    insert into public.community_posts (body, state) values ('x', 'xx');
    raise exception 'FAIL: client B posted to a state that doesn''t exist';
  exception when check_violation then ok := ok + 1;
  end;

  -- CHECK: B cannot set the staff field themselves, to true or to false
  begin
    insert into public.community_posts (body, is_staff) values ('Soy del equipo', true);
    raise exception 'FAIL: client B set is_staff on a board post';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.community_posts (body, state, is_staff) values ('x', 'by', false);
    raise exception 'FAIL: client B set is_staff on a chat message';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: in the chat too, B cannot delete the admin's message or edit their own
  delete from public.community_posts where state = 'by' and author_id = adm;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B deleted the admin''s chat message'; end if;
  begin
    update public.community_posts set body = 'editado' where id = p_b_chat;
    raise exception 'FAIL: client B edited their own chat message';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: speed limit. B has 3 posts so far in this minute (2 on the board,
  -- 1 in the chat). The 4th and 5th go through; the 6th is refused with the
  -- limit's own error (PT429), on the board and in the chat alike.
  select count(*) into cnt from public.community_posts
   where author_id = b and created_at > now() - interval '1 minute';
  if cnt <> 3 then raise exception 'FAIL: the test expected client B to have 3 posts so far, not %', cnt; end if;
  insert into public.community_posts (body) values ('[rls-test] cuarta');
  insert into public.community_posts (body, state) values ('[rls-test] quinta', 'by');
  begin
    insert into public.community_posts (body) values ('[rls-test] sexta');
    raise exception 'FAIL: client B''s 6th post within a minute went through (board)';
  exception when sqlstate 'PT429' then ok := ok + 1;
  end;
  begin
    insert into public.community_posts (body, state) values ('[rls-test] sexta', 'by');
    raise exception 'FAIL: client B''s 6th post within a minute went through (chat)';
  exception when sqlstate 'PT429' then ok := ok + 1;
  end;

  -- CHECK: deleting a post frees its place (the limit counts posts that
  -- still exist), and then the limit is reached again
  delete from public.community_posts where id = p_b_chat;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: client B could not delete their own chat message'; end if;
  insert into public.community_posts (body, state) values ('[rls-test] otra', 'by');
  begin
    insert into public.community_posts (body) values ('[rls-test] sexta');
    raise exception 'FAIL: client B''s 6th post within a minute went through after a delete';
  exception when sqlstate 'PT429' then ok := ok + 1;
  end;

  -- In the SQL Editor: move B's posts two minutes back in time, as if B had
  -- waited
  reset role;
  update public.community_posts set created_at = created_at - interval '2 minutes'
   where author_id = b and created_at > now() - interval '1 minute';
  set local role authenticated;

  -- CHECK: 6 posts sent in ONE request are refused too, and none of them is kept
  begin
    insert into public.community_posts (body)
      select '[rls-test] de golpe ' || g from generate_series(1, 6) g;
    raise exception 'FAIL: client B posted 6 posts in one request';
  exception when sqlstate 'PT429' then ok := ok + 1;
  end;
  select count(*) into cnt from public.community_posts
   where author_id = b and created_at > now() - interval '1 minute';
  if cnt <> 0 then raise exception 'FAIL: % posts of a refused request were kept', cnt; end if;

  -- CHECK: after the minute has passed, B can post again...
  insert into public.community_posts (body) values ('[rls-test] un minuto después');
  ok := ok + 1;

  -- CHECK: ...up to 100 posts in 24 hours. B has 6 by now. Add 94 more, five
  -- at a time, moving them back in time after each five (still inside the
  -- 24 hours). The 101st is refused although the last minute is empty.
  for i in 1 .. 19 loop
    reset role;
    update public.community_posts set created_at = created_at - interval '2 minutes'
     where author_id = b and created_at > now() - interval '1 minute';
    set local role authenticated;
    insert into public.community_posts (body)
      select '[rls-test] día ' || g from generate_series(1, case when i = 19 then 4 else 5 end) g;
  end loop;
  reset role;
  update public.community_posts set created_at = created_at - interval '2 minutes'
   where author_id = b and created_at > now() - interval '1 minute';
  select count(*) into cnt from public.community_posts
   where author_id = b and created_at > now() - interval '24 hours';
  if cnt <> 100 then raise exception 'FAIL: the test expected client B to have 100 posts in 24 hours, not %', cnt; end if;
  set local role authenticated;
  begin
    insert into public.community_posts (body) values ('[rls-test] la 101');
    raise exception 'FAIL: client B''s 101st post within 24 hours went through';
  exception when sqlstate 'PT429' then ok := ok + 1;
  end;

  -- ===========================================================================
  -- As CLIENT C (paid plan, no state, no name)
  -- ===========================================================================
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: C, paid but with no state, sees no news at all, not even the
  -- all-states post
  select count(*) into cnt from public.news_posts where id = any (all_news);
  if cnt <> 0 then raise exception 'FAIL: client C, with no state, sees % test news posts instead of 0', cnt; end if;
  ok := ok + 1;

  -- CHECK: C, with no state, still reads the board (B's and the admin's posts)
  select count(*) into cnt from public.community_posts where id in (p_adm, p_b);
  if cnt <> 2 then raise exception 'FAIL: client C, with no state, cannot read the community board'; end if;
  ok := ok + 1;

  -- CHECK: C, paid but with no state, sees only the board: no chat message
  -- of any state
  select count(*) into cnt from public.community_posts where state is not null;
  if cnt <> 0 then raise exception 'FAIL: client C, with no state, sees % chat messages', cnt; end if;
  ok := ok + 1;

  -- CHECK: C, with no state, cannot post in any state's chat
  foreach s in array states loop
    begin
      insert into public.community_posts (body, state) values ('Hola', s);
      raise exception 'FAIL: client C, with no state, posted in the chat of %', s;
    exception when insufficient_privilege then null;
    end;
  end loop;
  ok := ok + 1;

  -- CHECK: C, with no first name, posts as "Miembro"
  insert into public.community_posts (body) values ('Primera pregunta')
    returning id into p_c1;
  select author_name into txt from public.community_posts where id = p_c1;
  if txt is distinct from 'Miembro' then
    raise exception 'FAIL: author name with no first name is "%" instead of "Miembro"', txt;
  end if;
  ok := ok + 1;

  -- CHECK: with a first name but empty last names, C posts as "María", and the
  -- earlier post keeps the name it had when it was posted
  update public.profiles set first_name = 'María', last_names = '' where id = c;
  insert into public.community_posts (body) values ('Segunda pregunta')
    returning id into p_c2;
  select author_name into txt from public.community_posts where id = p_c2;
  if txt is distinct from 'María' then
    raise exception 'FAIL: author name with empty last names is "%" instead of "María"', txt;
  end if;
  select author_name into txt from public.community_posts where id = p_c1;
  if txt is distinct from 'Miembro' then
    raise exception 'FAIL: an earlier post''s author name changed to "%"', txt;
  end if;
  ok := ok + 1;

  -- CHECK: C cannot delete B's post, but can delete their own
  delete from public.community_posts where id = p_b;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client C deleted client B''s post'; end if;
  delete from public.community_posts where id = p_c1;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: client C could not delete their own post'; end if;
  ok := ok + 1;

  -- CHECK: C (paid, no state, no route) reads no checklist item and can't
  -- tick one
  select count(*) into cnt from public.checklist_items where id = any (test_items);
  if cnt <> 0 then raise exception 'FAIL: client C, with no state and no route, reads % checklist items', cnt; end if;
  begin
    insert into public.progress (user_id, item_id) values (c, item_active);
    raise exception 'FAIL: client C, with no state and no route, ticked an item';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: C chooses Bayern, but still has no route: still no items, no ticks
  update public.profiles set main_state = 'by' where id = c;
  select count(*) into cnt from public.checklist_items where id = any (test_items);
  if cnt <> 0 then raise exception 'FAIL: client C, with a state but no route, reads % checklist items', cnt; end if;
  begin
    insert into public.progress (user_id, item_id) values (c, item_active);
    raise exception 'FAIL: client C, with a state but no route, ticked an item';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- In the SQL Editor: C gets a route, and their state is cleared
  reset role;
  update public.profiles set main_state = null, route = 'rls-test-route' where id = c;
  set local role authenticated;

  -- CHECK: C, with a route but no state: still no items, no ticks
  select count(*) into cnt from public.checklist_items where id = any (test_items);
  if cnt <> 0 then raise exception 'FAIL: client C, with a route but no state, reads % checklist items', cnt; end if;
  begin
    insert into public.progress (user_id, item_id) values (c, item_active);
    raise exception 'FAIL: client C, with a route but no state, ticked an item';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- In the SQL Editor: C gets Bayern again, so now has a state and a route
  reset role;
  update public.profiles set main_state = 'by' where id = c;
  set local role authenticated;

  -- CHECK: with both, C reads and ticks exactly their own item
  select count(*) into cnt from public.checklist_items where id = any (test_items);
  if cnt <> 1 then raise exception 'FAIL: client C, with a state and a route, reads % test checklist items instead of 1', cnt; end if;
  insert into public.progress (user_id, item_id) values (c, item_active);
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: client C, with a state and a route, could not tick their own item'; end if;
  ok := ok + 1;

  -- ===========================================================================
  -- As CLIENT D (paid plan, Thüringen): the state chats
  -- ===========================================================================
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: D (paid, Thüringen) sees the board plus only Thüringen's chat;
  -- nothing of Bayern's chat, where the admin and client B wrote
  select count(*) into cnt from public.community_posts
   where state is not null and author_id in (a, b, c, d, adm);
  if cnt <> 1 then raise exception 'FAIL: client D (Thüringen) sees % test chat messages instead of 1', cnt; end if;
  select count(*) into cnt from public.community_posts where state <> 'th';
  if cnt <> 0 then raise exception 'FAIL: client D (Thüringen) sees % messages of other states'' chats', cnt; end if;
  select count(*) into cnt from public.community_posts where state = 'th' and author_id = adm;
  if cnt <> 1 then raise exception 'FAIL: client D cannot see the admin''s message in Thüringen''s chat'; end if;
  select count(*) into cnt from public.community_posts where state is null and id in (p_adm, p_b);
  if cnt <> 2 then raise exception 'FAIL: client D cannot read the board'; end if;
  ok := ok + 1;

  -- CHECK: D (paid, Thüringen) reads the files of Thüringen's post and the
  -- all-states post, but no file of a Bayern post
  select count(*) into cnt from public.news_attachments where path = any (test_files);
  if cnt <> 2 then raise exception 'FAIL: client D (Thüringen) reads % test attachment rows instead of 2', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name in (f_other, f_all);
  if cnt <> 2 then raise exception 'FAIL: client D cannot read the files of Thüringen''s and the all-states post'; end if;
  select count(*) into cnt from storage.objects
   where bucket_id = 'news-files' and name in (f_free, f_paid, f_draft, f_future, f_orphan);
  if cnt <> 0 then raise exception 'FAIL: client D (Thüringen) reads % files of Bayern posts', cnt; end if;
  ok := ok + 1;

  -- CHECK (migration 6): D (Thüringen) reads the small copy of Thüringen's
  -- photo, and no small copy of a Bayern photo
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = any (thumb_files);
  if cnt <> 1 then raise exception 'FAIL: client D (Thüringen) reads % small copies instead of 1', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = t_other;
  if cnt <> 1 then raise exception 'FAIL: client D cannot read the small copy of Thüringen''s photo'; end if;
  ok := ok + 1;

  -- CHECK: D posts in Thüringen's chat, but not in Bayern's
  insert into public.community_posts (body, state) values ('Hola, Thüringen', 'th')
    returning id into p_d_chat;
  select count(*) into cnt from public.community_posts
   where id = p_d_chat and state = 'th' and author_name = 'Ana R.' and not is_staff;
  if cnt <> 1 then raise exception 'FAIL: client D''s chat message did not get the state and name, or is marked as staff'; end if;
  begin
    insert into public.community_posts (body, state) values ('Hola, Bayern', 'by');
    raise exception 'FAIL: client D posted in another state''s chat';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: per state. For each of the 16 states in turn, D is moved there (in
  -- the SQL Editor) and then sees the board plus only that state's chat
  foreach s in array states loop
    reset role;
    update public.profiles set main_state = s where id = d;
    set local role authenticated;
    select count(*) into cnt from public.community_posts
     where state is not null and state <> s;
    if cnt <> 0 then raise exception 'FAIL: a member of % sees % messages of other states'' chats', s, cnt; end if;
    select count(*) into cnt from public.community_posts
     where state = s and author_id = adm;
    if cnt <> 1 then raise exception 'FAIL: a member of % cannot see their own state''s chat', s; end if;
    select count(*) into cnt from public.community_posts where state is null and id = p_adm;
    if cnt <> 1 then raise exception 'FAIL: a member of % cannot read the board', s; end if;
  end loop;
  ok := ok + 1;

  -- In the SQL Editor: D ends up in Bayern
  reset role;
  update public.profiles set main_state = 'by' where id = d;
  set local role authenticated;

  -- CHECK: after the move, D no longer sees their own old message in
  -- Thüringen's chat, and can't delete it...
  select count(*) into cnt from public.community_posts where id = p_d_chat;
  if cnt <> 0 then raise exception 'FAIL: client D, moved to Bayern, still sees their message in Thüringen''s chat'; end if;
  delete from public.community_posts where id = p_d_chat;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client D, moved to Bayern, deleted a message in Thüringen''s chat'; end if;
  ok := ok + 1;

  -- CHECK: ...but the speed limit still counts it: with 4 more posts D has 5
  -- within the minute, and the next one is refused
  insert into public.community_posts (body) values ('[rls-test] D 2');
  insert into public.community_posts (body, state)
    select '[rls-test] D ' || g, 'by' from generate_series(3, 5) g;
  begin
    insert into public.community_posts (body, state) values ('[rls-test] D 6', 'by');
    raise exception 'FAIL: the speed limit did not count a post the member can no longer see';
  exception when sqlstate 'PT429' then ok := ok + 1;
  end;

  -- ===========================================================================
  -- As CLIENT A again: B's private data
  -- ===========================================================================
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: A cannot see or untick client B's progress
  select count(*) into cnt from public.progress where user_id = b;
  if cnt <> 0 then raise exception 'FAIL: client A can see client B''s progress'; end if;
  delete from public.progress where user_id = b;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client A deleted client B''s progress'; end if;
  ok := ok + 1;

  -- ===========================================================================
  -- As a LOGGED-OUT visitor (anon)
  -- ===========================================================================
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  -- CHECK: a logged-out visitor can't read any of the tables
  begin
    perform 1 from public.profiles;
    raise exception 'FAIL: a logged-out visitor can read profiles';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    perform 1 from public.routes;
    raise exception 'FAIL: a logged-out visitor can read routes';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    perform 1 from public.checklist_items;
    raise exception 'FAIL: a logged-out visitor can read checklist_items';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    perform 1 from public.progress;
    raise exception 'FAIL: a logged-out visitor can read progress';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    perform 1 from public.news_posts;
    raise exception 'FAIL: a logged-out visitor can read news_posts';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    perform 1 from public.community_posts;
    raise exception 'FAIL: a logged-out visitor can read community_posts';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    perform 1 from public.news_attachments;
    raise exception 'FAIL: a logged-out visitor can read news_attachments';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: a logged-out visitor reads no file of news-files and can't upload
  -- one. (Supabase lets logged-out visitors query storage.objects; the
  -- rules then show them nothing.)
  begin
    select count(*) into cnt from storage.objects where bucket_id = 'news-files';
  exception when insufficient_privilege then cnt := 0;
  end;
  if cnt <> 0 then raise exception 'FAIL: a logged-out visitor reads % files of news-files', cnt; end if;
  begin
    insert into storage.objects (bucket_id, name)
      values ('news-files', n_free::text || '/' || gen_random_uuid()::text || '.jpg');
    raise exception 'FAIL: a logged-out visitor uploaded a file to news-files';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: a logged-out visitor can't post on the board or in a chat
  begin
    insert into public.community_posts (body, state) values ('Hola', 'by');
    raise exception 'FAIL: a logged-out visitor posted a community post';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: a logged-out visitor can't run private.my_state()
  begin
    perform private.my_state();
    raise exception 'FAIL: a logged-out visitor can run private.my_state()';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: a logged-out visitor can't run private.my_route()
  begin
    perform private.my_route();
    raise exception 'FAIL: a logged-out visitor can run private.my_route()';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- ===========================================================================
  -- As the ADMIN again: reads everything, still can't break the hard rules
  -- ===========================================================================
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: admin reads every test client's profile and progress
  select count(*) into cnt from public.profiles where id in (a, b, c, adm);
  if cnt <> 4 then raise exception 'FAIL: admin cannot read all profiles'; end if;
  select count(*) into cnt from public.progress where user_id = b;
  if cnt <> 1 then raise exception 'FAIL: admin cannot read client B''s progress'; end if;
  ok := ok + 1;

  -- CHECK: admin can change and clear a state a client chose
  update public.profiles set main_state = 'th' where id = a;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not change client A''s state'; end if;
  update public.profiles set main_state = null where id = a;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not clear client A''s state'; end if;
  ok := ok + 1;

  -- CHECK: admin reads archived items and unpublished or future news
  select count(*) into cnt from public.checklist_items where id in (item_active, item_archived);
  if cnt <> 2 then raise exception 'FAIL: admin cannot read all checklist items'; end if;
  select count(*) into cnt from public.news_posts where id = any (all_news);
  if cnt <> 6 then raise exception 'FAIL: admin cannot read all news posts'; end if;
  ok := ok + 1;

  -- CHECK: admin (who has no state or route) still reads every state's and
  -- every route's items
  select count(*) into cnt from public.checklist_items where id = any (test_items);
  if cnt <> 4 then raise exception 'FAIL: admin reads % test checklist items instead of 4', cnt; end if;
  ok := ok + 1;

  -- CHECK: even an admin cannot make a client an admin, or remove their own
  -- admin role, through the website
  begin
    update public.profiles set is_admin = true where id = b;
    raise exception 'FAIL: admin made client B an admin through the website';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.profiles set is_admin = false where id = adm;
    raise exception 'FAIL: admin removed their own admin role through the website';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: admin can edit a checklist item and a news post
  update public.checklist_items set body = 'Texto' where id = item_active;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not change a checklist item'; end if;
  update public.news_posts set published = true where id = n_draft;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not change a news post'; end if;
  ok := ok + 1;

  -- CHECK: even an admin cannot delete a checklist item or change its id
  begin
    delete from public.checklist_items where id = item_archived;
    raise exception 'FAIL: admin deleted a checklist item';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.checklist_items set id = gen_random_uuid() where id = item_archived;
    raise exception 'FAIL: admin changed a checklist item''s id';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: admin views progress but cannot tick for a client
  begin
    insert into public.progress (user_id, item_id) values (a, item_active);
    raise exception 'FAIL: admin ticked an item for client A';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: admin can delete a news post
  delete from public.news_posts where id = n_future;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not delete a news post'; end if;
  ok := ok + 1;

  -- CHECK: even an admin cannot edit a community post
  begin
    update public.community_posts set body = 'editado' where id = p_b;
    raise exception 'FAIL: admin edited a community post';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: admin can delete anyone's community post
  delete from public.community_posts where id in (p_b, p_c2);
  get diagnostics rc = row_count;
  if rc <> 2 then raise exception 'FAIL: admin could not delete other members'' posts'; end if;
  ok := ok + 1;

  -- CHECK: admin reads every state's chat: their own 16 messages, client D's
  -- message in Thüringen and client B's in Bayern
  select count(distinct state) into cnt from public.community_posts
   where state is not null and author_id = adm;
  if cnt <> 16 then raise exception 'FAIL: admin reads the chats of % states instead of 16', cnt; end if;
  select count(*) into cnt from public.community_posts
   where (id = p_d_chat and state = 'th') or (author_id = b and state = 'by');
  if cnt <> 3 then raise exception 'FAIL: admin reads % of the 3 test messages members wrote in the chats', cnt; end if;
  ok := ok + 1;

  -- CHECK: every post by the admin is marked as staff, and no member's post is
  select count(*) into cnt from public.community_posts where author_id = adm and not is_staff;
  if cnt <> 0 then raise exception 'FAIL: % of the admin''s posts are not marked as staff', cnt; end if;
  select count(*) into cnt from public.community_posts where author_id in (a, b, c, d) and is_staff;
  if cnt <> 0 then raise exception 'FAIL: % member posts are marked as staff', cnt; end if;
  ok := ok + 1;

  -- CHECK: admin can delete a member's chat message
  delete from public.community_posts where id = p_d_chat;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not delete a member''s chat message'; end if;
  ok := ok + 1;

  -- CHECK: admin reads every test file: the draft's, the one with no row,
  -- and the future post's, whose row went with the post deleted above
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = any (test_files);
  if cnt <> 7 then raise exception 'FAIL: admin reads % of the 7 test files', cnt; end if;
  select count(*) into cnt from public.news_attachments where path = any (test_files);
  if cnt <> 5 then raise exception 'FAIL: admin reads % test attachment rows instead of 5', cnt; end if;
  select count(*) into cnt from public.news_attachments where path = f_future;
  if cnt <> 0 then raise exception 'FAIL: deleting a news post did not delete its attachment rows'; end if;
  ok := ok + 1;

  -- CHECK (migration 6): admin reads every small copy and every photo of
  -- migration 6, also those whose row is gone (the removed photo's, and
  -- the future post's, whose rows went with the post deleted above)
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name = any (thumb_files);
  if cnt <> 8 then raise exception 'FAIL: admin reads % of the 8 test files of migration 6', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'news-files' and name in (f_removed, t_removed);
  if cnt <> 2 then raise exception 'FAIL: admin cannot read the files of a removed photo row'; end if;
  ok := ok + 1;

  -- CHECK: admin removes a photo the way the website does: first its row,
  -- then the photo and its small copy together
  delete from public.news_attachments where path = f_draft;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not delete an attachment row'; end if;
  delete from storage.objects where bucket_id = 'news-files' and name in (f_draft, t_draft);
  get diagnostics rc = row_count;
  if rc <> 2 then raise exception 'FAIL: admin deleted % of a photo''s 2 files', rc; end if;
  ok := ok + 1;

  -- CHECK (migration 6): admin can delete the files of a removed photo row
  delete from storage.objects where bucket_id = 'news-files' and name in (f_removed, t_removed);
  get diagnostics rc = row_count;
  if rc <> 2 then raise exception 'FAIL: admin deleted % of the 2 files of a removed photo row', rc; end if;
  ok := ok + 1;

  -- CHECK: admin can delete files that have no row (f_orphan, the future
  -- post's) and the other test files
  delete from storage.objects where bucket_id = 'news-files' and name = any (test_files);
  get diagnostics rc = row_count;
  if rc <> 6 then raise exception 'FAIL: admin deleted % of the 6 remaining test files', rc; end if;
  delete from storage.objects where bucket_id = 'news-files' and name = any (thumb_files);
  get diagnostics rc = row_count;
  if rc <> 5 then raise exception 'FAIL: admin deleted % of the 5 remaining test files of migration 6', rc; end if;
  ok := ok + 1;

  -- ===========================================================================
  -- Migration 7: checklist templates, client layer, client details, dudas
  -- ===========================================================================
  -- Set up as you (postgres), so these checks don't depend on what the
  -- sections above changed. Three more made-up paid clients:
  --   E: Bayern, the OTHER test route (same state as B, another route)
  --   F: Thüringen, B's route (another state, same route as B)
  --   G: Bayern, B's route (exactly like B)
  reset role;
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (instance_id, id, aud, role, email,
                          raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', ce, 'authenticated', 'authenticated',
     'rls-test-e@example.invalid', '{}', '{"first_name": "Eva", "last_names": "Prueba"}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', cf, 'authenticated', 'authenticated',
     'rls-test-f@example.invalid', '{}', '{"first_name": "Félix", "last_names": "Prueba"}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', cg, 'authenticated', 'authenticated',
     'rls-test-g@example.invalid', '{}', '{"first_name": "Gabi", "last_names": "Prueba"}', now(), now());
  update public.profiles set plan = 'paid', main_state = 'by', route = 'rls-test-route-otra' where id = ce;
  update public.profiles set plan = 'paid', main_state = 'th', route = 'rls-test-route'      where id = cf;
  update public.profiles set plan = 'paid', main_state = 'by', route = 'rls-test-route'      where id = cg;
  update public.profiles set plan = 'paid', main_state = 'by', route = 'rls-test-route'      where id = b;
  update public.profiles set plan = 'free', main_state = 'by', route = 'rls-test-route'      where id = a;
  update public.profiles set plan = 'paid', main_state = null, route = null                 where id = c;
  update public.checklist_items set archived = false where id in (item_active, item_other_state, item_other_route);
  update public.checklist_items set archived = true  where id = item_archived;

  -- CHECK (migration 7): the four routes exist with their Spanish names, in order
  select string_agg(code || '=' || name, ' | ' order by sort_order) into txt
    from public.routes
   where code in ('medico_drittstaat', 'medico_ue', 'dentista_drittstaat', 'dentista_ue');
  if txt is distinct from
     'medico_drittstaat=Médico · título de fuera de la UE | medico_ue=Médico · título de la UE, el EEE o Suiza | '
     'dentista_drittstaat=Dentista · título de fuera de la UE | dentista_ue=Dentista · título de la UE, el EEE o Suiza' then
    raise exception 'FAIL: the four routes are missing, misnamed or out of order: %', txt;
  end if;
  ok := ok + 1;

  -- CHECK (migration 7): codes may contain "_"; badly shaped codes are still refused
  insert into public.routes (code, name) values ('rls-test-ruta_b', 'Ruta de prueba con _');
  insert into public.checklist_items (code, state, route, title)
    values ('rls-test-x_7', 'by', 'rls-test-route', 'Prueba con _');
  for i in 1..4 loop
    begin
      case i
        when 1 then insert into public.routes (code, name) values ('rls-test__doble', 'x');
        when 2 then insert into public.routes (code, name) values ('rls-test-fin_', 'x');
        when 3 then insert into public.checklist_items (code, state, route, title)
                      values ('rls-test-Mayus', 'by', 'rls-test-route', 'x');
        when 4 then insert into public.checklist_items (code, state, route, title)
                      values ('rls-test-_x', 'by', 'rls-test-route', 'x');
      end case;
      raise exception 'FAIL: bad code number % of this check was accepted', i;
    exception when check_violation then null;
    end;
  end loop;
  ok := ok + 1;

  -- CHECK (migration 7): with a source_code, the readable code must be
  -- <state>-<route>-<source_code>
  insert into public.checklist_items (code, state, route, title, source_code)
    values ('by-rls-test-route-x_8', 'by', 'rls-test-route', 'Prueba de plantilla', 'x_8');
  begin
    insert into public.checklist_items (code, state, route, title, source_code)
      values ('rls-test-mal', 'by', 'rls-test-route', 'x', 'x9');
    raise exception 'FAIL: an item whose code doesn''t match its source_code was accepted';
  exception when check_violation then ok := ok + 1;
  end;

  -- CHECK (migration 7): grants on checklist_items: the new columns are
  -- readable (SELECT on the whole table) and writable only through the
  -- admin-only rules; still no delete
  if not (has_table_privilege('authenticated', 'public.checklist_items', 'SELECT')
      and has_column_privilege('authenticated', 'public.checklist_items', 'donde', 'UPDATE')
      and has_column_privilege('authenticated', 'public.checklist_items', 'source_code', 'INSERT')) then
    raise exception 'FAIL: the new checklist_items columns can''t be read or written by admins';
  end if;
  if has_table_privilege('authenticated', 'public.checklist_items', 'DELETE')
  or has_table_privilege('authenticated', 'public.checklist_items', 'TRUNCATE')
  or has_column_privilege('authenticated', 'public.checklist_items', 'id', 'UPDATE') then
    raise exception 'FAIL: checklist items can be deleted, or their id changed';
  end if;
  ok := ok + 1;

  -- CHECK (migration 7): column-level grants on the four new tables, nothing
  -- broader than needed. Nobody may delete, truncate, send updated_at, or
  -- move a row to another user, item, state or route.
  for rel in select unnest(array['public.checklist_templates', 'public.client_item_settings',
                                 'public.client_details', 'public.client_dudas']) loop
    if not has_table_privilege('authenticated', rel, 'SELECT') then
      raise exception 'FAIL: logged-in users can''t read %', rel;
    end if;
    if has_table_privilege('authenticated', rel, 'DELETE')
    or has_table_privilege('authenticated', rel, 'TRUNCATE')
    or has_table_privilege('authenticated', rel, 'INSERT')       -- whole-table insert
    or has_table_privilege('authenticated', rel, 'UPDATE')       -- whole-table update
    or has_column_privilege('authenticated', rel, 'updated_at', 'INSERT')
    or has_column_privilege('authenticated', rel, 'updated_at', 'UPDATE') then
      raise exception 'FAIL: logged-in users have more rights than needed on %', rel;
    end if;
  end loop;
  if has_column_privilege('authenticated', 'public.checklist_templates', 'state', 'UPDATE')
  or has_column_privilege('authenticated', 'public.checklist_templates', 'route', 'UPDATE')
  or has_column_privilege('authenticated', 'public.client_item_settings', 'user_id', 'UPDATE')
  or has_column_privilege('authenticated', 'public.client_item_settings', 'item_id', 'UPDATE')
  or has_column_privilege('authenticated', 'public.client_details', 'user_id', 'UPDATE')
  or has_column_privilege('authenticated', 'public.client_dudas', 'user_id', 'UPDATE') then
    raise exception 'FAIL: a row of a new table can be moved to another user, item, state or route';
  end if;
  if not (has_column_privilege('authenticated', 'public.client_dudas', 'user_id', 'INSERT')
      and has_column_privilege('authenticated', 'public.client_dudas', 'body', 'INSERT')
      and has_column_privilege('authenticated', 'public.client_dudas', 'body', 'UPDATE')) then
    raise exception 'FAIL: the website can''t send user_id and body for dudas';
  end if;
  if not (has_column_privilege('authenticated', 'public.client_item_settings', 'note', 'UPDATE')
      and has_column_privilege('authenticated', 'public.client_details', 'country', 'UPDATE')
      and has_column_privilege('authenticated', 'public.checklist_templates', 'cards', 'UPDATE')) then
    raise exception 'FAIL: the admin screens lost the right to change the new tables';
  end if;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Migration 7, as the ADMIN
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: admin writes the new step fields on an item
  update public.checklist_items
     set block = 2, official_number = 'pág. 4', donde = 'Una oficina inventada',
         plazo = '1 semana', na_default = true, na_reason = 'Motivo inventado'
   where id = item_active;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not write the new checklist_items fields'; end if;
  ok := ok + 1;

  -- CHECK: admin adds templates (B's state + route, Thüringen + B's route,
  -- Bayern + the other route) and can change one
  insert into public.checklist_templates (state, route, title, blocks)
    values ('by', 'rls-test-route',      '[rls-test] plantilla by', '[{"bloque": 1, "titulo": "Uno"}]'),
           ('th', 'rls-test-route',      '[rls-test] plantilla th', '[]'),
           ('by', 'rls-test-route-otra', '[rls-test] plantilla by otra', '[]');
  update public.checklist_templates set cards = '{"pie": "Pie de prueba"}'
   where state = 'by' and route = 'rls-test-route';
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not change a template'; end if;
  ok := ok + 1;

  -- CHECK: templates must have the right shape (cards an object, blocks a list)
  begin
    update public.checklist_templates set cards = '[]' where state = 'th' and route = 'rls-test-route';
    raise exception 'FAIL: a template accepted cards that are not an object';
  exception when check_violation then ok := ok + 1;
  end;

  -- CHECK: not even an admin can delete a template or move it to another state
  begin
    delete from public.checklist_templates where route = 'rls-test-route';
    raise exception 'FAIL: admin deleted a template';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.checklist_templates set state = 'nw' where state = 'th' and route = 'rls-test-route';
    raise exception 'FAIL: admin moved a template to another state';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: admin writes the client layer; the database trims the texts,
  -- turns text of only spaces into empty, and sets the date
  insert into public.client_item_settings (user_id, item_id, applies, reason, note) values
    (b, item_active,      false, '  Motivo de B  ', E' Nota de B \n'),
    (b, item_archived,    null,  null,              'Nota de B en un paso archivado'),
    (b, item_other_route, null,  null,              'Nota de B en otra ruta'),
    (cg, item_active,      true,  null,              'Nota de G'),
    (ce, item_other_route, null,  null,              'Nota de E'),
    (ce, item_active,      null,  null,              'Nota de E en la ruta de B'),
    (cf, item_other_state, null,  E' \t ',           'Nota de F'),
    (a, item_active,      null,  null,              'Nota de A'),
    (c, item_active,      null,  null,              'Nota de C');
  select count(*) into cnt from public.client_item_settings
   where user_id = b and item_id = item_active
     and reason = 'Motivo de B' and note = 'Nota de B' and updated_at is not null;
  if cnt <> 1 then raise exception 'FAIL: the client layer was not trimmed, or has no date'; end if;
  select count(*) into cnt from public.client_item_settings
   where user_id = cf and item_id = item_other_state and reason is null;
  if cnt <> 1 then raise exception 'FAIL: a reason of only spaces was not made empty'; end if;
  ok := ok + 1;

  -- CHECK: admin changes the client layer, but can't move a row to another
  -- client or step, can't send the date, and can't delete rows
  update public.client_item_settings set applies = true, note = 'Nota de G, cambiada'
   where user_id = cg and item_id = item_active;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not change the client layer'; end if;
  ok := ok + 1;
  begin
    update public.client_item_settings set user_id = b where user_id = cg and item_id = item_active;
    raise exception 'FAIL: admin moved a client-layer row to another client';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.client_item_settings set item_id = item_archived where user_id = cg and item_id = item_active;
    raise exception 'FAIL: admin moved a client-layer row to another step';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into public.client_item_settings (user_id, item_id, updated_at) values (cg, item_other_route, now());
    raise exception 'FAIL: admin sent the client layer''s date';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    delete from public.client_item_settings where user_id = cg;
    raise exception 'FAIL: admin deleted a client-layer row';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: the client layer's length limits (reason 500, note 2,000)
  for i in 1..2 loop
    begin
      case i
        when 1 then update public.client_item_settings set reason = repeat('x', 501) where user_id = cg and item_id = item_active;
        when 2 then update public.client_item_settings set note = repeat('x', 2001) where user_id = cg and item_id = item_active;
      end case;
      raise exception 'FAIL: the client layer accepted a too-long text, number % of this check', i;
    exception when check_violation then null;
    end;
  end loop;
  update public.client_item_settings set reason = repeat('x', 500), note = repeat('x', 2000)
   where user_id = cg and item_id = item_active;
  update public.client_item_settings set reason = null, note = 'Nota de G, cambiada'
   where user_id = cg and item_id = item_active;
  ok := ok + 1;

  -- CHECK: admin writes client details (trimmed), within their limits
  insert into public.client_details (user_id, country, header_line) values
    (b, ' Ecuador ', 'Médico · Título de {pais} (2015) · Vive en Quito'),
    (cg, 'Perú', null),
    (ce, 'Chile', null),
    (cf, 'Bolivia', null),
    (a, 'México', null);
  select count(*) into cnt from public.client_details where user_id = b and country = 'Ecuador';
  if cnt <> 1 then raise exception 'FAIL: client details were not saved or not trimmed'; end if;
  update public.client_details set header_line = 'Línea de prueba' where user_id = cg;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not change client details'; end if;
  begin
    update public.client_details set country = repeat('x', 101) where user_id = cg;
    raise exception 'FAIL: client details accepted a 101-character country';
  exception when check_violation then ok := ok + 1;
  end;
  begin
    update public.client_details set user_id = b where user_id = cg;
    raise exception 'FAIL: admin moved client details to another client';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    delete from public.client_details where user_id = cg;
    raise exception 'FAIL: admin deleted client details';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: admin can't write a client's dudas (only their own row)
  begin
    insert into public.client_dudas (user_id, body) values (b, 'Escrito por el admin');
    raise exception 'FAIL: admin wrote a client''s dudas';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- ---------------------------------------------------------------------------
  -- Migration 7, as CLIENT B (paid, Bayern, rls-test-route)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: B reads the new step fields of their own item through the
  -- existing read rule
  select count(*) into cnt from public.checklist_items
   where id = item_active and block = 2 and donde = 'Una oficina inventada'
     and na_reason = 'Motivo inventado' and na_default and official_number = 'pág. 4';
  if cnt <> 1 then raise exception 'FAIL: client B cannot read block, donde and na_reason of their own item'; end if;
  ok := ok + 1;

  -- CHECK: B can't write the new step fields, nor add an item
  update public.checklist_items set donde = 'hackeado', block = 5 where id = item_active;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B changed the step fields of an item'; end if;
  begin
    insert into public.checklist_items (code, state, route, title, source_code)
      values ('by-rls-test-route-hack', 'by', 'rls-test-route', 'x', 'hack');
    raise exception 'FAIL: client B added a checklist item';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: B reads exactly one template, the one for their state and route
  select string_agg(title, ',') into txt from public.checklist_templates;
  if txt is distinct from '[rls-test] plantilla by' then
    raise exception 'FAIL: client B reads the templates "%" instead of only their own', txt;
  end if;
  ok := ok + 1;

  -- CHECK: B can't add or change a template
  begin
    insert into public.checklist_templates (state, route, title) values ('by', 'rls-test-ruta_b', 'x');
    raise exception 'FAIL: client B added a template';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  update public.checklist_templates set title = 'hackeado';
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B changed a template'; end if;
  ok := ok + 1;

  -- CHECK: B reads only their own client-layer row for the item they can
  -- read: not the archived step's, not the other route's, nobody else's
  select count(*) into cnt from public.client_item_settings;
  if cnt <> 1 then raise exception 'FAIL: client B reads % client-layer rows instead of 1', cnt; end if;
  select count(*) into cnt from public.client_item_settings
   where user_id = b and item_id = item_active and applies = false and note = 'Nota de B';
  if cnt <> 1 then raise exception 'FAIL: client B cannot read their own client-layer row'; end if;
  ok := ok + 1;

  -- CHECK: B can't write the client layer, not even their own rows
  begin
    insert into public.client_item_settings (user_id, item_id, note) values (b, item_other_state, 'x');
    raise exception 'FAIL: client B added a client-layer row';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  update public.client_item_settings set applies = true, note = 'hackeado' where user_id = b;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B changed their own client layer'; end if;
  ok := ok + 1;
  begin
    delete from public.client_item_settings where user_id = b;
    raise exception 'FAIL: client B deleted a client-layer row';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: B reads only their own details, and can't write them
  select string_agg(country, ',') into txt from public.client_details;
  if txt is distinct from 'Ecuador' then
    raise exception 'FAIL: client B reads the details "%" instead of only their own', txt;
  end if;
  begin
    insert into public.client_details (user_id, country) values (b, 'x');
    raise exception 'FAIL: client B added client details';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  update public.client_details set country = 'hackeado';
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B changed their own details'; end if;
  ok := ok + 1;

  -- CHECK: B writes their own dudas; the database trims the text and sets the date
  insert into public.client_dudas (user_id, body) values (b, E'  Mis dudas de B \n\n');
  select count(*) into cnt from public.client_dudas
   where user_id = b and body = 'Mis dudas de B' and updated_at is not null;
  if cnt <> 1 then raise exception 'FAIL: client B''s dudas were not saved trimmed, with a date'; end if;
  ok := ok + 1;

  -- CHECK: B changes their dudas (also with "insert ... on conflict", as the
  -- website may) and can clear them; 4,000 characters fit, 4,001 don't
  update public.client_dudas set body = repeat('d', 4000) || '   ' where user_id = b;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: client B could not change their dudas'; end if;
  begin
    update public.client_dudas set body = repeat('d', 4001) where user_id = b;
    raise exception 'FAIL: dudas accepted 4,001 characters';
  exception when check_violation then ok := ok + 1;
  end;
  insert into public.client_dudas (user_id, body) values (b, '')
    on conflict (user_id) do update set body = excluded.body;
  insert into public.client_dudas (user_id, body) values (b, 'Dudas de B')
    on conflict (user_id) do update set body = excluded.body;
  select count(*) into cnt from public.client_dudas where user_id = b and body = 'Dudas de B';
  if cnt <> 1 then raise exception 'FAIL: client B could not save their dudas with insert ... on conflict'; end if;
  ok := ok + 1;

  -- CHECK: B can't write dudas for another user, can't move their own row
  -- to another user, can't send the date and can't delete
  begin
    insert into public.client_dudas (user_id, body) values (cg, 'Escrito por B');
    raise exception 'FAIL: client B wrote dudas with another user''s user_id';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.client_dudas set user_id = cg where user_id = b;
    raise exception 'FAIL: client B changed the user_id of their own dudas';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.client_dudas set updated_at = now() - interval '1 year' where user_id = b;
    raise exception 'FAIL: client B changed the date of their dudas';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    delete from public.client_dudas where user_id = b;
    raise exception 'FAIL: client B deleted their dudas';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- ---------------------------------------------------------------------------
  -- Migration 7, as CLIENT G (paid, Bayern, rls-test-route: exactly like B)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', cg, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: G shares B's template (same state and route)...
  select string_agg(title, ',') into txt from public.checklist_templates;
  if txt is distinct from '[rls-test] plantilla by' then
    raise exception 'FAIL: client G reads the templates "%" instead of their state + route''s', txt;
  end if;
  ok := ok + 1;

  -- CHECK: ...but reads only their own client layer and details, never B's
  select count(*) into cnt from public.client_item_settings where user_id <> cg;
  if cnt <> 0 then raise exception 'FAIL: client G reads % client-layer rows of other clients', cnt; end if;
  select count(*) into cnt from public.client_item_settings where user_id = cg and note = 'Nota de G, cambiada';
  if cnt <> 1 then raise exception 'FAIL: client G cannot read their own client-layer row'; end if;
  select count(*) into cnt from public.client_details where user_id <> cg;
  if cnt <> 0 then raise exception 'FAIL: client G reads the details of another client'; end if;
  select count(*) into cnt from public.client_details where user_id = cg and header_line = 'Línea de prueba';
  if cnt <> 1 then raise exception 'FAIL: client G cannot read their own details'; end if;
  ok := ok + 1;

  -- CHECK: G can't read or change B's dudas, and writes their own
  select count(*) into cnt from public.client_dudas;
  if cnt <> 0 then raise exception 'FAIL: client G reads % dudas of other clients', cnt; end if;
  update public.client_dudas set body = 'hackeado' where user_id = b;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client G changed client B''s dudas'; end if;
  insert into public.client_dudas (user_id, body) values (cg, 'Dudas de G');
  select count(*) into cnt from public.client_dudas;
  if cnt <> 1 then raise exception 'FAIL: client G reads % dudas instead of only their own', cnt; end if;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Migration 7, as CLIENT B again: G's private data
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: B reads nothing of G's: client layer, details, dudas
  select (select count(*) from public.client_item_settings where user_id = cg)
       + (select count(*) from public.client_details where user_id = cg)
       + (select count(*) from public.client_dudas where user_id = cg)
    into cnt;
  if cnt <> 0 then raise exception 'FAIL: client B reads % rows of client G''s data', cnt; end if;
  update public.client_dudas set body = 'hackeado' where user_id = cg;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B changed client G''s dudas'; end if;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Migration 7, as CLIENT E (paid, Bayern, the OTHER route)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', ce, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: E (same state, another route) reads only their own route's
  -- template, and only their client-layer row for their own route's item:
  -- not their row on B's route's item
  select string_agg(title, ',') into txt from public.checklist_templates;
  if txt is distinct from '[rls-test] plantilla by otra' then
    raise exception 'FAIL: client E reads the templates "%" instead of only their own route''s', txt;
  end if;
  select string_agg(note, ',') into txt from public.client_item_settings;
  if txt is distinct from 'Nota de E' then
    raise exception 'FAIL: client E reads the client-layer notes "%" instead of only "Nota de E"', txt;
  end if;
  ok := ok + 1;

  -- CHECK: E reads nothing of B's or G's
  select (select count(*) from public.client_item_settings where user_id <> ce)
       + (select count(*) from public.client_details where user_id <> ce)
       + (select count(*) from public.client_dudas where user_id <> ce)
    into cnt;
  if cnt <> 0 then raise exception 'FAIL: client E reads % rows of other clients'' data', cnt; end if;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Migration 7, as CLIENT F (paid, Thüringen, B's route)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', cf, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: F (another state, same route) reads only Thüringen's template and
  -- their own row, nothing of B's or G's
  select string_agg(title, ',') into txt from public.checklist_templates;
  if txt is distinct from '[rls-test] plantilla th' then
    raise exception 'FAIL: client F reads the templates "%" instead of only Thüringen''s', txt;
  end if;
  select string_agg(note, ',') into txt from public.client_item_settings;
  if txt is distinct from 'Nota de F' then
    raise exception 'FAIL: client F reads the client-layer notes "%" instead of only "Nota de F"', txt;
  end if;
  select (select count(*) from public.client_item_settings where user_id <> cf)
       + (select count(*) from public.client_details where user_id <> cf)
       + (select count(*) from public.client_dudas where user_id <> cf)
    into cnt;
  if cnt <> 0 then raise exception 'FAIL: client F reads % rows of other clients'' data', cnt; end if;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Migration 7, as CLIENT A (FREE, Bayern, B's route)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: a free client sees none of it, not even their own rows
  select (select count(*) from public.checklist_templates)
       + (select count(*) from public.client_item_settings)
       + (select count(*) from public.client_details)
       + (select count(*) from public.client_dudas)
    into cnt;
  if cnt <> 0 then raise exception 'FAIL: free client A reads % rows of migration 7''s tables', cnt; end if;
  ok := ok + 1;

  -- CHECK: a free client can't write dudas, not even their own
  begin
    insert into public.client_dudas (user_id, body) values (a, 'Dudas de A');
    raise exception 'FAIL: free client A wrote dudas';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- ---------------------------------------------------------------------------
  -- Migration 7, as CLIENT C (paid, no state, no route)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: with no state and no route: no template and no client-layer row
  -- (C's row is on an item C can't read)
  select (select count(*) from public.checklist_templates)
       + (select count(*) from public.client_item_settings)
    into cnt;
  if cnt <> 0 then raise exception 'FAIL: client C, with no state or route, reads % template or client-layer rows', cnt; end if;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Migration 7, as a LOGGED-OUT visitor (anon)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  -- CHECK: a logged-out visitor can't read any of the four new tables
  for rel in select unnest(array['public.checklist_templates', 'public.client_item_settings',
                                 'public.client_details', 'public.client_dudas']) loop
    begin
      execute format('select 1 from %s limit 1', rel);
      raise exception 'FAIL: a logged-out visitor can read %', rel;
    exception when insufficient_privilege then null;
    end;
  end loop;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Migration 7, as the ADMIN again: reads everything
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: admin reads every client's dudas, client layer (also on an
  -- archived step) and details, and every template
  select count(*) into cnt from public.client_dudas where user_id in (b, cg);
  if cnt <> 2 then raise exception 'FAIL: admin reads % of the 2 clients'' dudas', cnt; end if;
  select count(*) into cnt from public.client_item_settings where user_id in (a, b, c, ce, cf, cg);
  if cnt <> 9 then raise exception 'FAIL: admin reads % of the 9 client-layer rows', cnt; end if;
  select count(*) into cnt from public.client_item_settings where item_id = item_archived;
  if cnt <> 1 then raise exception 'FAIL: admin cannot read the client layer of an archived step'; end if;
  select count(*) into cnt from public.client_details where user_id in (a, b, ce, cf, cg);
  if cnt <> 5 then raise exception 'FAIL: admin reads % of the 5 clients'' details', cnt; end if;
  select count(*) into cnt from public.checklist_templates where route like 'rls-test-%';
  if cnt <> 3 then raise exception 'FAIL: admin reads % of the 3 test templates', cnt; end if;
  ok := ok + 1;

  -- CHECK: admin can't change a client's dudas
  update public.client_dudas set body = 'Cambiado por el admin' where user_id = b;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: admin changed a client''s dudas'; end if;
  ok := ok + 1;

  -- ===========================================================================
  -- Migration 8: "Mis documentos" (client_documents and the bucket client-files)
  -- ===========================================================================
  -- Uses the clients set up above: B (paid, Bayern, rls-test-route), G
  -- (paid, exactly like B), A (FREE) and the admin. First, as you
  -- (postgres), the safety nets on the table and the bucket.
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- CHECK (migration 8): client_documents has RLS on, and the website may
  -- read, delete, and add only user_id, path and file_name: never the id
  -- or the date (the database sets them), never change a row, never empty
  -- the whole table
  select count(*) into cnt from pg_class
   where oid = 'public.client_documents'::regclass and relrowsecurity;
  if cnt <> 1 then raise exception 'FAIL: client_documents has Row Level Security switched off'; end if;
  if not (has_table_privilege('authenticated', 'public.client_documents', 'SELECT')
      and has_table_privilege('authenticated', 'public.client_documents', 'DELETE')
      and has_column_privilege('authenticated', 'public.client_documents', 'user_id', 'INSERT')
      and has_column_privilege('authenticated', 'public.client_documents', 'path', 'INSERT')
      and has_column_privilege('authenticated', 'public.client_documents', 'file_name', 'INSERT')) then
    raise exception 'FAIL: the website lost a right it needs on client_documents';
  end if;
  if has_table_privilege('authenticated', 'public.client_documents', 'INSERT')       -- whole-table insert
  or has_table_privilege('authenticated', 'public.client_documents', 'TRUNCATE')
  or has_column_privilege('authenticated', 'public.client_documents', 'id', 'INSERT')
  or has_column_privilege('authenticated', 'public.client_documents', 'created_at', 'INSERT')
  or has_any_column_privilege('authenticated', 'public.client_documents', 'UPDATE')
  or has_any_column_privilege('anon', 'public.client_documents', 'SELECT, INSERT, UPDATE')
  or has_table_privilege('anon', 'public.client_documents', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'FAIL: someone has more rights than needed on client_documents';
  end if;
  ok := ok + 1;

  -- CHECK (migration 8): the bucket client-files is private, at most 10 MB
  -- per file, and takes only PDF
  select count(*) into cnt from storage.buckets
   where id = 'client-files'
     and public is false
     and file_size_limit = 10485760
     and allowed_mime_types = array['application/pdf'];
  if cnt <> 1 then
    raise exception 'FAIL: the bucket client-files is missing, public, or has the wrong size limit or file types';
  end if;
  ok := ok + 1;

  -- CHECK (migration 8): client-files has exactly three rules on
  -- storage.objects: read, upload and delete. No rule to change (replace or
  -- move) a file.
  select string_agg(cmd, ',' order by cmd) into txt from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'client-files:%';
  if txt is distinct from 'DELETE,INSERT,SELECT' then
    raise exception 'FAIL: client-files has the rules "%" instead of DELETE,INSERT,SELECT', txt;
  end if;
  ok := ok + 1;

  doc_b1       := b::text  || '/' || gen_random_uuid()::text || '.pdf';
  doc_b2       := b::text  || '/' || gen_random_uuid()::text || '.pdf';
  doc_b_orphan := b::text  || '/' || gen_random_uuid()::text || '.pdf';
  doc_g        := cg::text || '/' || gen_random_uuid()::text || '.pdf';
  doc_a        := a::text  || '/' || gen_random_uuid()::text || '.pdf';
  doc_files := array[doc_b1, doc_b2, doc_b_orphan, doc_g, doc_a];

  -- ---------------------------------------------------------------------------
  -- Migration 8, as the ADMIN
  -- ---------------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: admin uploads files into clients' folders and adds their rows,
  -- the way the website does it: first the file, then its row. B's third
  -- file gets NO row (like an upload whose row was never saved). A name of
  -- exactly 200 characters is accepted.
  insert into storage.objects (bucket_id, name)
    select 'client-files', unnest(doc_files);
  get diagnostics rc = row_count;
  if rc <> 5 then raise exception 'FAIL: admin uploaded % of 5 client documents', rc; end if;
  insert into public.client_documents (user_id, path, file_name)
  values (b,  doc_b1, 'Approbation Antrag.pdf'),
         (b,  doc_b2, repeat('x', 196) || '.pdf'),
         (cg, doc_g,  'Documento de G.pdf'),
         (a,  doc_a,  'Documento de A.pdf');
  get diagnostics rc = row_count;
  if rc <> 4 then raise exception 'FAIL: admin added % of 4 client_documents rows', rc; end if;
  ok := ok + 1;

  -- CHECK: the database sets the date of a new row
  select count(*) into cnt from public.client_documents
   where path = any (doc_files) and created_at is not null and id is not null;
  if cnt <> 4 then raise exception 'FAIL: the database did not set id and created_at on new client_documents rows'; end if;
  ok := ok + 1;

  -- CHECK: admin reads every row and every file, also the file with no row
  select count(*) into cnt from public.client_documents where path = any (doc_files);
  if cnt <> 4 then raise exception 'FAIL: admin reads % of the 4 client_documents rows', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'client-files' and name = any (doc_files);
  if cnt <> 5 then raise exception 'FAIL: admin reads % of the 5 client documents', cnt; end if;
  ok := ok + 1;

  -- CHECK: the bucket refuses badly named files, even from an admin. First
  -- (asked for by Ivan): a folder that is a uuid but not an existing
  -- profile's ID. Then: the uploaded file's own name, a folder that isn't a
  -- uuid at all, a sub-folder, another ending, uppercase letters.
  names := array[
    gen_random_uuid()::text || '/' || gen_random_uuid()::text || '.pdf',
    b::text || '/Approbation Antrag.pdf',
    'no-es-un-uuid/' || gen_random_uuid()::text || '.pdf',
    b::text || '/carpeta/' || gen_random_uuid()::text || '.pdf',
    b::text || '/' || gen_random_uuid()::text || '.docx',
    b::text || '/' || gen_random_uuid()::text || '.html',
    b::text || '/' || upper(gen_random_uuid()::text) || '.pdf',
    b::text || '/' || gen_random_uuid()::text || '.PDF'];
  foreach txt in array names loop
    begin
      insert into storage.objects (bucket_id, name) values ('client-files', txt);
      raise exception 'FAIL: admin uploaded a client document named %', txt;
    exception when insufficient_privilege then null;
    end;
  end loop;
  ok := ok + 1;

  -- CHECK: a client_documents row must point into its own client's folder
  -- (never another client's), with a lowercase uuid as the name and ".pdf";
  -- file_name 1 to 200 characters with no spaces or line breaks at either end
  for i in 1 .. 8 loop
    begin
      case i
        when 1 then insert into public.client_documents (user_id, path, file_name)  -- G's folder, B's row
                      values (b, cg::text || '/' || gen_random_uuid()::text || '.pdf', 'x.pdf');
        when 2 then insert into public.client_documents (user_id, path, file_name)
                      values (b, b::text || '/' || upper(gen_random_uuid()::text) || '.pdf', 'x.pdf');
        when 3 then insert into public.client_documents (user_id, path, file_name)
                      values (b, b::text || '/' || gen_random_uuid()::text || '.jpg', 'x.pdf');
        when 4 then insert into public.client_documents (user_id, path, file_name)
                      values (b, b::text || '/x/' || gen_random_uuid()::text || '.pdf', 'x.pdf');
        when 5 then insert into public.client_documents (user_id, path, file_name)
                      values (b, b::text || '/' || gen_random_uuid()::text || '.pdf', '');
        when 6 then insert into public.client_documents (user_id, path, file_name)
                      values (b, b::text || '/' || gen_random_uuid()::text || '.pdf', repeat('x', 197) || '.pdf');
        when 7 then insert into public.client_documents (user_id, path, file_name)
                      values (b, b::text || '/' || gen_random_uuid()::text || '.pdf', ' x.pdf');
        when 8 then insert into public.client_documents (user_id, path, file_name)
                      values (b, b::text || '/' || gen_random_uuid()::text || '.pdf', E'x.pdf\n');
      end case;
      raise exception 'FAIL: bad client_documents row number % of this check was accepted', i;
    exception when check_violation then null;
    end;
  end loop;
  ok := ok + 1;

  -- CHECK: two rows can never point to the same file
  begin
    insert into public.client_documents (user_id, path, file_name) values (b, doc_b1, 'Otra vez.pdf');
    raise exception 'FAIL: a second client_documents row for the same file was accepted';
  exception when unique_violation then ok := ok + 1;
  end;

  -- CHECK: nobody changes a row, not even an admin: not its name, its
  -- client or its path
  begin
    update public.client_documents set file_name = 'Cambiado.pdf' where path = doc_b1;
    raise exception 'FAIL: admin changed the name of a client document';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.client_documents set user_id = cg where path = doc_b1;
    raise exception 'FAIL: admin moved a client document to another client';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.client_documents set path = doc_b_orphan where path = doc_b1;
    raise exception 'FAIL: admin changed the path of a client document';
  exception when insufficient_privilege then null;
  end;
  ok := ok + 1;

  -- CHECK: nobody replaces or moves a stored file, not even an admin (no
  -- rule to change files in client-files)
  update storage.objects set name = b::text || '/' || gen_random_uuid()::text || '.pdf'
   where bucket_id = 'client-files' and name = doc_b1;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: admin moved a client document in storage'; end if;
  update storage.objects set metadata = '{}'
   where bucket_id = 'client-files' and name = any (doc_files);
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: admin changed a client document in storage'; end if;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Migration 8, as CLIENT B (paid, Bayern, rls-test-route)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: B reads exactly their own two rows, not G's or A's
  select coalesce(array_agg(path order by path), '{}') into names from public.client_documents;
  if names <> (select array_agg(x order by x) from unnest(array[doc_b1, doc_b2]) as x) then
    raise exception 'FAIL: paid client B reads % client_documents rows instead of only their own 2', cardinality(names);
  end if;
  ok := ok + 1;

  -- CHECK: B reads their own two files...
  select count(*) into cnt from storage.objects where bucket_id = 'client-files' and name in (doc_b1, doc_b2);
  if cnt <> 2 then raise exception 'FAIL: paid client B reads % of their own 2 documents', cnt; end if;
  ok := ok + 1;

  -- CHECK: ...but not the file in their own folder that has no row, also
  -- when listing their folder (what the Storage service does for "list")
  select count(*) into cnt from storage.objects where bucket_id = 'client-files' and name = doc_b_orphan;
  if cnt <> 0 then raise exception 'FAIL: paid client B reads a document that has no client_documents row'; end if;
  select coalesce(array_agg(name order by name), '{}') into names from storage.objects
   where bucket_id = 'client-files' and name like b::text || '/%';
  if names <> (select array_agg(x order by x) from unnest(array[doc_b1, doc_b2]) as x) then
    raise exception 'FAIL: listing their folder shows paid client B % files instead of only the 2 with a row', cardinality(names);
  end if;
  ok := ok + 1;

  -- CHECK: B reads no file of G or A, whatever is asked
  select count(*) into cnt from storage.objects where bucket_id = 'client-files' and name not like b::text || '/%';
  if cnt <> 0 then raise exception 'FAIL: paid client B reads % documents of other clients', cnt; end if;
  ok := ok + 1;

  -- CHECK: B can't add a row or upload a file, not even into their own folder
  begin
    insert into public.client_documents (user_id, path, file_name)
      values (b, b::text || '/' || gen_random_uuid()::text || '.pdf', 'Mío.pdf');
    raise exception 'FAIL: client B added a client_documents row';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    insert into storage.objects (bucket_id, name)
      values ('client-files', b::text || '/' || gen_random_uuid()::text || '.pdf');
    raise exception 'FAIL: client B uploaded a file to client-files';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- CHECK: B can't delete or change their own rows or files
  delete from public.client_documents where path in (doc_b1, doc_b2);
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B deleted their own client_documents row'; end if;
  begin
    update public.client_documents set file_name = 'Cambiado.pdf' where path = doc_b1;
    raise exception 'FAIL: client B changed a client_documents row';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where bucket_id = 'client-files' and name = any (doc_files);
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B deleted a file in client-files'; end if;
  update storage.objects set name = b::text || '/' || gen_random_uuid()::text || '.pdf'
   where bucket_id = 'client-files' and name = doc_b1;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client B moved a file in client-files'; end if;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Migration 8, as CLIENT G (paid, same state and route as B)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', cg, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: G reads only their own row, never B's (same state and route)
  select coalesce(array_agg(path), '{}') into names from public.client_documents;
  if names <> array[doc_g] then
    raise exception 'FAIL: client G reads % client_documents rows instead of only their own', cardinality(names);
  end if;
  select count(*) into cnt from public.client_documents where user_id = b;
  if cnt <> 0 then raise exception 'FAIL: client G reads client B''s client_documents rows'; end if;
  ok := ok + 1;

  -- CHECK: G reads their own file, but none of B's, also when listing
  -- B's folder
  select count(*) into cnt from storage.objects where bucket_id = 'client-files' and name = doc_g;
  if cnt <> 1 then raise exception 'FAIL: client G cannot read their own document'; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'client-files' and name like b::text || '/%';
  if cnt <> 0 then raise exception 'FAIL: client G reads % of client B''s documents', cnt; end if;
  ok := ok + 1;

  -- CHECK (asked for by Ivan): G can't create a signed link for B's file.
  -- Supabase's Storage service makes a signed link only after it has read
  -- the file's row in storage.objects as the logged-in person, asking for
  -- exactly that bucket and path; when that read finds nothing, it answers
  -- "Object not found" and makes no link. This is that read, as G:
  select count(*) into cnt from storage.objects
   where bucket_id = 'client-files' and name = doc_b1;
  if cnt <> 0 then raise exception 'FAIL: client G can read client B''s document, so could get a signed link for it'; end if;
  select count(*) into cnt from storage.objects
   where bucket_id = 'client-files' and name in (doc_b1, doc_b2, doc_b_orphan);
  if cnt <> 0 then raise exception 'FAIL: client G could get signed links for % of client B''s documents', cnt; end if;
  ok := ok + 1;

  -- CHECK: G can't delete B's rows or files, nor add a row for B
  delete from public.client_documents where user_id = b;
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client G deleted client B''s client_documents rows'; end if;
  delete from storage.objects where bucket_id = 'client-files' and name like b::text || '/%';
  get diagnostics rc = row_count;
  if rc <> 0 then raise exception 'FAIL: client G deleted client B''s documents'; end if;
  begin
    insert into public.client_documents (user_id, path, file_name) values (b, doc_b_orphan, 'x.pdf');
    raise exception 'FAIL: client G added a row for client B''s file';
  exception when insufficient_privilege then ok := ok + 1;
  end;

  -- ---------------------------------------------------------------------------
  -- Migration 8, as CLIENT A (FREE)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: a free client sees nothing, not even their own row and file
  select count(*) into cnt from public.client_documents;
  if cnt <> 0 then raise exception 'FAIL: free client A reads % client_documents rows', cnt; end if;
  select count(*) into cnt from storage.objects where bucket_id = 'client-files';
  if cnt <> 0 then raise exception 'FAIL: free client A reads % files of client-files', cnt; end if;
  ok := ok + 1;

  -- CHECK: a free client can't add a row or upload a file either
  begin
    insert into public.client_documents (user_id, path, file_name)
      values (a, a::text || '/' || gen_random_uuid()::text || '.pdf', 'x.pdf');
    raise exception 'FAIL: free client A added a client_documents row';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name)
      values ('client-files', a::text || '/' || gen_random_uuid()::text || '.pdf');
    raise exception 'FAIL: free client A uploaded a file to client-files';
  exception when insufficient_privilege then null;
  end;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Migration 8, as a LOGGED-OUT visitor (anon)
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  -- CHECK: a logged-out visitor can't read client_documents, reads no file
  -- of client-files and can't upload one
  begin
    select count(*) into cnt from public.client_documents;
    raise exception 'FAIL: a logged-out visitor can read client_documents';
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into cnt from storage.objects where bucket_id = 'client-files';
  exception when insufficient_privilege then cnt := 0;
  end;
  if cnt <> 0 then raise exception 'FAIL: a logged-out visitor reads % files of client-files', cnt; end if;
  begin
    insert into storage.objects (bucket_id, name)
      values ('client-files', b::text || '/' || gen_random_uuid()::text || '.pdf');
    raise exception 'FAIL: a logged-out visitor uploaded a file to client-files';
  exception when insufficient_privilege then null;
  end;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Migration 8, as the ADMIN again: deleting
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: admin deletes a document the way the website does it: the row
  -- first, then the file
  delete from public.client_documents where path = doc_b2;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not delete a client_documents row'; end if;
  delete from storage.objects where bucket_id = 'client-files' and name = doc_b2;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not delete a client document'; end if;
  ok := ok + 1;

  -- CHECK: admin can also delete a file that has no row
  delete from storage.objects where bucket_id = 'client-files' and name = doc_b_orphan;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: admin could not delete a document that has no row'; end if;
  ok := ok + 1;

  -- CHECK: once its row is gone, B no longer sees the deleted document;
  -- B still sees the other one
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select coalesce(array_agg(path), '{}') into names from public.client_documents;
  if names <> array[doc_b1] then
    raise exception 'FAIL: after deleting, paid client B reads % rows instead of 1', cardinality(names);
  end if;
  select coalesce(array_agg(name), '{}') into names from storage.objects where bucket_id = 'client-files';
  if names <> array[doc_b1] then
    raise exception 'FAIL: after deleting, paid client B reads % files instead of 1', cardinality(names);
  end if;
  ok := ok + 1;

  -- ---------------------------------------------------------------------------
  -- Clean up, as you (postgres) again
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- Deleting the logins also deletes their profiles, progress and posts.
  delete from auth.users where id in (a, b, c, d, ce, cf, cg, adm);  -- and their client layer, details and dudas
  delete from public.news_posts where title like '[rls-test]%';  -- and their attachment rows
  delete from storage.objects where bucket_id = 'news-files' and name = any (test_files || thumb_files);
  -- Deleting the logins removed their client_documents rows, but not their
  -- files (known limit of migration 8): remove the test files by hand
  delete from storage.objects where bucket_id = 'client-files' and name = any (doc_files);
  delete from public.checklist_templates where route like 'rls-test-%';
  delete from public.checklist_items where code like 'rls-test-%' or route like 'rls-test-%';
  delete from public.routes where code like 'rls-test-%';

  -- CHECK: nothing from the test is left behind
  select (select count(*) from public.profiles where id in (a, b, c, d, ce, cf, cg, adm))
       + (select count(*) from auth.users where id in (a, b, c, d, ce, cf, cg, adm))
       + (select count(*) from public.progress where user_id in (a, b, c, d, ce, cf, cg, adm))
       + (select count(*) from public.community_posts where author_id in (a, b, c, d, ce, cf, cg, adm))
       + (select count(*) from public.checklist_items where code like 'rls-test-%' or route like 'rls-test-%')
       + (select count(*) from public.checklist_templates where route like 'rls-test-%')
       + (select count(*) from public.client_item_settings where user_id in (a, b, c, d, ce, cf, cg, adm))
       + (select count(*) from public.client_details where user_id in (a, b, c, d, ce, cf, cg, adm))
       + (select count(*) from public.client_dudas where user_id in (a, b, c, d, ce, cf, cg, adm))
       + (select count(*) from public.news_posts where title like '[rls-test]%')
       + (select count(*) from public.news_attachments
           where path = any (test_files || thumb_files) or thumb_path = any (thumb_files))
       + (select count(*) from storage.objects
           where bucket_id = 'news-files' and name = any (test_files || thumb_files))
       + (select count(*) from public.client_documents
           where user_id in (a, b, c, d, ce, cf, cg, adm) or path = any (doc_files))
       + (select count(*) from storage.objects
           where bucket_id = 'client-files' and name = any (doc_files))
       + (select count(*) from public.routes where code like 'rls-test-%')
    into cnt;
  if cnt <> 0 then raise exception 'FAIL: % test rows were left behind', cnt; end if;
  ok := ok + 1;

  raise notice 'All % RLS checks passed.', ok;
end;
$test$;

select 'ALL RLS TESTS PASSED' as result;

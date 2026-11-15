-- =============================================================================
-- RLS check: proves the access rules from migrations 1 and 2 work.
-- =============================================================================
-- Paste this whole file into Supabase's SQL Editor and press "Run".
-- Run it after every migration, and again after any change to policies or
-- grants. It is safe to run as often as you like.
--
-- What it does:
--   1. Creates 4 fake logins (client A, client B, client C, an admin), test
--      routes, test checklist items and test news posts. Everything it
--      creates is marked "rls-test" so it can be found and removed.
--   2. Pretends to be each of them in turn, the same way the website would be
--      after a login, and checks what they can and can't see or change.
--   3. Deletes everything it created.
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
  -- test content
  item_active    uuid;
  item_archived  uuid;
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
  -- helpers
  all_news  uuid[];      -- every test news post
  rc     bigint;         -- rows changed by the last statement
  cnt    bigint;
  txt    text;
  fn     text;
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
     '{"first_name": "María Fernanda", "last_names": "García López"}', now(), now());

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

  -- You can make someone an admin from the SQL Editor
  update public.profiles set is_admin = true where id = adm;

  -- Test content (also created by you, so the checks below don't depend on it)
  insert into public.routes (code, name) values ('rls-test-route', 'Ruta de prueba');
  insert into public.checklist_items (code, state, route, title)
    values ('rls-test-001', 'by', 'rls-test-route', 'Prueba activa')
    returning id into item_active;
  insert into public.checklist_items (code, state, route, title, archived)
    values ('rls-test-002', 'by', 'rls-test-route', 'Prueba archivada', true)
    returning id into item_archived;
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

  -- CHECK: a logged-out visitor can't run private.my_state()
  begin
    perform private.my_state();
    raise exception 'FAIL: a logged-out visitor can run private.my_state()';
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

  -- ---------------------------------------------------------------------------
  -- Clean up, as you (postgres) again
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- Deleting the logins also deletes their profiles, progress and posts.
  delete from auth.users where id in (a, b, c, adm);
  delete from public.news_posts where title like '[rls-test]%';
  delete from public.checklist_items where code like 'rls-test-%';
  delete from public.routes where code like 'rls-test-%';

  -- CHECK: nothing from the test is left behind
  select (select count(*) from public.profiles where id in (a, b, c, adm))
       + (select count(*) from public.progress where user_id in (a, b, c, adm))
       + (select count(*) from public.community_posts where author_id in (a, b, c, adm))
       + (select count(*) from public.checklist_items where code like 'rls-test-%')
       + (select count(*) from public.news_posts where title like '[rls-test]%')
       + (select count(*) from public.routes where code like 'rls-test-%')
    into cnt;
  if cnt <> 0 then raise exception 'FAIL: % test rows were left behind', cnt; end if;
  ok := ok + 1;

  raise notice 'All % RLS checks passed.', ok;
end;
$test$;

select 'ALL RLS TESTS PASSED' as result;

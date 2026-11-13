-- =============================================================================
-- RLS check: proves the access rules from migration 1 work.
-- =============================================================================
-- Paste this whole file into Supabase's SQL Editor and press "Run".
-- Run it after the migration, and again after any change to policies or
-- grants. It is safe to run as often as you like.
--
-- What it does:
--   1. Creates 3 fake logins (client A, client B, an admin), test routes,
--      test checklist items and test news posts. Everything it creates is
--      marked "rls-test" so it can be found and removed.
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
  a      uuid := gen_random_uuid();   -- client A (stays on the free plan)
  b      uuid := gen_random_uuid();   -- client B (becomes paid)
  adm    uuid := gen_random_uuid();   -- an admin
  -- test content
  item_active    uuid;
  item_archived  uuid;
  n_free         uuid;   -- published, for Bayern, free for everyone
  n_paid         uuid;   -- published, for Bayern, paid_only (by default)
  n_draft        uuid;   -- not published
  n_future       uuid;   -- published, but its date is tomorrow
  n_all          uuid;   -- published, for all states, free for everyone
  -- helpers
  rc     bigint;         -- rows changed by the last statement
  cnt    bigint;
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
     'rls-test-b@example.invalid',     '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', adm, 'authenticated', 'authenticated',
     'rls-test-admin@example.invalid', '{}', '{}', now(), now());

  -- CHECK: a profile was created automatically for each new login
  select count(*) into cnt from public.profiles
   where id in (a, b, adm) and plan = 'free' and not is_admin
     and email like 'rls-test-%@example.invalid';
  if cnt <> 3 then raise exception 'FAIL: new logins did not get a free, non-admin profile each'; end if;
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
  ok := ok + 1;

  -- ===========================================================================
  -- As CLIENT A (free plan)
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

  -- CHECK: A can change their own name
  update public.profiles set full_name = 'Cliente A' where id = a;
  get diagnostics rc = row_count;
  if rc <> 1 then raise exception 'FAIL: client A could not change their own name'; end if;
  ok := ok + 1;

  -- CHECK: A cannot change client B's profile
  update public.profiles set full_name = 'hacked' where id = b;
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

  -- CHECK: A cannot change their own main state or route
  begin
    update public.profiles set main_state = 'nw' where id = a;
    raise exception 'FAIL: client A changed their own main state';
  exception when insufficient_privilege then ok := ok + 1;
  end;
  begin
    update public.profiles set route = 'rls-test-route' where id = a;
    raise exception 'FAIL: client A changed their own route';
  exception when insufficient_privilege then ok := ok + 1;
  end;

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

  -- CHECK: A can follow a state for themselves...
  insert into public.followed_states (user_id, state) values (a, 'by');
  ok := ok + 1;
  -- ...but not for client B
  begin
    insert into public.followed_states (user_id, state) values (b, 'th');
    raise exception 'FAIL: client A added a followed state for client B';
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

  -- CHECK: A (free) sees only the free, published, current news:
  -- the Bayern post and the all-states post
  select count(*) into cnt from public.news_posts
   where id in (n_free, n_paid, n_draft, n_future, n_all);
  if cnt <> 2 then raise exception 'FAIL: free client A sees % test news posts instead of 2', cnt; end if;
  select count(*) into cnt from public.news_posts where id in (n_free, n_all);
  if cnt <> 2 then raise exception 'FAIL: free client A cannot see the free Bayern post and the all-states post'; end if;
  ok := ok + 1;

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

  -- ===========================================================================
  -- As CLIENT B (paid plan)
  -- ===========================================================================
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;

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

  -- CHECK: B (paid) also sees the paid_only post, but still not the draft or future post
  select count(*) into cnt from public.news_posts
   where id in (n_free, n_paid, n_draft, n_future, n_all);
  if cnt <> 3 then raise exception 'FAIL: paid client B sees % test news posts instead of 3', cnt; end if;
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

  -- CHECK: B cannot see client A's profile or followed states
  select count(*) into cnt from public.profiles where id = a;
  if cnt <> 0 then raise exception 'FAIL: client B can see client A''s profile'; end if;
  select count(*) into cnt from public.followed_states where user_id = a;
  if cnt <> 0 then raise exception 'FAIL: client B can see client A''s followed states'; end if;
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
    perform 1 from public.followed_states;
    raise exception 'FAIL: a logged-out visitor can read followed_states';
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

  -- ===========================================================================
  -- As the ADMIN again: reads everything, still can't break the hard rules
  -- ===========================================================================
  reset role;
  perform set_config('request.jwt.claims',
    json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- CHECK: admin reads every test client's profile, followed states and progress
  select count(*) into cnt from public.profiles where id in (a, b, adm);
  if cnt <> 3 then raise exception 'FAIL: admin cannot read all profiles'; end if;
  select count(*) into cnt from public.followed_states where user_id = a;
  if cnt <> 1 then raise exception 'FAIL: admin cannot read client A''s followed states'; end if;
  select count(*) into cnt from public.progress where user_id = b;
  if cnt <> 1 then raise exception 'FAIL: admin cannot read client B''s progress'; end if;
  ok := ok + 1;

  -- CHECK: admin reads archived items and unpublished or future news
  select count(*) into cnt from public.checklist_items where id in (item_active, item_archived);
  if cnt <> 2 then raise exception 'FAIL: admin cannot read all checklist items'; end if;
  select count(*) into cnt from public.news_posts
   where id in (n_free, n_paid, n_draft, n_future, n_all);
  if cnt <> 5 then raise exception 'FAIL: admin cannot read all news posts'; end if;
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

  -- ---------------------------------------------------------------------------
  -- Clean up, as you (postgres) again
  -- ---------------------------------------------------------------------------
  reset role;
  perform set_config('request.jwt.claims', '', true);

  -- Deleting the logins also deletes their profiles, followed states and progress.
  delete from auth.users where id in (a, b, adm);
  delete from public.news_posts where title like '[rls-test]%';
  delete from public.checklist_items where code like 'rls-test-%';
  delete from public.routes where code like 'rls-test-%';

  -- CHECK: nothing from the test is left behind
  select (select count(*) from public.profiles where id in (a, b, adm))
       + (select count(*) from public.followed_states where user_id in (a, b, adm))
       + (select count(*) from public.progress where user_id in (a, b, adm))
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

-- 1) Merchants see the student's Student ID (not the name) on a refund request.
-- 2) Refund notifications write amounts the same way as the app: "200 EGP".

alter table public.refund_requests add column if not exists student_code text;
update public.refund_requests q set student_code = p.student_code from public.profiles p where p.id = q.user_id and q.student_code is null;

create or replace function public.set_refund_student_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select student_code into new.student_code from profiles where id = new.user_id;
  return new;
end $$;
drop trigger if exists set_refund_student_code on public.refund_requests;
create trigger set_refund_student_code before insert on public.refund_requests
  for each row execute function public.set_refund_student_code();
revoke execute on function public.set_refund_student_code() from public, anon, authenticated;

-- 200 -> "200", 569.6 -> "569.6", 1209.65 -> "1,209.65"
create or replace function public.num_text(n numeric) returns text
language sql immutable set search_path = public as $$
  select rtrim(rtrim(to_char(n, 'FM999G999G990D00'), '0'), '.')
$$;

do $$
declare r record; v_def text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f' and p.proname <> 'num_text'
              and pg_get_functiondef(p.oid) like '%to_char(q.amount, ''FM999G999D00'')%' loop
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, 'Collect EGP '' || to_char(q.amount, ''FM999G999D00'') || ''', 'Collect '' || num_text(q.amount) || '' EGP');
    v_def := replace(v_def, 'We sent back EGP '' || to_char(q.amount, ''FM999G999D00'') || ''', 'We sent back '' || num_text(q.amount) || '' EGP');
    v_def := replace(v_def, '''EGP '' || to_char(q.amount, ''FM999G999D00'') || ''', 'num_text(q.amount) || '' EGP');
    v_def := replace(v_def, 'to_char(q.amount, ''FM999G999D00'')', 'num_text(q.amount)');
    execute v_def;
  end loop;
end $$;

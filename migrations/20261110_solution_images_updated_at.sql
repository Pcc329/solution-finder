begin;

create function public.solution_images_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

create trigger solution_images_touch_updated_at
  before update on public.solution_images
  for each row execute function public.solution_images_touch_updated_at();

revoke all on function public.solution_images_touch_updated_at() from public, anon, authenticated;

commit;

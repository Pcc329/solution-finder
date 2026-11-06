begin;

create table public.solution_images (
  solution_id     text primary key references public.solutions(solution_id) on delete cascade,
  image_url       text not null check (image_url ~ '^https://'),
  source          text not null,
  source_page_url text,
  checked_at      date not null,
  status          text not null default 'active' check (status in ('active', 'broken', 'removed')),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.solution_images is '方案圖片（引用來源網址，不存副本）。status=active 才在前端顯示；失效改 broken／removed，不刪列。';

alter table public.solution_images enable row level security;

revoke all on public.solution_images from anon, authenticated;
grant select on public.solution_images to anon, authenticated;

create policy solution_images_read on public.solution_images
  for select to anon, authenticated using (status = 'active');

commit;

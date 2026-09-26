-- My Hobbies — Supabase setup (public read-only + private owner mode)
-- Safe to re-run. If you previously ran the v5 setup and have no data yet,
-- just run this entire file again.

create extension if not exists pgcrypto;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
  title text not null,
  kind text not null default 'learning' check (kind in ('learning', 'project')),
  status text not null default 'planned' check (status in ('planned', 'active', 'paused', 'done')),
  progress integer not null default 0 check (progress between 0 and 100),
  tags text[] not null default '{}',
  notes text not null default '',
  next_action text not null default '',
  archived boolean not null default false,
  is_focus boolean not null default false,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  touched_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
  item_id uuid references public.items(id) on delete cascade,
  label text not null,
  type text not null default '',
  url text not null,
  note text not null default '',
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
  title text not null,
  type text not null default 'custom',
  status text not null default 'working' check (status in ('working', 'achieved')),
  target_date date,
  achieved_date date,
  note text not null default '',
  image_path text,
  visibility text not null default 'auto' check (visibility in ('auto', 'public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curiosities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text,
  title text not null,
  url text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
  item_id uuid references public.items(id) on delete set null,
  activity_date date not null default current_date,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  note text not null default '',
  public_heatmap boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hobby_notes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, hobby_id)
);

-- Upgrade columns for anyone who already ran the previous empty schema.
alter table public.items add column if not exists visibility text not null default 'public';
alter table public.milestones add column if not exists visibility text not null default 'auto';
alter table public.activity add column if not exists public_heatmap boolean not null default true;
alter table public.resources add column if not exists hobby_id text;
alter table public.resources add column if not exists visibility text not null default 'public';
alter table public.resources alter column item_id drop not null;

-- Existing project resources gain their hobby automatically.
update public.resources r
set hobby_id = i.hobby_id
from public.items i
where r.item_id = i.id
  and (r.hobby_id is null or r.hobby_id = '');

-- Keep the allowed values constrained even after an upgrade.
do $$ begin
  alter table public.items add constraint items_visibility_check check (visibility in ('public', 'private'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.milestones add constraint milestones_visibility_check check (visibility in ('auto', 'public', 'private'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.resources add constraint resources_visibility_check check (visibility in ('public', 'private'));
exception when duplicate_object then null; end $$;

create index if not exists items_user_hobby_idx on public.items(user_id, hobby_id);
create index if not exists items_touched_idx on public.items(user_id, touched_at desc);
create index if not exists resources_item_idx on public.resources(item_id);
create index if not exists resources_user_hobby_idx on public.resources(user_id, hobby_id);
create index if not exists milestones_user_hobby_idx on public.milestones(user_id, hobby_id);
create index if not exists activity_user_hobby_date_idx on public.activity(user_id, hobby_id, activity_date desc);
create index if not exists curiosity_user_hobby_idx on public.curiosities(user_id, hobby_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at before update on public.items
for each row execute function public.set_updated_at();

drop trigger if exists milestones_set_updated_at on public.milestones;
create trigger milestones_set_updated_at before update on public.milestones
for each row execute function public.set_updated_at();

alter table public.items enable row level security;
alter table public.resources enable row level security;
alter table public.milestones enable row level security;
alter table public.curiosities enable row level security;
alter table public.activity enable row level security;
alter table public.hobby_notes enable row level security;

-- Start from no anonymous privileges, then grant only the public read columns.
revoke all on public.items, public.resources, public.milestones, public.curiosities, public.activity, public.hobby_notes from anon;

grant select, insert, update, delete on public.items, public.resources, public.milestones, public.curiosities, public.activity, public.hobby_notes to authenticated;

-- Public visitors can read only deliberately public content.
-- next_action and is_focus are intentionally NOT granted to anon.
grant select (
  id, hobby_id, title, kind, status, progress, tags, notes,
  archived, visibility, created_at, updated_at, touched_at, completed_at
) on public.items to anon;

grant select (id, hobby_id, item_id, label, type, url, note, visibility, created_at)
on public.resources to anon;

grant select (
  id, hobby_id, title, type, status, target_date, achieved_date,
  note, image_path, visibility, created_at, updated_at
) on public.milestones to anon;

-- Public heatmaps expose only these three columns. Activity notes and item links stay private.
grant select (hobby_id, activity_date, minutes)
on public.activity to anon;

-- Owner policies.
drop policy if exists "items own rows" on public.items;
create policy "items own rows" on public.items for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "resources own rows" on public.resources;
create policy "resources own rows" on public.resources for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "milestones own rows" on public.milestones;
create policy "milestones own rows" on public.milestones for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "curiosities own rows" on public.curiosities;
create policy "curiosities own rows" on public.curiosities for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "activity own rows" on public.activity;
create policy "activity own rows" on public.activity for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "hobby notes own rows" on public.hobby_notes;
create policy "hobby notes own rows" on public.hobby_notes for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Public read policies.
drop policy if exists "items public read" on public.items;
create policy "items public read" on public.items for select to anon
using (visibility = 'public' and archived = false);

drop policy if exists "resources public read" on public.resources;
create policy "resources public read" on public.resources for select to anon
using (
  (
    item_id is null
    and visibility = 'public'
    and hobby_id is not null
  )
  or exists (
    select 1
    from public.items i
    where i.id = item_id
      and i.visibility = 'public'
      and i.archived = false
  )
);

drop policy if exists "milestones public read" on public.milestones;
create policy "milestones public read" on public.milestones for select to anon
using (
  visibility = 'public'
  or (visibility = 'auto' and status = 'achieved')
);

drop policy if exists "activity public heatmap read" on public.activity;
create policy "activity public heatmap read" on public.activity for select to anon
using (public_heatmap = true);

-- Trophy images stay in a private bucket. The owner can always read/write their own files.
-- Public visitors can request a temporary signed URL only for images attached to public achieved milestones.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'milestone-images',
  'milestone-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "read own milestone images" on storage.objects;
create policy "read own milestone images"
on storage.objects for select to authenticated
using (
  bucket_id = 'milestone-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "upload own milestone images" on storage.objects;
create policy "upload own milestone images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'milestone-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "delete own milestone images" on storage.objects;
create policy "delete own milestone images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'milestone-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "read public milestone images" on storage.objects;
create policy "read public milestone images"
on storage.objects for select to anon
using (
  bucket_id = 'milestone-images'
  and exists (
    select 1
    from public.milestones m
    where m.image_path = name
      and m.status = 'achieved'
      and (m.visibility = 'public' or m.visibility = 'auto')
  )
);

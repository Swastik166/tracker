-- My Hobbies — clean Supabase setup
-- Run this once in Supabase Dashboard > SQL Editor.
-- This script creates the app tables, Row Level Security policies,
-- and the private Storage bucket used by trophy images.

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  touched_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  label text not null,
  type text not null default '',
  url text not null,
  note text not null default '',
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curiosities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
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
  created_at timestamptz not null default now()
);

create table if not exists public.hobby_notes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, hobby_id)
);

create index if not exists items_user_hobby_idx on public.items(user_id, hobby_id);
create index if not exists items_touched_idx on public.items(user_id, touched_at desc);
create index if not exists resources_item_idx on public.resources(item_id);
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

-- Lock the tables to signed-in users, then use RLS to isolate each user's rows.
alter table public.items enable row level security;
alter table public.resources enable row level security;
alter table public.milestones enable row level security;
alter table public.curiosities enable row level security;
alter table public.activity enable row level security;
alter table public.hobby_notes enable row level security;

revoke all on public.items, public.resources, public.milestones, public.curiosities, public.activity, public.hobby_notes from anon;
grant select, insert, update, delete on public.items, public.resources, public.milestones, public.curiosities, public.activity, public.hobby_notes to authenticated;

-- Re-running the script is safe: replace the policies cleanly.
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

-- Private trophy-image bucket. 5 MB maximum per image.
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

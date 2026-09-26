-- Hobby Journal — fresh Supabase setup
-- For a NEW Supabase project/database with no existing hobby-journal tables.
-- Run this entire file once in Supabase -> SQL Editor.
--
-- This schema supports:
-- - public read-only journal + private owner mode
-- - learning/project items
-- - hobby-level and item/project resources
-- - editable activity logs + public heatmap summaries
-- - milestones/trophy case + private image storage
-- - homepage Curiosity Inbox (no hobby required)
-- - private per-hobby notes

create extension if not exists pgcrypto;

-- ============================================================
-- TABLES
-- ============================================================

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
  title text not null,
  kind text not null default 'learning'
    check (kind in ('learning', 'project')),
  status text not null default 'planned'
    check (status in ('planned', 'active', 'paused', 'done')),
  progress integer not null default 0
    check (progress between 0 and 100),
  tags text[] not null default '{}',
  notes text not null default '',
  next_action text not null default '',
  archived boolean not null default false,
  is_focus boolean not null default false,
  visibility text not null default 'public'
    check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  touched_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
  -- NULL = general hobby resource.
  -- Non-NULL = resource attached to a learning/project item.
  item_id uuid references public.items(id) on delete cascade,
  label text not null,
  type text not null default '',
  -- Empty string is valid: a resource can be a book/person/place/etc. without a URL.
  url text not null default '',
  note text not null default '',
  -- Used directly for hobby-level resources.
  -- Item-linked resources inherit public visibility from their parent item in RLS.
  visibility text not null default 'public'
    check (visibility in ('public', 'private')),
  created_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
  title text not null,
  type text not null default 'custom',
  status text not null default 'working'
    check (status in ('working', 'achieved')),
  target_date date,
  achieved_date date,
  note text not null default '',
  image_path text,
  -- auto = private while working, public after achievement
  visibility text not null default 'auto'
    check (visibility in ('auto', 'public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.curiosities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Intentionally nullable: homepage curiosities do not need a hobby yet.
  hobby_id text,
  title text not null,
  url text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
  item_id uuid references public.items(id) on delete set null,
  activity_date date not null default current_date,
  minutes integer not null
    check (minutes > 0 and minutes <= 1440),
  note text not null default '',
  public_heatmap boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.hobby_notes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  hobby_id text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, hobby_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index items_user_hobby_idx
  on public.items(user_id, hobby_id);

create index items_touched_idx
  on public.items(user_id, touched_at desc);

create index resources_item_idx
  on public.resources(item_id);

create index resources_user_hobby_idx
  on public.resources(user_id, hobby_id);

create index milestones_user_hobby_idx
  on public.milestones(user_id, hobby_id);

create index activity_user_hobby_date_idx
  on public.activity(user_id, hobby_id, activity_date desc);

create index curiosities_user_created_idx
  on public.curiosities(user_id, created_at desc);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

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

create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

create trigger milestones_set_updated_at
before update on public.milestones
for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.items enable row level security;
alter table public.resources enable row level security;
alter table public.milestones enable row level security;
alter table public.curiosities enable row level security;
alter table public.activity enable row level security;
alter table public.hobby_notes enable row level security;

-- Start with no anonymous table privileges.
revoke all on public.items from anon;
revoke all on public.resources from anon;
revoke all on public.milestones from anon;
revoke all on public.curiosities from anon;
revoke all on public.activity from anon;
revoke all on public.hobby_notes from anon;

-- Signed-in owner can use all CRUD operations.
grant select, insert, update, delete on public.items to authenticated;
grant select, insert, update, delete on public.resources to authenticated;
grant select, insert, update, delete on public.milestones to authenticated;
grant select, insert, update, delete on public.curiosities to authenticated;
grant select, insert, update, delete on public.activity to authenticated;
grant select, insert, update, delete on public.hobby_notes to authenticated;

-- Anonymous/public visitors only receive explicitly safe columns.
-- next_action and is_focus remain owner-only.
grant select (
  id,
  hobby_id,
  title,
  kind,
  status,
  progress,
  tags,
  notes,
  archived,
  visibility,
  created_at,
  updated_at,
  touched_at,
  completed_at
) on public.items to anon;

grant select (
  id,
  hobby_id,
  item_id,
  label,
  type,
  url,
  note,
  visibility,
  created_at
) on public.resources to anon;

grant select (
  id,
  hobby_id,
  title,
  type,
  status,
  target_date,
  achieved_date,
  note,
  image_path,
  visibility,
  created_at,
  updated_at
) on public.milestones to anon;

-- Public heatmap gets only date/minutes/hobby, never notes or item IDs.
grant select (
  hobby_id,
  activity_date,
  minutes
) on public.activity to anon;

-- ------------------------------------------------------------
-- OWNER POLICIES
-- ------------------------------------------------------------

create policy "items own rows"
on public.items
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "resources own rows"
on public.resources
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "milestones own rows"
on public.milestones
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "curiosities own rows"
on public.curiosities
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "activity own rows"
on public.activity
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "hobby notes own rows"
on public.hobby_notes
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- PUBLIC READ POLICIES
-- ------------------------------------------------------------

create policy "items public read"
on public.items
for select
to anon
using (
  visibility = 'public'
  and archived = false
);

create policy "resources public read"
on public.resources
for select
to anon
using (
  -- Standalone hobby resource: use its own visibility.
  (
    item_id is null
    and visibility = 'public'
  )
  or
  -- Item/project resource: inherit visibility from parent item.
  exists (
    select 1
    from public.items i
    where i.id = item_id
      and i.visibility = 'public'
      and i.archived = false
  )
);

create policy "milestones public read"
on public.milestones
for select
to anon
using (
  visibility = 'public'
  or (
    visibility = 'auto'
    and status = 'achieved'
  )
);

create policy "activity public heatmap read"
on public.activity
for select
to anon
using (public_heatmap = true);

-- Curiosities and hobby_notes intentionally have NO anon policy/grant.

-- ============================================================
-- PRIVATE TROPHY IMAGE STORAGE
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
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

-- Owner can read their own milestone images.
create policy "read own milestone images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'milestone-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Owner can upload into their own user folder.
create policy "upload own milestone images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'milestone-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Owner can delete their own images.
create policy "delete own milestone images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'milestone-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Public visitors may read only images belonging to achieved milestones
-- that are public (or auto-public after achievement).
create policy "read public milestone images"
on storage.objects
for select
to anon
using (
  bucket_id = 'milestone-images'
  and exists (
    select 1
    from public.milestones m
    where m.image_path = name
      and m.status = 'achieved'
      and (
        m.visibility = 'public'
        or m.visibility = 'auto'
      )
  )
);

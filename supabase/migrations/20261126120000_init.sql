-- Launch-day schema for the two-city marketplace.
-- Run in the Supabase SQL editor, or with the Supabase CLI against a local project.
-- Do not point this at a database that should show real artists until a human creates that project.
-- CI does not execute this file.

create extension if not exists pgcrypto;

create table public.cities (
  slug text primary key check (slug in ('phoenix', 'fort-walton-beach')),
  name text not null,
  state_code text not null,
  state_name text not null
);

insert into public.cities (slug, name, state_code, state_name) values
  ('phoenix', 'Phoenix', 'AZ', 'Arizona'),
  ('fort-walton-beach', 'Fort Walton Beach', 'FL', 'Florida');

create table public.city_zips (
  zip text primary key,
  city_slug text not null references public.cities (slug)
);

insert into public.city_zips (zip, city_slug) values
  ('85003', 'phoenix'),
  ('85004', 'phoenix'),
  ('85006', 'phoenix'),
  ('85007', 'phoenix'),
  ('85008', 'phoenix'),
  ('85009', 'phoenix'),
  ('85012', 'phoenix'),
  ('85013', 'phoenix'),
  ('85014', 'phoenix'),
  ('85015', 'phoenix'),
  ('85016', 'phoenix'),
  ('85017', 'phoenix'),
  ('85018', 'phoenix'),
  ('85019', 'phoenix'),
  ('85020', 'phoenix'),
  ('85021', 'phoenix'),
  ('85022', 'phoenix'),
  ('85023', 'phoenix'),
  ('85024', 'phoenix'),
  ('85027', 'phoenix'),
  ('85028', 'phoenix'),
  ('85029', 'phoenix'),
  ('85031', 'phoenix'),
  ('85032', 'phoenix'),
  ('85033', 'phoenix'),
  ('85034', 'phoenix'),
  ('85035', 'phoenix'),
  ('85037', 'phoenix'),
  ('85040', 'phoenix'),
  ('85041', 'phoenix'),
  ('85042', 'phoenix'),
  ('85043', 'phoenix'),
  ('85044', 'phoenix'),
  ('85045', 'phoenix'),
  ('85048', 'phoenix'),
  ('85050', 'phoenix'),
  ('85051', 'phoenix'),
  ('85053', 'phoenix'),
  ('85054', 'phoenix'),
  ('85083', 'phoenix'),
  ('85085', 'phoenix'),
  ('85086', 'phoenix'),
  ('85201', 'phoenix'),
  ('85202', 'phoenix'),
  ('85203', 'phoenix'),
  ('85204', 'phoenix'),
  ('85205', 'phoenix'),
  ('85206', 'phoenix'),
  ('85207', 'phoenix'),
  ('85208', 'phoenix'),
  ('85209', 'phoenix'),
  ('85210', 'phoenix'),
  ('85212', 'phoenix'),
  ('85213', 'phoenix'),
  ('85215', 'phoenix'),
  ('85224', 'phoenix'),
  ('85225', 'phoenix'),
  ('85226', 'phoenix'),
  ('85233', 'phoenix'),
  ('85234', 'phoenix'),
  ('85248', 'phoenix'),
  ('85249', 'phoenix'),
  ('85250', 'phoenix'),
  ('85251', 'phoenix'),
  ('85254', 'phoenix'),
  ('85255', 'phoenix'),
  ('85257', 'phoenix'),
  ('85258', 'phoenix'),
  ('85259', 'phoenix'),
  ('85260', 'phoenix'),
  ('85266', 'phoenix'),
  ('85281', 'phoenix'),
  ('85282', 'phoenix'),
  ('85283', 'phoenix'),
  ('85284', 'phoenix'),
  ('85286', 'phoenix'),
  ('85295', 'phoenix'),
  ('85296', 'phoenix'),
  ('85297', 'phoenix'),
  ('85298', 'phoenix'),
  ('85301', 'phoenix'),
  ('85302', 'phoenix'),
  ('85303', 'phoenix'),
  ('85304', 'phoenix'),
  ('85305', 'phoenix'),
  ('85306', 'phoenix'),
  ('85308', 'phoenix'),
  ('85310', 'phoenix'),
  ('85323', 'phoenix'),
  ('85338', 'phoenix'),
  ('85345', 'phoenix'),
  ('85374', 'phoenix'),
  ('85378', 'phoenix'),
  ('85379', 'phoenix'),
  ('85381', 'phoenix'),
  ('85382', 'phoenix'),
  ('85383', 'phoenix'),
  ('85387', 'phoenix'),
  ('85388', 'phoenix'),
  ('85392', 'phoenix'),
  ('85395', 'phoenix'),
  ('32547', 'fort-walton-beach'),
  ('32548', 'fort-walton-beach');

create table public.styles (
  slug text primary key,
  name text not null
);

insert into public.styles (slug, name) values
  ('traditional', 'Traditional'),
  ('neo-traditional', 'Neo-Traditional'),
  ('black-and-grey', 'Black & Grey Realism'),
  ('japanese', 'Japanese'),
  ('fine-line', 'Fine Line'),
  ('illustrative', 'Illustrative'),
  ('watercolor', 'Watercolor'),
  ('blackwork', 'Blackwork'),
  ('script', 'Script'),
  ('geometric', 'Geometric'),
  ('color-realism', 'Color Realism'),
  ('tribal', 'Tribal'),
  ('ornamental', 'Ornamental'),
  ('anime', 'Anime');

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'artist')),
  primary key (user_id, role)
);

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  age_acknowledged_at timestamptz not null,
  image_rights_acknowledged_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null unique references public.artists (id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  city_slug text not null references public.cities (slug) check (city_slug in ('phoenix', 'fort-walton-beach')),
  shop_name text,
  bio text not null default '',
  hours text not null default 'By appointment',
  contact_preference text not null default 'email' check (contact_preference in ('email', 'phone', 'either')),
  phone text,
  zip text,
  published boolean not null default false,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'hidden', 'removed')),
  featured boolean not null default false,
  featured_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.listings.featured is 'Stored sort key. Not sold in this version. No checkout is attached.';

create table public.listing_styles (
  listing_id uuid not null references public.listings (id) on delete cascade,
  style_slug text not null references public.styles (slug),
  primary key (listing_id, style_slug)
);

create table public.portfolio_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  tag text not null default 'unspecified' check (tag in ('healed', 'fresh', 'unspecified')),
  byte_size integer not null check (byte_size > 0),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'hidden', 'removed')),
  rights_acknowledged_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  preferred_city text not null references public.cities (slug) check (preferred_city in ('phoenix', 'fort-walton-beach')),
  notes text not null,
  preferred_dates text not null,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'cancelled', 'expired')),
  proposed_time text,
  artist_note text,
  age_acknowledged_at timestamptz not null,
  manage_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  listing_slug text not null,
  artist_name text not null,
  reporter_email text not null default '',
  reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index listings_city_idx on public.listings (city_slug, moderation_status, published);
create index bookings_artist_idx on public.booking_requests (artist_id, status);
create index bookings_token_idx on public.booking_requests (manage_token);
create index images_listing_idx on public.portfolio_images (listing_id, moderation_status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_updated_at before update on public.listings
for each row execute function public.set_updated_at();

create trigger bookings_updated_at before update on public.booking_requests
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.protect_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.moderation_status is distinct from 'pending' or new.featured or new.featured_until is not null then
      raise exception 'artists cannot set moderation or featured';
    end if;
    return new;
  end if;
  if old.moderation_status = 'approved' and (
    new.display_name is distinct from old.display_name
    or new.bio is distinct from old.bio
    or new.city_slug is distinct from old.city_slug
    or new.shop_name is distinct from old.shop_name
    or new.phone is distinct from old.phone
    or new.hours is distinct from old.hours
    or new.contact_preference is distinct from old.contact_preference
    or new.zip is distinct from old.zip
  ) then
    new.moderation_status := 'pending';
  end if;
  if new.moderation_status is distinct from old.moderation_status
     and not (old.moderation_status = 'approved' and new.moderation_status = 'pending')
  then
    raise exception 'artists cannot change moderation, featured, or slug';
  end if;
  if new.featured is distinct from old.featured
     or new.featured_until is distinct from old.featured_until
     or new.artist_id is distinct from old.artist_id
     or new.slug is distinct from old.slug
  then
    raise exception 'artists cannot change moderation, featured, or slug';
  end if;
  return new;
end;
$$;

create trigger listings_protect before insert or update on public.listings
for each row execute function public.protect_listing();

create or replace function public.requeue_listing_on_style_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.listing_id, old.listing_id);
begin
  if not public.is_admin() then
    update public.listings
    set moderation_status = 'pending'
    where id = target and moderation_status = 'approved';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger listing_styles_requeue
after insert or update or delete on public.listing_styles
for each row execute function public.requeue_listing_on_style_change();

create or replace function public.enforce_listing_zip()
returns trigger
language plpgsql
as $$
begin
  if new.zip is null or btrim(new.zip) = '' then
    new.zip = null;
    return new;
  end if;
  if not exists (
    select 1 from public.city_zips
    where zip = new.zip and city_slug = new.city_slug
  ) then
    raise exception 'zip is outside the listing city';
  end if;
  return new;
end;
$$;

create trigger listings_zip before insert or update on public.listings
for each row execute function public.enforce_listing_zip();

create or replace function public.protect_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and not public.is_admin() then
    if new.listing_id is distinct from old.listing_id
       or new.artist_id is distinct from old.artist_id
       or new.guest_name is distinct from old.guest_name
       or new.guest_email is distinct from old.guest_email
       or new.guest_phone is distinct from old.guest_phone
       or new.preferred_city is distinct from old.preferred_city
       or new.notes is distinct from old.notes
       or new.preferred_dates is distinct from old.preferred_dates
       or new.age_acknowledged_at is distinct from old.age_acknowledged_at
       or new.manage_token is distinct from old.manage_token
    then
      raise exception 'booking guest details are fixed';
    end if;
    if new.status is distinct from old.status and not (
      (old.status = 'requested' and new.status in ('confirmed', 'declined', 'cancelled', 'expired'))
      or (old.status = 'confirmed' and new.status = 'cancelled')
    ) then
      raise exception 'invalid booking transition';
    end if;
  end if;
  return new;
end;
$$;

create trigger bookings_protect before update on public.booking_requests
for each row execute function public.protect_booking();

create or replace function public.protect_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' and new.moderation_status is distinct from 'pending' then
    raise exception 'artists cannot approve their own images';
  end if;
  if tg_op = 'UPDATE' and (
    new.moderation_status is distinct from old.moderation_status
    or new.listing_id is distinct from old.listing_id
  ) then
    raise exception 'artists cannot change image moderation';
  end if;
  return new;
end;
$$;

create trigger images_protect before insert or update on public.portfolio_images
for each row execute function public.protect_image();

alter table public.cities enable row level security;
alter table public.city_zips enable row level security;
alter table public.styles enable row level security;
alter table public.user_roles enable row level security;
alter table public.artists enable row level security;
alter table public.listings enable row level security;
alter table public.listing_styles enable row level security;
alter table public.portfolio_images enable row level security;
alter table public.booking_requests enable row level security;
alter table public.reports enable row level security;

create policy cities_read on public.cities for select to anon, authenticated using (true);
create policy zips_read on public.city_zips for select to anon, authenticated using (true);
create policy styles_read on public.styles for select to anon, authenticated using (true);

create policy roles_select on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy artists_select on public.artists
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy artists_insert on public.artists
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and age_acknowledged_at is not null
    and image_rights_acknowledged_at is not null
  );

create policy listings_public_read on public.listings
  for select to anon, authenticated
  using (published and moderation_status = 'approved');

create policy listings_owner_read on public.listings
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.artists a
      where a.id = artist_id and a.user_id = auth.uid()
    )
  );

create policy listings_owner_insert on public.listings
  for insert to authenticated
  with check (
    moderation_status = 'pending'
    and featured = false
    and featured_until is null
    and exists (
      select 1 from public.artists a
      where a.id = artist_id and a.user_id = auth.uid()
    )
  );

create policy listings_owner_update on public.listings
  for update to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = auth.uid())
  );

create policy styles_join_public on public.listing_styles
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.published and l.moderation_status = 'approved'
    )
    or public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = auth.uid()
    )
  );

create policy styles_join_write on public.listing_styles
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = auth.uid()
    )
  );

create policy images_public_read on public.portfolio_images
  for select to anon, authenticated
  using (
    (
      moderation_status = 'approved'
      and exists (
        select 1 from public.listings l
        where l.id = listing_id and l.published and l.moderation_status = 'approved'
      )
    )
    or public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = auth.uid()
    )
  );

create policy images_owner_insert on public.portfolio_images
  for insert to authenticated
  with check (
    moderation_status = 'pending'
    and rights_acknowledged_at is not null
    and exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = auth.uid()
    )
  );

create policy images_owner_update on public.portfolio_images
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = auth.uid()
    )
  );

create policy images_owner_delete on public.portfolio_images
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = auth.uid()
    )
  );

create policy bookings_artist on public.booking_requests
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.artists a
      where a.id = artist_id and a.user_id = auth.uid()
    )
  );

create policy bookings_artist_update on public.booking_requests
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.artists a
      where a.id = artist_id and a.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.artists a
      where a.id = artist_id and a.user_id = auth.uid()
    )
  );

create policy reports_admin_select on public.reports
  for select to authenticated
  using (public.is_admin());

create policy reports_admin_update on public.reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.cities, public.city_zips, public.styles, public.user_roles, public.artists, public.listings, public.listing_styles, public.portfolio_images, public.booking_requests, public.reports from anon, authenticated;

grant select on public.cities, public.city_zips, public.styles to anon, authenticated;
grant select on public.listings, public.listing_styles, public.portfolio_images to anon, authenticated;
grant select on public.user_roles, public.artists to authenticated;
grant select, insert, update on public.listings to authenticated;
grant select, insert, update, delete on public.listing_styles, public.portfolio_images to authenticated;
grant select, insert on public.artists to authenticated;
grant select, update on public.booking_requests to authenticated;
grant select, update on public.reports to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', false, 1572864, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists portfolio_public_read on storage.objects;
-- Private bucket. Approved images are handed out as short-lived signed URLs.
-- Anon cannot list or read objects. Moderator remove deletes the object.

drop policy if exists portfolio_artist_insert on storage.objects;
create policy portfolio_artist_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
    and lower(name) like '%.webp'
  );

drop policy if exists portfolio_artist_delete on storage.objects;
create policy portfolio_artist_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

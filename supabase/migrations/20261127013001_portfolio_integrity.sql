-- Follow-up to the already-applied grant and public-read migrations.
-- Do not silently relink existing objects. Stop for operator review if any
-- pre-existing metadata does not match the application's canonical object key.
do $$
begin
  if exists (
    select 1 from public.portfolio_images i
    join public.listings l on l.id = i.listing_id
    join public.artists a on a.id = l.artist_id
    where i.storage_path is distinct from (a.user_id::text || '/' || i.id::text || '.webp')
  ) then
    raise exception 'portfolio integrity preflight failed; review existing metadata before migration';
  end if;
end
$$;

-- The application already uploads via its server-side service client. Keep
-- storage writes server-only so approved objects cannot be silently replaced.
drop policy if exists portfolio_artist_insert on storage.objects;
drop policy if exists portfolio_artist_delete on storage.objects;

-- Server-only image creation/deletion; moderator updates are status-only.
drop policy if exists images_owner_insert on public.portfolio_images;
drop policy if exists images_owner_delete on public.portfolio_images;
drop policy if exists images_owner_update on public.portfolio_images;
revoke insert, update, delete on public.portfolio_images from public, anon, authenticated;
grant update (moderation_status) on public.portfolio_images to authenticated;
create policy images_admin_update on public.portfolio_images
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Bind the storage object to the owning auth user and immutable image ID.
-- This applies even to privileged inserts and prevents cross-listing references.
create or replace function public.protect_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_path text;
begin
  select a.user_id::text || '/' || new.id::text || '.webp'
    into expected_path
  from public.listings l
  join public.artists a on a.id = l.artist_id
  where l.id = new.listing_id;

  if expected_path is null or new.storage_path is distinct from expected_path then
    raise exception 'invalid portfolio object binding';
  end if;

  if tg_op = 'INSERT' then
    if new.moderation_status is distinct from 'pending' then
      raise exception 'new images must be pending';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.listing_id is distinct from old.listing_id
    or new.storage_path is distinct from old.storage_path
    or new.alt_text is distinct from old.alt_text
    or new.tag is distinct from old.tag
    or new.byte_size is distinct from old.byte_size
    or new.rights_acknowledged_at is distinct from old.rights_acknowledged_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'image metadata is immutable; upload a new pending image';
  end if;

  if new.moderation_status is distinct from old.moderation_status
    and not public.is_admin() then
    raise exception 'only admins can change image moderation';
  end if;
  return new;
end;
$$;

-- Preserve the original hardening, even if role defaults change.
revoke execute on function public.protect_image() from public, anon, authenticated;

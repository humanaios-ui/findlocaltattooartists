-- Performance: evaluate auth.uid() once per query, not once per row,
-- and index foreign keys the policies and joins use. Same rules as before.

drop policy roles_select on public.user_roles;
create policy roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy artists_select on public.artists;
create policy artists_select on public.artists
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy artists_insert on public.artists;
create policy artists_insert on public.artists
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and age_acknowledged_at is not null
    and image_rights_acknowledged_at is not null
  );

drop policy listings_owner_read on public.listings;
create policy listings_owner_read on public.listings
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.artists a
      where a.id = artist_id and a.user_id = (select auth.uid())
    )
  );

drop policy listings_owner_insert on public.listings;
create policy listings_owner_insert on public.listings
  for insert to authenticated
  with check (
    moderation_status = 'pending'
    and featured = false
    and featured_until is null
    and exists (
      select 1 from public.artists a
      where a.id = artist_id and a.user_id = (select auth.uid())
    )
  );

drop policy listings_owner_update on public.listings;
create policy listings_owner_update on public.listings
  for update to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = (select auth.uid()))
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.artists a where a.id = artist_id and a.user_id = (select auth.uid()))
  );

drop policy styles_join_public on public.listing_styles;
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
      where l.id = listing_id and a.user_id = (select auth.uid())
    )
  );

drop policy styles_join_write on public.listing_styles;
create policy styles_join_write on public.listing_styles
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = (select auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = (select auth.uid())
    )
  );

drop policy images_public_read on public.portfolio_images;
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
      where l.id = listing_id and a.user_id = (select auth.uid())
    )
  );

drop policy images_owner_insert on public.portfolio_images;
create policy images_owner_insert on public.portfolio_images
  for insert to authenticated
  with check (
    moderation_status = 'pending'
    and rights_acknowledged_at is not null
    and exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = (select auth.uid())
    )
  );

drop policy images_owner_update on public.portfolio_images;
create policy images_owner_update on public.portfolio_images
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = (select auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = (select auth.uid())
    )
  );

drop policy images_owner_delete on public.portfolio_images;
create policy images_owner_delete on public.portfolio_images
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = (select auth.uid())
    )
  );

drop policy bookings_artist on public.booking_requests;
create policy bookings_artist on public.booking_requests
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.artists a
      where a.id = artist_id and a.user_id = (select auth.uid())
    )
  );

drop policy bookings_artist_update on public.booking_requests;
create policy bookings_artist_update on public.booking_requests
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.artists a
      where a.id = artist_id and a.user_id = (select auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.artists a
      where a.id = artist_id and a.user_id = (select auth.uid())
    )
  );

create index if not exists bookings_listing_idx on public.booking_requests (listing_id);
create index if not exists bookings_city_idx on public.booking_requests (preferred_city);
create index if not exists city_zips_city_idx on public.city_zips (city_slug);
create index if not exists listing_styles_style_idx on public.listing_styles (style_slug);
create index if not exists reports_listing_idx on public.reports (listing_id);

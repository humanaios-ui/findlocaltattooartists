-- Signed-out visitors (anon) must be able to read the styles and photos of
-- approved listings. The old read rules also checked is_admin() and the
-- artists table, which anon may not use, so Postgres refused the whole query
-- ("permission denied for table artists"). Split each rule in two:
-- the public part for everyone, the owner/admin part for signed-in users only.
-- Permissive rules combine with OR, so signed-in access is unchanged.

drop policy styles_join_public on public.listing_styles;
create policy styles_join_public on public.listing_styles
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.published and l.moderation_status = 'approved'
    )
  );
-- Owners and admins already read their styles through styles_join_write
-- (for all to authenticated), so no extra read rule is needed here.

drop policy images_public_read on public.portfolio_images;
create policy images_public_read on public.portfolio_images
  for select to anon, authenticated
  using (
    moderation_status = 'approved'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.published and l.moderation_status = 'approved'
    )
  );

create policy images_owner_read on public.portfolio_images
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.listings l
      join public.artists a on a.id = l.artist_id
      where l.id = listing_id and a.user_id = (select auth.uid())
    )
  );

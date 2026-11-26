-- Applied to the FTLA Supabase project on 2026-11-26 after the init migration.
-- Clears the Supabase security advisor warnings for this schema.

-- Trigger functions are never called directly; keep them off the API.
revoke execute on function public.protect_listing() from public, anon, authenticated;
revoke execute on function public.protect_booking() from public, anon, authenticated;
revoke execute on function public.protect_image() from public, anon, authenticated;
revoke execute on function public.requeue_listing_on_style_change() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.enforce_listing_zip() from public, anon, authenticated;

-- is_admin() is used by policies for signed-in users only.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Fixed search_path on the two non-definer functions.
alter function public.set_updated_at() set search_path = public;
alter function public.enforce_listing_zip() set search_path = public;

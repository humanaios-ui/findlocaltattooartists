import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
const describeIf = databaseUrl ? describe : describe.skip;

describeIf("postgres row level security", () => {
  it("applies the migration and enforces the review cases", async () => {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await client.query(readFileSync("supabase/tests/stubs.sql", "utf8"));
      for (const name of readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).sort()) {
        await client.query(readFileSync(`supabase/migrations/${name}`, "utf8"));
      }

      const artistA = "00000000-0000-4000-8000-0000000000a1";
      const artistB = "00000000-0000-4000-8000-0000000000b1";
      const admin = "00000000-0000-4000-8000-0000000000c1";
      await client.query(
        `insert into auth.users (id, email) values ($1, 'a@example.com'), ($2, 'b@example.com'), ($3, 'admin@example.com')`,
        [artistA, artistB, admin],
      );
      await client.query(
        `insert into public.user_roles (user_id, role) values ($1, 'artist'), ($2, 'artist'), ($3, 'admin')`,
        [artistA, artistB, admin],
      );

      const artistRowA = await asUser(client, artistA, async () => {
        const inserted = await client.query(
          `insert into public.artists (user_id, email, age_acknowledged_at, image_rights_acknowledged_at)
           values ($1, 'a@example.com', now(), now()) returning id`,
          [artistA],
        );
        return inserted.rows[0].id as string;
      });
      const listing = await asUser(client, artistA, async () => {
        const inserted = await client.query(
          `insert into public.listings (artist_id, slug, display_name, city_slug, bio, published)
           values ($1, 'artist-a', 'Artist A', 'phoenix', $2, true) returning id`,
          [artistRowA, "A long enough bio for the listing row in the database test."],
        );
        await client.query(`insert into public.listing_styles (listing_id, style_slug) values ($1, 'traditional')`, [
          inserted.rows[0].id,
        ]);
        return inserted.rows[0].id as string;
      });

      await asUser(client, admin, async () => {
        await client.query(`update public.listings set moderation_status = 'approved' where id = $1`, [listing]);
      });

      const imageA = "00000000-0000-4000-8000-000000000001";
      const imagePending = "00000000-0000-4000-8000-000000000002";
      const insertImage = (id: string, path: string) => client.query(
        `insert into public.portfolio_images (id, listing_id, storage_path, alt_text, byte_size, rights_acknowledged_at)
         values ($1, $2, $3, 'Synthetic image', 100, now())`,
        [id, listing, path],
      );
      // Privileged fixture represents the authorized server path, not a live storage upload.
      await insertImage(imageA, `${artistA}/${imageA}.webp`);
      await insertImage(imagePending, `${artistA}/${imagePending}.webp`);
      await expect(insertImage("00000000-0000-4000-8000-000000000003",
        `${artistB}/00000000-0000-4000-8000-000000000003.webp`)).rejects.toThrow(/object binding/);
      await asUser(client, admin, () => client.query(
        `update public.portfolio_images set moderation_status = 'approved' where id = $1`, [imageA],
      ));
      // The owner must not bypass the server, replace approved metadata or approve pending work.
      await expect(asUser(client, artistA, () => insertImage("00000000-0000-4000-8000-000000000004",
        `${artistA}/00000000-0000-4000-8000-000000000004.webp`))).rejects.toThrow(/permission denied/);
      await expect(asUser(client, artistA, () => client.query(
        `update public.portfolio_images set storage_path = $2 where id = $1`, [imageA, `${artistB}/${imageA}.webp`],
      ))).rejects.toThrow(/permission denied/);
      await expect(asUser(client, artistA, () => client.query(
        `delete from public.portfolio_images where id = $1`, [imageA],
      ))).rejects.toThrow(/permission denied/);
      const refusedApproval = await asUser(client, artistA, () => client.query(
        `update public.portfolio_images set moderation_status = 'approved' where id = $1`, [imagePending],
      ));
      expect(refusedApproval.rowCount).toBe(0);
      await expect(client.query(`update public.portfolio_images set alt_text = 'Changed' where id = $1`, [imageA]))
        .rejects.toThrow(/immutable/);
      const visibleIds = async (actor: string) => (await asUser(client, actor, () =>
        client.query(`select id from public.portfolio_images order by id`))).rows.map((row) => row.id);
      expect(await visibleIds(artistA)).toEqual([imageA, imagePending]);
      expect(await visibleIds(artistB)).toEqual([imageA]);
      expect(await visibleIds(admin)).toEqual([imageA, imagePending]);
      const anonBefore = await asRole(client, "anon", async () => client.query(`select slug from public.listings`));
      expect(anonBefore.rows.map((row: { slug: string }) => row.slug)).toEqual(["artist-a"]);
      const anonStyles = await asRole(client, "anon", async () =>
        client.query(`select style_slug from public.listing_styles`),
      );
      expect(anonStyles.rows.map((row: { style_slug: string }) => row.style_slug)).toEqual(["traditional"]);
      const anonImages = await asRole(client, "anon", async () => client.query(`select id from public.portfolio_images`));
      expect(anonImages.rows.map((row) => row.id)).toEqual([imageA]);

      await asUser(client, artistA, async () => {
        await client.query(`update public.listings set published = false where id = $1`, [listing]);
      });
      const afterPublishToggle = await client.query(
        `select moderation_status, published from public.listings where id = $1`,
        [listing],
      );
      expect(afterPublishToggle.rows[0].moderation_status).toBe("approved");
      expect(afterPublishToggle.rows[0].published).toBe(false);
      expect((await asRole(client, "anon", () => client.query(`select id from public.portfolio_images`))).rows).toHaveLength(0);
      await asUser(client, artistA, async () => {
        await client.query(`update public.listings set published = true where id = $1`, [listing]);
      });

      await asUser(client, artistA, async () => {
        await client.query(`update public.listings set bio = $2 where id = $1`, [
          listing,
          "Rewritten bio that must go back to pending review before it is public again.",
        ]);
      });
      const afterEdit = await client.query(`select moderation_status from public.listings where id = $1`, [listing]);
      expect(afterEdit.rows[0].moderation_status).toBe("pending");
      const anonAfter = await asRole(client, "anon", async () => client.query(`select slug from public.listings`));
      expect(anonAfter.rows).toHaveLength(0);
      const anonStylesPending = await asRole(client, "anon", async () =>
        client.query(`select style_slug from public.listing_styles`),
      );
      expect(anonStylesPending.rows).toHaveLength(0);
      const ownerStylesPending = await asUser(client, artistA, async () =>
        client.query(`select style_slug from public.listing_styles`),
      );
      expect(ownerStylesPending.rows).toHaveLength(1);
      expect(await visibleIds(artistA)).toEqual([imageA, imagePending]);
      expect(await visibleIds(artistB)).toEqual([]);
      expect(await visibleIds(admin)).toEqual([imageA, imagePending]);
      expect((await asRole(client, "anon", () => client.query(`select id from public.portfolio_images`))).rows).toHaveLength(0);
      const otherStylesPending = await asUser(client, artistB, async () =>
        client.query(`select style_slug from public.listing_styles`),
      );
      expect(otherStylesPending.rows).toHaveLength(0);

      await asUser(client, artistB, async () => {
        await client.query(`update public.listings set display_name = 'Stolen' where id = $1`, [listing]);
      });
      const unchanged = await client.query(`select display_name from public.listings where id = $1`, [listing]);
      expect(unchanged.rows[0].display_name).toBe("Artist A");

      await expect(
        asUser(client, artistA, async () => {
          await client.query(`update public.listings set featured = true where id = $1`, [listing]);
        }),
      ).rejects.toThrow(/featured/);
      await expect(
        asUser(client, artistA, async () => {
          await client.query(`update public.listings set slug = 'renamed' where id = $1`, [listing]);
        }),
      ).rejects.toThrow(/slug/);

      await client.query(
        `insert into public.booking_requests (
          listing_id, artist_id, guest_name, guest_email, guest_phone, preferred_city, notes, preferred_dates, age_acknowledged_at, manage_token
        ) values ($1, $2, 'Guest', 'guest@example.com', '5550100', 'phoenix', 'A note', 'Tuesday', now(), 'token-1')`,
        [listing, artistRowA],
      );
      await expect(
        asUser(client, artistA, async () => {
          await client.query(`update public.booking_requests set guest_email = 'other@example.com' where manage_token = 'token-1'`);
        }),
      ).rejects.toThrow(/fixed/);
      await asUser(client, artistA, async () => {
        await client.query(`update public.booking_requests set status = 'confirmed' where manage_token = 'token-1'`);
      });
      await expect(
        asUser(client, artistA, async () => {
          await client.query(`update public.booking_requests set status = 'requested' where manage_token = 'token-1'`);
        }),
      ).rejects.toThrow(/invalid booking/);

      const bucket = await client.query(`select public from storage.buckets where id = 'portfolio'`);
      expect(bucket.rows[0].public).toBe(false);
      // Stubs expose table privileges as Supabase does; RLS must actually deny storage writes.
      const stored = await client.query(`insert into storage.objects (bucket_id, name) values ('portfolio', $1) returning id`,
        [`${artistA}/${imageA}.webp`]);
      expect((await asRole(client, "anon", () => client.query(`select id from storage.objects`))).rows).toHaveLength(0);
      await expect(asUser(client, artistA, () => client.query(
        `insert into storage.objects (bucket_id, name) values ('portfolio', $1)`, [`${artistA}/new.webp`],
      ))).rejects.toThrow(/row-level security/);
      const deletion = await asUser(client, artistA, () => client.query(
        `delete from storage.objects where id = $1`, [stored.rows[0].id],
      ));
      expect(deletion.rowCount).toBe(0);
      expect((await client.query(`select id from storage.objects where id = $1`, [stored.rows[0].id])).rowCount).toBe(1);
      for (const role of ["anon", "authenticated"]) {
        const grant = await client.query(`select has_function_privilege($1, 'public.protect_image()', 'EXECUTE') as allowed`, [role]);
        expect(grant.rows[0].allowed).toBe(false);
      }
    } finally {
      await client.end();
    }
  });
});

async function asUser<T>(client: pg.Client, userId: string, run: () => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await client.query("set local role authenticated");
    const value = await run();
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function asRole<T>(client: pg.Client, role: "anon" | "authenticated", run: () => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    const value = await run();
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

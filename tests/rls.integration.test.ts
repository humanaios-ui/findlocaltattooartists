import { readFileSync } from "node:fs";
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
      await client.query(readFileSync("supabase/migrations/20261126120000_init.sql", "utf8"));

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

      const anonBefore = await asRole(client, "anon", async () => client.query(`select slug from public.listings`));
      expect(anonBefore.rows.map((row: { slug: string }) => row.slug)).toEqual(["artist-a"]);

      await asUser(client, artistA, async () => {
        await client.query(`update public.listings set published = false where id = $1`, [listing]);
      });
      const afterPublishToggle = await client.query(
        `select moderation_status, published from public.listings where id = $1`,
        [listing],
      );
      expect(afterPublishToggle.rows[0].moderation_status).toBe("approved");
      expect(afterPublishToggle.rows[0].published).toBe(false);
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
      await expect(asRole(client, "anon", async () => client.query(`select id from storage.objects`))).rejects.toThrow();
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

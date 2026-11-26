interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface SessionLocals {
  id: string;
  email: string;
  role: "artist" | "admin";
  artistId: string | null;
}

declare namespace App {
  interface Locals {
    demo: boolean;
    user: SessionLocals | null;
  }
}

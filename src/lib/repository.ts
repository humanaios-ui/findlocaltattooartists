import { createDemoRepository } from "./demo/repository";
import { buildSeedDatabase } from "./demo/seed";
import { AppError } from "./errors";
import { readEnv, resolveMode } from "./mode";
import { createSupabaseRepository } from "./supabase-repository";
import type { DataRepository } from "./types";

let demoRepository: Promise<DataRepository> | null = null;

export async function getRepository(accessToken?: string | null): Promise<DataRepository> {
  const mode = resolveMode(readEnv());
  if (mode.mode === "misconfigured") throw new AppError("config", mode.message);
  if (mode.mode === "demo") {
    demoRepository ??= buildSeedDatabase().then((db) => createDemoRepository(db));
    return demoRepository;
  }
  return createSupabaseRepository(mode, accessToken ?? null);
}

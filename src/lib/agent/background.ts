import { after } from "next/server";

/** Runs work after the response is sent (waitUntil on Workers); falls back to fire-and-forget in tests. */
export function runInBackground(work: () => Promise<unknown>): void {
  const safe = () => work().catch(() => undefined);
  try {
    after(safe);
  } catch {
    void safe();
  }
}

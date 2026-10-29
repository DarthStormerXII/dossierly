import type { Env } from "./env";
import { sha256Hex } from "./util";

export type LedgerKind = "model" | "egress" | "job";
export type LedgerInput = {
  userId: string | null;
  kind: LedgerKind;
  what: string;
  region?: string;
  action?: "allowed" | "denied";
  bytes?: number;
  masked?: number;
  detail?: unknown;
};
export type LedgerEntry = {
  seq: number;
  ts: number;
  kind: LedgerKind;
  what: string;
  region?: string;
  action?: "allowed" | "denied";
  bytes?: number;
  masked?: number;
  prevHash: string;
  hash: string;
};
type Row = {
  seq: number; ts: number; kind: LedgerKind; what: string; region: string | null; action: string | null;
  bytes: number | null; masked: number | null; detail: string | null; prev_hash: string; hash: string;
};

export const GENESIS = "0".repeat(64);

/** Canonical, order-fixed serialisation of a row; the hash input is prev_hash + this string. */
export function canonicalRow(r: Pick<Row, "seq" | "ts" | "kind" | "what" | "region" | "action" | "bytes" | "masked" | "detail">): string {
  return JSON.stringify([r.seq, r.ts, r.kind, r.what, r.region ?? null, r.action ?? null, r.bytes ?? null, r.masked ?? null, r.detail ?? null]);
}

export const entryHash = (prev: string, r: Parameters<typeof canonicalRow>[0]) => sha256Hex(prev + canonicalRow(r));

/** Verifies an oldest-first run of rows: each links to the previous and hashes correctly. */
export async function verifyChain(rows: Row[], startPrev = GENESIS): Promise<boolean> {
  let prev = startPrev;
  for (const r of rows) {
    if (r.prev_hash !== prev || r.hash !== (await entryHash(prev, r))) return false;
    prev = r.hash;
  }
  return true;
}

const chainOf = (userId: string | null) => userId ?? "global";

export async function recordLedger(env: Env, e: LedgerInput): Promise<void> {
  const chain = chainOf(e.userId);
  const detail = e.detail === undefined ? null : JSON.stringify(e.detail);
  for (let attempt = 0; attempt < 16; attempt++) {
    const last = await env.DB.prepare("SELECT seq, hash FROM ledger WHERE chain_id = ? ORDER BY seq DESC LIMIT 1")
      .bind(chain).first<{ seq: number; hash: string }>();
    const prev = last?.hash ?? GENESIS;
    const row = {
      seq: (last?.seq ?? 0) + 1, ts: Date.now(), kind: e.kind, what: e.what.slice(0, 300),
      region: e.region ?? null, action: e.action ?? null, bytes: e.bytes ?? null, masked: e.masked ?? null, detail,
    };
    const hash = await entryHash(prev, row);
    try {
      await env.DB.prepare(
        "INSERT INTO ledger (chain_id, seq, user_id, ts, kind, what, region, action, bytes, masked, detail, prev_hash, hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).bind(chain, row.seq, e.userId, row.ts, row.kind, row.what, row.region, row.action, row.bytes, row.masked, row.detail, prev, hash).run();
      return;
    } catch (err) {
      // A concurrent writer took this seq (UNIQUE chain_id, seq): re-read and retry.
      if (attempt === 15) throw err;
    }
  }
}

/** Newest first; `root` is the head hash, `verified` re-checks the whole chain. */
export async function listLedger(env: Env, userId: string, limit = 100) {
  const chain = chainOf(userId);
  const { results } = await env.DB.prepare(
    "SELECT seq, ts, kind, what, region, action, bytes, masked, detail, prev_hash, hash FROM ledger WHERE chain_id = ? ORDER BY seq DESC LIMIT ?",
  ).bind(chain, Math.min(Math.max(limit, 1), 500)).all<Row>();
  const oldestFirst = [...results].reverse();
  const verified = await verifyChain(oldestFirst, oldestFirst[0]?.prev_hash ?? GENESIS);
  const entries: LedgerEntry[] = results.map((r) => ({
    seq: r.seq, ts: r.ts, kind: r.kind, what: r.what,
    ...(r.region ? { region: r.region } : {}),
    ...(r.action ? { action: r.action as "allowed" | "denied" } : {}),
    ...(r.bytes !== null ? { bytes: r.bytes } : {}),
    ...(r.masked !== null ? { masked: r.masked } : {}),
    prevHash: r.prev_hash, hash: r.hash,
  }));
  return { entries, root: results[0]?.hash ?? GENESIS, verified };
}

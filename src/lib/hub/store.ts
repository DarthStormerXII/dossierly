import type { Env } from "../server/env";
import { sha256Hex, randomId } from "../server/util";

export interface SnapshotRow {
  id: string;
  source_url: string;
  content_hash: string;
  content: string | null;
  fetched_at: number;
}
export interface ChangeRow {
  id: string;
  country: string;
  source_url: string;
  title: string;
  summary: string;
  detected_at: number;
  snapshot_id: string | null;
  sample: number;
}
export interface HubChange {
  id: string;
  title: string;
  summary: string;
  url: string;
  detectedAt: string;
  sample: boolean;
}

export async function latestSnapshot(env: Env, country: string, url: string): Promise<SnapshotRow | null> {
  return env.DB.prepare(
    "SELECT id, source_url, content_hash, content, fetched_at FROM hub_snapshots WHERE country = ? AND source_url = ? ORDER BY fetched_at DESC LIMIT 1",
  ).bind(country, url).first<SnapshotRow>();
}

export async function insertSnapshot(env: Env, country: string, url: string, content: string): Promise<SnapshotRow> {
  const row: SnapshotRow = {
    id: randomId("snap"),
    source_url: url,
    content_hash: await sha256Hex(content),
    content,
    fetched_at: Date.now(),
  };
  await env.DB.prepare(
    "INSERT INTO hub_snapshots (id, country, source_url, content_hash, content, fetched_at) VALUES (?,?,?,?,?,?)",
  ).bind(row.id, country, row.source_url, row.content_hash, row.content, row.fetched_at).run();
  return row;
}

export async function insertChange(env: Env, country: string, c: { url: string; title: string; summary: string; snapshotId: string | null; sample?: boolean }): Promise<boolean> {
  const id = `chg_${(await sha256Hex(`${c.url}|${c.title}`)).slice(0, 20)}`;
  const res = await env.DB.prepare(
    "INSERT OR IGNORE INTO hub_changes (id, country, source_url, title, summary, detected_at, snapshot_id, sample) VALUES (?,?,?,?,?,?,?,?)",
  ).bind(id, country, c.url, c.title, c.summary, Date.now(), c.snapshotId, c.sample ? 1 : 0).run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function listChanges(env: Env, country: string, limit = 50): Promise<HubChange[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, country, source_url, title, summary, detected_at, snapshot_id, sample FROM hub_changes WHERE country = ? ORDER BY detected_at DESC LIMIT ?",
  ).bind(country, limit).all<ChangeRow>();
  return results.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    url: r.source_url,
    detectedAt: new Date(r.detected_at).toISOString(),
    sample: r.sample === 1,
  }));
}

import { describe, expect, it } from "vitest";
import { HEARTBEAT_EVERY_MS, putIfChanged, touchHeartbeat } from "@/lib/server/heartbeat";
import type { KVLike } from "@/lib/server/env";

function countingKv() {
  const data = new Map<string, string>();
  const kv: KVLike & { puts: number } = {
    puts: 0,
    async get(k) { return data.get(k) ?? null; },
    async put(k, v) { kv.puts++; data.set(k, v); },
    async delete(k) { data.delete(k); },
  };
  return kv;
}

describe("heartbeat writes", () => {
  it("writes at most once per interval while the bridge polls every 2 s", async () => {
    const kv = countingKv();
    for (let t = 0; t < 60_000; t += 2_000) await touchHeartbeat(kv, "bridge:lastSeen", 1_000_000 + t);
    expect(kv.puts).toBe(Math.ceil(60_000 / HEARTBEAT_EVERY_MS));
    expect(Number(await kv.get("bridge:lastSeen"))).toBeGreaterThanOrEqual(1_000_000 + 60_000 - HEARTBEAT_EVERY_MS);
  });

  it("does not skip the write when the previous put failed", async () => {
    const kv = countingKv();
    const put = kv.put;
    kv.put = async () => { throw new Error("kv down"); };
    await expect(touchHeartbeat(kv, "asr:lastSeen", 5_000)).rejects.toThrow("kv down");
    kv.put = put;
    expect(await touchHeartbeat(kv, "asr:lastSeen", 6_000)).toBe(true);
    expect(await kv.get("asr:lastSeen")).toBe("6000");
  });

  it("keeps namespaces separate", async () => {
    const a = countingKv();
    const b = countingKv();
    await touchHeartbeat(a, "bridge:lastSeen", 1_000);
    expect(await touchHeartbeat(b, "bridge:lastSeen", 1_001)).toBe(true);
  });

  it("writes the sandbox count only when it changes", async () => {
    const kv = countingKv();
    for (let t = 0; t < 30; t++) await putIfChanged(kv, "bridge:sandboxes", "2", t * 2_000);
    expect(kv.puts).toBe(1);
    await putIfChanged(kv, "bridge:sandboxes", "3", 61_000);
    expect(kv.puts).toBe(2);
    expect(await kv.get("bridge:sandboxes")).toBe("3");
  });
});

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const SETTLA_DIR = process.env.SETTLA_DIR ?? join(homedir(), ".settla");

function parseEnvFile(path) {
  const out = {};
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** ~/.settla/bridge.env, with process env taking precedence. Secrets are never logged. */
export function loadConfig(env = process.env) {
  const f = { ...parseEnvFile(join(SETTLA_DIR, "bridge.env")), ...env };
  const pool = Number(f.POOL_SIZE ?? 4);
  return {
    url: (f.BRIDGE_URL ?? "https://dossierly.pages.dev").replace(/\/$/, ""),
    secret: f.BRIDGE_SECRET ?? "",
    mask: f.SETTLA_MASK ?? "",
    pollMs: Number(f.POLL_MS ?? 2000),
    maxConcurrent: Number(f.MAX_CONCURRENT ?? 2),
    idleStopMs: Number(f.IDLE_STOP_MIN ?? 15) * 60_000,
    dcodeTimeoutS: Number(f.DCODE_TIMEOUT_S ?? 240),
    sampleUserId: f.SAMPLE_USER_ID ?? "sample-arjun",
    sampleSandbox: f.SAMPLE_SANDBOX ?? "companion-arjun",
    poolNames: Array.from({ length: pool }, (_, i) => `settla-pool-${String(i + 1).padStart(2, "0")}`),
    appDir: f.APP_DIR ?? join(SETTLA_DIR, "app"),
    stateDir: SETTLA_DIR,
    policySha256: (() => {
      try {
        return readFileSync(join(f.APP_DIR ?? join(SETTLA_DIR, "app"), "agent/policy/dossierly-restricted.sha256"), "utf8").trim().split(/\s+/)[0];
      } catch {
        return undefined;
      }
    })(),
  };
}

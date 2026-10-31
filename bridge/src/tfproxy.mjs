import { createHmac } from "node:crypto";
import { nemo } from "./shell.mjs";

const CONFIG = "/sandbox/.deepagents/config.toml";
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
const SAFE_URL = /^https?:\/\/[A-Za-z0-9.:_-]+(\/[A-Za-z0-9._~-]+)+$/;

/** Hex HMAC-SHA256(BRIDGE_SECRET, "tf-proxy:" + sandbox): the same value the Worker checks. */
export const proxySig = (secret, sandbox) => createHmac("sha256", secret).update(`tf-proxy:${sandbox}`).digest("hex");

/** The OpenAI-compatible base URL a sandbox must use: every Token Factory call then goes through the Worker's meter. */
export function proxyBaseUrl(cfg, sandbox) {
  const app = (cfg.appUrl ?? cfg.url).replace(/\/$/, "");
  return `${app}/api/tf/${encodeURIComponent(sandbox)}/${proxySig(cfg.secret, sandbox)}/v1`;
}

/** Shell that rewrites base_url in the sandbox config. Prints "same", "changed" or fails (exit 3 no file, 4 no base_url line). */
export function rewriteScript(url) {
  if (!SAFE_URL.test(url)) throw new Error("unsafe proxy URL");
  return [
    `f=${CONFIG}`,
    `[ -f "$f" ] || exit 3`,
    `if grep -qE '^[[:space:]]*base_url[[:space:]]*=[[:space:]]*"${url}"[[:space:]]*$' "$f"; then echo same; exit 0; fi`,
    `grep -qE '^[[:space:]]*base_url[[:space:]]*=' "$f" || exit 4`,
    `t=$(mktemp) && sed 's|^\\([[:space:]]*base_url[[:space:]]*=[[:space:]]*\\).*|\\1"${url}"|' "$f" > "$t" && cat "$t" > "$f" && rm -f "$t" && echo changed`,
  ].join("; ");
}

/**
 * Points the sandbox's Deep Agents config at the metering proxy (idempotent; leaves api_key_env alone).
 * Fails closed: a sandbox that cannot be pointed would call Token Factory unmetered, so the task must not run in it.
 * TF_PROXY=0 in bridge.env switches this off (rollback).
 */
export async function pointSandboxAtProxy(sandbox, cfg, run = nemo) {
  if (cfg.tfProxy === false) return "disabled";
  if (!SAFE_NAME.test(sandbox)) throw new Error("unsafe sandbox name");
  const r = await run([sandbox, "exec", "--no-tty", "--timeout", "20", "--", "sh", "-c", rewriteScript(proxyBaseUrl(cfg, sandbox))], { timeoutMs: 40_000 });
  const out = String(r.stdout ?? "").trim().split("\n").pop();
  if (r.code === 0 && (out === "same" || out === "changed")) return out;
  throw new Error(r.code === 3 ? "sandbox has no Deep Agents config to point at the proxy" : r.code === 4 ? "sandbox config has no base_url line" : `could not point the sandbox at the metering proxy (exit ${r.code})`);
}

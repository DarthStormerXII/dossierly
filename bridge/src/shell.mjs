import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { dirname } from "node:path";

/** Environment every nemo-deepagents/openshell call needs (a missing DOCKER_HOST once stopped the shared gateway). */
export function nemoEnv() {
  const home = homedir();
  return {
    ...process.env,
    PATH: [dirname(process.execPath), "/opt/homebrew/bin", `${home}/.local/bin`, "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":"),
    DOCKER_HOST: `unix://${home}/.colima/default/docker.sock`,
    NEMOCLAW_GATEWAY_PORT: "19260",
    NEMOCLAW_DISABLE_TELEMETRY: "1",
    NEMOCLAW_NO_POLICY_HINT: "1",
    NO_COLOR: "1",
  };
}

/** Runs a command without a shell. Resolves with code/stdout/stderr; never rejects. */
export function run(cmd, args, { timeoutMs = 120_000, input, env = nemoEnv(), maxBytes = 8_000_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => { if (stdout.length < maxBytes) stdout += d; });
    child.stderr.on("data", (d) => { if (stderr.length < maxBytes) stderr += d; });
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: `${stderr}${e.message}`, timedOut }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? -1, stdout, stderr, timedOut }); });
    child.stdin.end(input ?? "");
  });
}

const LOCK_HINT = /another state operation owns|state-migration\.lock/;

/**
 * nemo-deepagents takes a short global state lock at startup, so parallel invocations collide
 * ("another state operation owns ... lock"). That error is transient: retry with jitter.
 */
export async function nemo(args, opts) {
  let r;
  for (let i = 0; i < 12; i++) {
    r = await run("nemo-deepagents", args, opts);
    if (r.code === 0 || !LOCK_HINT.test(r.stderr + r.stdout)) return r;
    await sleep(250 + Math.random() * 600);
  }
  return r;
}
export const docker = (args, opts) => run("docker", args, opts);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

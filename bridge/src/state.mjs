import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** JSON state on the M2 under ~/.settla, written atomically (tmp + rename). */
export function makeStore(dir, file, initial) {
  const path = join(dir, file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    data = initial();
  }
  return {
    data,
    save() {
      const tmp = `${path}.tmp`;
      writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
      renameSync(tmp, path);
    },
  };
}

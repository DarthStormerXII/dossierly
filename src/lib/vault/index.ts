import { idbDestroy, idbGet, idbSet } from "./idb";
import { createPasskeyKey, newDeviceKey, open, seal, unlockPasskey, type KeyRecord, type Sealed } from "./keys";

export { passkeySupported } from "./keys";
export type VaultKind = KeyRecord["kind"];
export type VaultState = { status: "ready"; kind: VaultKind } | { status: "locked"; kind: "passkey" } | { status: "unavailable" };

let active: CryptoKey | null = null;
let activeKind: VaultKind | null = null;

/** Opens the vault, creating a device key on first use. A passkey vault stays locked until unlock(). */
export async function openVault(): Promise<VaultState> {
  if (typeof indexedDB === "undefined" || !crypto?.subtle) return { status: "unavailable" };
  try {
    if (active && activeKind) return { status: "ready", kind: activeKind };
    let rec = await idbGet<KeyRecord>("key");
    if (!rec) {
      rec = await newDeviceKey();
      await idbSet("key", rec);
    }
    if (rec.kind === "passkey") return { status: "locked", kind: "passkey" };
    active = rec.key;
    activeKind = "device";
    return { status: "ready", kind: "device" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function unlock(): Promise<VaultState> {
  const rec = await idbGet<KeyRecord>("key");
  if (!rec || rec.kind !== "passkey") return openVault();
  active = await unlockPasskey(rec);
  activeKind = "passkey";
  return { status: "ready", kind: "passkey" };
}

export async function loadDoc<T>(name: string): Promise<T | null> {
  if (!active) return null;
  const sealed = await idbGet<Sealed>(`doc:${name}`);
  if (!sealed) return null;
  try {
    return await open<T>(active, sealed);
  } catch {
    return null;
  }
}

export async function saveDoc(name: string, value: unknown): Promise<void> {
  if (!active) throw new Error("Vault is locked");
  await idbSet(`doc:${name}`, await seal(active, value));
}

/** Moves every document under a new passkey-derived key. Throws "prf_unsupported" when the browser cannot. */
export async function protectWithPasskey(names: string[]): Promise<void> {
  const docs = await Promise.all(names.map(async (n) => [n, await loadDoc<unknown>(n)] as const));
  const { record, key } = await createPasskeyKey();
  active = key;
  activeKind = "passkey";
  for (const [n, v] of docs) if (v !== null) await saveDoc(n, v);
  await idbSet("key", record);
}

/** Destroys the key and every stored document on this device. Not recoverable. */
export async function destroyVault(): Promise<void> {
  active = null;
  activeKind = null;
  await idbDestroy();
}

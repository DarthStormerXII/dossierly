import { idbDeletePrefix, idbGet, idbSet } from "./idb";
import { createPasskeyKey, newDeviceKey, open, seal, unlockPasskey, type KeyRecord, type Sealed } from "./keys";

export { passkeySupported } from "./keys";
export type VaultKind = KeyRecord["kind"];
export type VaultState = { status: "ready"; kind: VaultKind } | { status: "locked"; kind: "passkey" } | { status: "unavailable" };

let active: CryptoKey | null = null;
let activeKind: VaultKind | null = null;
let activeAccount: string | null = null;
const prefix = (id: string) => `account:${encodeURIComponent(id)}:`;
const keyName = (id: string, name: string) => `${prefix(id)}${name}`;
let opening: Promise<unknown> = Promise.resolve();

export function openVault(accountId: string): Promise<VaultState> {
  const result = opening.then(() => openAccountVault(accountId));
  opening = result.catch(() => undefined);
  return result;
}

/** Opens the vault, creating a device key on first use. A passkey vault stays locked until unlock(). */
async function openAccountVault(accountId: string): Promise<VaultState> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(accountId)) return { status: "unavailable" };
  if (typeof indexedDB === "undefined" || !crypto?.subtle) return { status: "unavailable" };
  try {
    if (active && activeKind && activeAccount === accountId) return { status: "ready", kind: activeKind };
    active = null;
    activeKind = null;
    activeAccount = accountId;
    // Never adopt the unowned legacy "key" or "doc:dossier" into an email account.
    let rec = await idbGet<KeyRecord>(keyName(accountId, "key"));
    if (!rec) {
      rec = await newDeviceKey();
      await idbSet(keyName(accountId, "key"), rec);
    }
    if (activeAccount !== accountId) return { status: "unavailable" };
    if (rec.kind === "passkey") return { status: "locked", kind: "passkey" };
    active = rec.key;
    activeKind = "device";
    return { status: "ready", kind: "device" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function unlock(): Promise<VaultState> {
  if (!activeAccount) return { status: "unavailable" };
  const rec = await idbGet<KeyRecord>(keyName(activeAccount, "key"));
  if (!rec || rec.kind !== "passkey") return openVault(activeAccount);
  active = await unlockPasskey(rec);
  activeKind = "passkey";
  return { status: "ready", kind: "passkey" };
}

export async function loadDoc<T>(name: string, accountId = activeAccount): Promise<T | null> {
  const key = active;
  if (!key || !accountId || activeAccount !== accountId) return null;
  const sealed = await idbGet<Sealed>(keyName(accountId, `doc:${name}`));
  if (activeAccount !== accountId) return null;
  if (!sealed) return null;
  try {
    const value = await open<T>(key, sealed);
    return activeAccount === accountId ? value : null;
  } catch {
    return null;
  }
}

export async function saveDoc(name: string, value: unknown, accountId = activeAccount): Promise<void> {
  const key = active;
  if (!key || !accountId || activeAccount !== accountId) throw new Error("Vault is locked for this account");
  const sealed = await seal(key, value);
  if (activeAccount !== accountId) throw new Error("Account changed before saving");
  await idbSet(keyName(accountId, `doc:${name}`), sealed);
}

/** Moves every document under a new passkey-derived key. Throws "prf_unsupported" when the browser cannot. */
export async function protectWithPasskey(names: string[]): Promise<void> {
  if (!activeAccount) throw new Error("Vault is locked");
  const accountId = activeAccount;
  const docs = await Promise.all(names.map(async (n) => [n, await loadDoc<unknown>(n)] as const));
  const { record, key } = await createPasskeyKey();
  if (activeAccount !== accountId) throw new Error("Account changed");
  active = key;
  activeKind = "passkey";
  for (const [n, v] of docs) if (v !== null) await saveDoc(n, v);
  await idbSet(keyName(accountId, "key"), record);
}

/** Destroys the active account's key/documents only. Other accounts and legacy records remain. */
export async function destroyVault(): Promise<void> {
  const accountId = activeAccount;
  active = null;
  activeKind = null;
  activeAccount = null;
  if (accountId) await idbDeletePrefix(prefix(accountId));
}

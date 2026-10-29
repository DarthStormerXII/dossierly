/**
 * Vault keys. Two honest options:
 *  - "passkey": AES-GCM key derived with HKDF from the WebAuthn PRF output of a passkey. Never stored;
 *    re-derived each visit by touching the passkey.
 *  - "device": a random AES-GCM key generated non-extractable and kept in this browser's IndexedDB.
 *    Protects against casual reads of the storage, not against someone with this unlocked device.
 */
export type KeyRecord =
  | { kind: "device"; key: CryptoKey }
  | { kind: "passkey"; credentialId: string; salt: string };

const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function newDeviceKey(): Promise<KeyRecord> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return { kind: "device", key };
}

async function hkdfToAes(secret: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("dossierly-vault-v1"), info: enc.encode("case-store") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

export function passkeySupported(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials;
}

async function evalPrf(credentialId: Uint8Array, salt: Uint8Array): Promise<ArrayBuffer> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: credentialId as BufferSource }],
      userVerification: "required",
      extensions: { prf: { eval: { first: salt as BufferSource } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const out = cred?.getClientExtensionResults() as PrfResults | undefined;
  const first = out?.prf?.results?.first;
  if (!first) throw new Error("prf_unsupported");
  return first;
}

/** Creates a passkey with PRF and returns its key record plus the derived AES key. Throws "prf_unsupported". */
export async function createPasskeyKey(): Promise<{ record: KeyRecord; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Dossierly" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "My Dossierly case", displayName: "My Dossierly case" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("cancelled");
  const ext = cred.getClientExtensionResults() as PrfResults;
  if (ext.prf?.enabled === false) throw new Error("prf_unsupported");
  const id = new Uint8Array(cred.rawId);
  const key = await hkdfToAes(await evalPrf(id, salt));
  return { record: { kind: "passkey", credentialId: b64(id), salt: b64(salt) }, key };
}

export async function unlockPasskey(rec: Extract<KeyRecord, { kind: "passkey" }>): Promise<CryptoKey> {
  return hkdfToAes(await evalPrf(unb64(rec.credentialId), unb64(rec.salt)));
}

export type Sealed = { iv: string; data: string };

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return { iv: b64(iv), data: b64(data) };
}

export async function open<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(sealed.iv) }, key, unb64(sealed.data));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

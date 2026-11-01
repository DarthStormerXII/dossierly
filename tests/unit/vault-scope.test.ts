import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const records = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/vault/idb", () => ({
  idbGet: async (key: string) => records.get(key),
  idbSet: async (key: string, value: unknown) => { records.set(key, value); },
  idbDeletePrefix: async (prefix: string) => { for (const key of records.keys()) if (key.startsWith(prefix)) records.delete(key); },
}));

beforeEach(() => { records.clear(); vi.resetModules(); vi.stubGlobal("indexedDB", {}); });
afterEach(() => vi.unstubAllGlobals());

describe("account-scoped encrypted vault", () => {
  it("does not open before authentication or adopt an unowned legacy dossier", async () => {
    const vault = await import("@/lib/vault");
    records.set("key", { legacy: true }); records.set("doc:dossier", { private: "older case" });
    expect(await vault.loadDoc("dossier")).toBeNull();
    await expect(vault.saveDoc("dossier", {})).rejects.toThrow();
    expect(await vault.openVault("u_arjun")).toMatchObject({ status: "ready" });
    expect(await vault.loadDoc("dossier", "u_arjun")).toBeNull();
    expect(records.get("doc:dossier")).toEqual({ private: "older case" });
  });

  it("keeps cases separate across email accounts in the same browser", async () => {
    const vault = await import("@/lib/vault");
    await vault.openVault("u_arjun"); await vault.saveDoc("dossier", { name: "Arjun Raman" }, "u_arjun");
    await vault.openVault("u_ananya");
    expect(await vault.loadDoc("dossier", "u_ananya")).toBeNull();
    expect(await vault.loadDoc("dossier", "u_arjun")).toBeNull();
    await expect(vault.saveDoc("dossier", { wrong: true }, "u_arjun")).rejects.toThrow();
    await vault.saveDoc("dossier", { name: "Ananya Rao" }, "u_ananya");
    await vault.openVault("u_arjun");
    expect(await vault.loadDoc("dossier", "u_arjun")).toEqual({ name: "Arjun Raman" });
    await vault.openVault("u_ananya");
    expect(await vault.loadDoc("dossier", "u_ananya")).toEqual({ name: "Ananya Rao" });
  });

  it("deletes only the active account, preserving other accounts and legacy records", async () => {
    const vault = await import("@/lib/vault");
    records.set("doc:dossier", "unowned-legacy");
    await vault.openVault("u_arjun"); await vault.saveDoc("dossier", "arjun-case");
    await vault.openVault("u_ananya"); await vault.saveDoc("dossier", "ananya-case");
    await vault.destroyVault();
    expect([...records.keys()].some((key) => key.startsWith("account:u_ananya:"))).toBe(false);
    expect(records.get("doc:dossier")).toBe("unowned-legacy");
    await vault.openVault("u_arjun");
    expect(await vault.loadDoc("dossier")).toBe("arjun-case");
  });

  it("uses one key when concurrent mounts open the same account", async () => {
    const vault = await import("@/lib/vault");
    await Promise.all([vault.openVault("u_arjun"), vault.openVault("u_arjun")]);
    await vault.saveDoc("dossier", { name: "Arjun Raman" });
    // Reload the module to prove data can be decrypted using the persisted key.
    vi.resetModules();
    const reloaded = await import("@/lib/vault");
    await reloaded.openVault("u_arjun");
    expect(await reloaded.loadDoc("dossier")).toEqual({ name: "Arjun Raman" });
  });
});

import { describe, expect, it } from "vitest";
import { Masker, maskerFor } from "@/lib/mask";
import { isValidIban, isValidPesel } from "@/lib/mask/patterns";

// 44051401359 is the PESEL checksum example from the public specification.
const PESEL = "44051401359";
const IBAN = "PL61 1090 1014 0000 0712 1981 2874";

describe("validators", () => {
  it("checks PESEL and IBAN checksums", () => {
    expect(isValidPesel(PESEL)).toBe(true);
    expect(isValidPesel("44051401358")).toBe(false);
    expect(isValidIban(IBAN)).toBe(true);
    expect(isValidIban("PL61 1090 1014 0000 0712 1981 2875")).toBe(false);
  });
});

describe("identifiers", () => {
  it("masks PESEL, restores it, counts it", () => {
    const m = new Masker();
    const out = m.mask(`My PESEL is ${PESEL}.`);
    expect(out).toBe("My PESEL is [PESEL_1].");
    expect(m.count).toBe(1);
    expect(m.restore("Numer: [PESEL_1]")).toBe(`Numer: ${PESEL}`);
  });
  it("masks an 11-digit number after the PESEL label even if the checksum fails", () => {
    expect(new Masker().mask("PESEL: 12345678901")).toBe("PESEL: [PESEL_1]");
  });
  it("leaves an unlabelled 11-digit number with a bad checksum alone", () => {
    expect(new Masker().mask("Order 12345678901")).toBe("Order 12345678901");
  });
  it("masks passport numbers, labelled and bare", () => {
    expect(new Masker().mask("passport no. N1234567")).toContain("[PASSPORT_1]");
    expect(new Masker().mask("Paszport: EA1234567 ważny")).toBe("Paszport: [PASSPORT_1] ważny");
    expect(new Masker().mask("Z9876543 is mine")).toBe("[PASSPORT_1] is mine");
  });
  it("masks a valid IBAN with spaces and a bare NRB", () => {
    expect(new Masker().mask(`Konto ${IBAN} proszę`)).toBe("Konto [IBAN_1] proszę");
    expect(new Masker().mask("61 1090 1014 0000 0712 1981 2874")).toBe("[IBAN_1]");
  });
  it("masks phones in international, Polish and Indian forms", () => {
    const m = new Masker();
    expect(m.mask("+48 601 234 567")).toBe("[PHONE_1]");
    expect(m.mask("601-234-567")).toBe("[PHONE_2]");
    expect(m.mask("tel 9876543210")).toBe("tel [PHONE_3]");
    expect(m.mask("+91 98765 43210")).toBe("[PHONE_4]");
  });
  it("masks emails", () => {
    expect(new Masker().mask("write to arjun.raman@example.com now")).toBe("write to [EMAIL_1] now");
  });
  it("masks case signatures but keeps ordinary dates and amounts", () => {
    const m = new Masker();
    const out = m.mask("Sprawa WSC-II-P.6151.48213.2026 z dnia 27.10.2026, opłata 440 zł");
    expect(out).toBe("Sprawa [CASE_1] z dnia 27.10.2026, opłata 440 zł");
    expect(m.restore(out)).toContain("WSC-II-P.6151.48213.2026");
  });
  it("masks dates of birth only when labelled", () => {
    const m = new Masker();
    expect(m.mask("Data urodzenia: 14.03.1994")).toBe("Data urodzenia: [DOB_1]");
    expect(m.mask("born on 14 March 1994")).toBe("born on [DOB_2]");
    expect(m.mask("date of birth 1994-03-14")).toBe("date of birth [DOB_3]");
    expect(new Masker().mask("Termin do 10.11.2026")).toBe("Termin do 10.11.2026");
  });
});

describe("profile terms", () => {
  it("masks the full name, parts and Polish endings, and restores each form", () => {
    const m = maskerFor({ name: "Arjun Raman" });
    const out = m.mask("Pani Arjun Raman, Arjun, Ramanowi");
    expect(out).not.toMatch(/Arjun|Raman/);
    expect(m.restore(out)).toBe("Pani Arjun Raman, Arjun, Ramanowi");
  });
  it("is case and whitespace insensitive for names and addresses", () => {
    const m = maskerFor({ name: "Arjun Raman", addresses: ["ul. Złota 44 m. 12, Warszawa"] });
    const out = m.mask("ARJUN   RAMAN lives at ul.  Złota 44 m. 12, Warszawa");
    expect(out).toBe("[NAME_1] lives at [ADDRESS_1]");
  });
  it("does not mask inside a longer word", () => {
    expect(maskerFor({ name: "Ann Lee" }).mask("Annual leave")).toBe("Annual leave");
  });
  it("masks the case number literal and gives the same value the same placeholder", () => {
    const m = maskerFor({ caseNumber: "ABC/123/2026" });
    expect(m.mask("ABC/123/2026 and again abc/123/2026")).toBe("[CASE_1] and again [CASE_1]");
  });
  it("counts spans and tolerates model-mangled placeholders on restore", () => {
    const m = maskerFor({ name: "Arjun Raman" });
    m.mask("Arjun Raman, PESEL " + PESEL);
    expect(m.count).toBe(2);
    expect(m.restore("Dear [NAME 1], your [PESEL_1] and [name_9]")).toBe(`Dear Arjun Raman, your ${PESEL} and [name_9]`);
  });
  it("restores nested model output", () => {
    const m = maskerFor({ name: "Arjun Raman" });
    m.mask("Arjun Raman");
    expect(m.restoreDeep({ a: ["hi [NAME_1]"], b: { c: "[NAME_1]" }, n: 3 })).toEqual({
      a: ["hi Arjun Raman"],
      b: { c: "Arjun Raman" },
      n: 3,
    });
  });
});

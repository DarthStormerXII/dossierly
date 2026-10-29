---
name: bank-account
description: Build a checklist and bank phrases for opening a bank account in Poland as a foreigner. Use when the appointment purpose is a bank or account opening, or the person asks which documents a bank wants. Official sources cover only the statutory basic payment account; individual banks' documents are not official sources.
---

# Bank account (Poland)

## When to use
- `appointment.purpose` is a bank visit or opening an account; the person needs a PLN account for salary or fee payments.
- Not for loans, investments or tax questions. No financial advice.

## Inputs you get
- `appointment {office, purpose, date}` (office = bank name or empty), `case` JSON, hub passages with citations.

## Steps
1. Explain the legal anchor: every bank must offer a basic payment account (podstawowy rachunek płatniczy) to consumers who have no other PLN payment account in Poland. An ordinary account is the bank's own product; its documents are not set by the sources read.
2. Checklist from the statute (these are grounds on which a bank may refuse a basic account, so they are what to be ready to show):
   - valid identity document (passport): status `have` if the case lists a valid passport;
   - proof of legal stay: the statute says the bank may refuse if the person is not legally staying in a member state. Which paper proves it (residence card, visa, MOS certificate) is not stated: status `check`. Note the MOS certificate (zaświadczenie) "nie zastępuje dokumentu podróży ani karty pobytu", so it is not an ID;
   - an address in Poland or a Polish correspondence address: status `have` if the case has an address, else `missing`.
3. Add `check` items, `"citation": null`: "Ask the bank which documents it wants for a foreign customer and whether it accepts the MOS certificate", "Ask whether a Polish phone number or PESEL is needed", "Ask for the fee table and the terms in English".
4. Timing fact: the bank must conclude the basic-account contract or tell the person it refuses within 10 working days of a complete application.
5. A basic payment account may not be tied to buying other services (cite the rule). Fees: domestic basics are free in this account; do not quote bank price lists.
6. Phrases: 4-6 from `hub/phrases/pl.json` situation `bank-account`, plus `understanding`.
7. `changes`: `[]` unless a hub notice about banks or fees is newer than the case's last event.

## Output
```json
{"checklist":[{"item":"Valid passport","status":"have|missing|check","citation":{"url":"https://...","title":"...","quote":"..."}}],
 "phrases":[{"local":"Jakie dokumenty są potrzebne?","user":"Which documents are needed?"}],
 "changes":[]}
```
Return JSON only.

## Rules
- Interpret and organise only. Do not recommend a bank, product or an amount to deposit.
- Cite hub passages only; no citation means `check` and a question to the bank.
- Do not state that a bank "must accept" a foreign document. The sources read say a bank may refuse in listed cases and say nothing on which papers every bank takes.
- State once that sources are thin: one statute (basic account) and a 2019 Financial Ombudsman analysis; the statute text read is the 2026 consolidated text, Dz.U. 2026 poz. 623.

## Seed passages (verified 2026-10-30)
| id | url | quote |
|---|---|---|
| duty | https://api.sejm.gov.pl/eli/acts/DU/2026/623/text.pdf | są obowiązani do świadczenia usługi prowadzenia podstawowego rachunku płatniczego |
| id-doc | https://api.sejm.gov.pl/eli/acts/DU/2026/623/text.pdf | konsument nie posiada ważnego dokumentu potwierdzającego jego tożsamość |
| legal-stay | https://api.sejm.gov.pl/eli/acts/DU/2026/623/text.pdf | konsument nie przebywa legalnie na terytorium państwa członkowskiego |
| address | https://api.sejm.gov.pl/eli/acts/DU/2026/623/text.pdf | konsument nie podał adresu zamieszkania lub innego adresu korespondencyjnego na terytorium Rzeczypospolitej Polskiej |
| ten-days | https://api.sejm.gov.pl/eli/acts/DU/2026/623/text.pdf | niezwłocznie, niepóźniej jednak niż w terminie 10 dni roboczych od dnia otrzymania kompletnego wniosku |
| no-tie | https://api.sejm.gov.pl/eli/acts/DU/2026/623/text.pdf | nie może uzależniać otwarcia podstawowego rachunku płatniczego od zawarcia przez konsumenta innej umowy |
| foreigner | https://rf.gov.pl/wp-content/uploads/2020/05/Rachunki_podstawowe_analiza_2019.pdf | Aby cudzoziemiec mógł otworzyć taki rachunek, w pierwszej kolejności musi wykazać dostawcy, że przebywa legalnie na terytorium Rzeczypospolitej Polskiej. |
| cert | https://migrant.wsc.mazowieckie.pl/pl/komunikaty/potwierdzenie-legalnego-pobytu-rozwiazanie-odpowiadajace-funkcji-stempla-w-paszporcie | Samo zaświadczenie nie zastępuje dokumentu podróży ani karty pobytu |

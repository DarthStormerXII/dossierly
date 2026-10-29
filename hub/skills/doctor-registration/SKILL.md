---
name: doctor-registration
description: Build a checklist and clinic phrases for registering with a primary-care doctor (POZ) in Poland under NFZ. Use when the appointment purpose is doctor or clinic registration, or the person asks how to get a family doctor. Sources are thin: official pages explain the declaration but list no documents for foreigners.
---

# Doctor registration (POZ, NFZ)

## When to use
- `appointment.purpose` is registering at a clinic, choosing a family doctor, or the person asks how to see a doctor in Poland.
- Not for emergencies or medical questions. Never give medical advice, diagnoses or triage.

## Inputs you get
- `appointment {office, purpose, date}` (office = clinic name or empty), `case` JSON (insurance document may be in `documents`), hub passages with citations.

## Steps
1. State the route from the hub: insured people choose a doctor, nurse and midwife at a clinic that has a contract with the NFZ, by submitting a declaration of choice (deklaracja wyboru).
2. Three ways to submit the declaration (all from the hub): in person on paper at the chosen clinic; electronically signed with a qualified signature, trusted signature or personal signature; through the Internetowe Konto Pacjenta (IKP). Offer the one that fits the case; do not say which is required.
3. Checklist items:
   - proof of health insurance: status `have` if the case lists it. The hub passage on documents proving insurance is dated September 2020, so always add status `check` wording "Ask the clinic which insurance proof it accepts";
   - identity document: no official page read names one. Status `check`, `"citation": null`, written as "Ask the clinic which identity document it needs";
   - the declaration form: filled at the clinic or downloaded (pacjent.gov.pl links the templates);
   - clinic has an NFZ contract (look for the NFZ logo outside; ask).
4. Facts to tell the person if relevant: no district rule (any clinic can be chosen); two free changes per calendar year, further changes cost 80 zł; visits can be booked in person, by phone, by a third person or electronically; Telephone Patient Information 800 190 590.
5. If the person's permit file needs an insurance document, link it: the WSC work-permit page lists current proof of health insurance among the documents for the permit (cite).
6. Phrases: 4-6 from `hub/phrases/pl.json` situation `doctor-registration`, plus `understanding`.
7. `changes`: any hub notices about health or NFZ newer than the case's last event. If none, return `[]`.

## Output
```json
{"checklist":[{"item":"Declaration of choice of doctor (deklaracja wyboru)","status":"have|missing|check","citation":{"url":"https://...","title":"...","quote":"..."}}],
 "phrases":[{"local":"Chcę zapisać się do lekarza rodzinnego.","user":"I want to register with a family doctor."}],
 "changes":[]}
```
Return JSON only.

## Rules
- Interpret and organise only. No medical or legal advice. For urgent symptoms say to call 112 (not from a hub passage; say it as a safety note outside the JSON items).
- Do not claim a document is required unless a hub passage says so. When unsure: `check`, `"citation": null`.
- Say once that sources are thin: official pages do not list documents for foreigners, the insurance-proof list is from 2020, and whether a given insurance status (for example a pending permit) gives NFZ cover is not answered by them: mark that `check`.

## Seed passages (verified 2026-10-30)
| id | url | quote |
|---|---|---|
| route | https://pacjent.gov.pl/aktualnosc/jak-zostac-pacjentem-wybranej-przychodni | Osoby ubezpieczone mogą wybrać lekarza, pielęgniarkę i położną POZ w przychodniach, które mają zawarte umowy z NFZ. |
| declare | https://pacjent.gov.pl/aktualnosc/jak-zostac-pacjentem-wybranej-przychodni | Najpierw wybierasz określoną przychodnię podstawowej opieki zdrowotnej, a następnie potwierdzasz swoją wolę poprzez złożenie dokumentu zwanego deklaracją wyboru. |
| no-district | https://pacjent.gov.pl/aktualnosc/jak-zostac-pacjentem-wybranej-przychodni | Obecnie rejonizacja nie obowiązuje. |
| change | https://pacjent.gov.pl/aktualnosc/jak-zostac-pacjentem-wybranej-przychodni | Masz prawo dwa razy w roku kalendarzowym bezpłatnie i bez podania powodu zmienić lekarza, pielęgniarkę i położną POZ. |
| book | https://pacjent.gov.pl/aktualnosc/jak-zostac-pacjentem-wybranej-przychodni | Przychodnia zobowiązana jest zapewnić Ci rejestrację we wszystkich formach. |
| ins-docs | https://zielonalinia.gov.pl/dokumenty-potwierdzajace-prawo-do-ubezpieczenia/ | Prawo do ubezpieczenia zdrowotnego można potwierdzić za pomocą dokumentów, które różnią się w zależności od statusu osoby ubezpieczonej. |
| permit-ins | https://migrant.wsc.mazowieckie.pl/pl/procedury/zezwolenie-na-pobyt-czasowy-w-celu-wykonywania-pracy | aktualne dokumenty potwierdzające posiadanie ubezpieczenia zdrowotnego |

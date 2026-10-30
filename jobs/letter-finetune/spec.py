"""Dossierly letter reader fine-tune: spec sampling, deadline counting and the shared reader prompt.

Every label comes from this file (code), never from a model. Standard library only.
Polish civil-procedure counting (Kpa art. 57): the day of the event is not counted; a deadline in days ends on day N after the event;
if that last day is a Saturday or a public holiday it moves to the next working day.
"""
import datetime as dt
import random
import re

D = dt.date
OFFICES_TRAIN = [
    "Mazowiecki Urząd Wojewódzki w Warszawie, Wydział Spraw Cudzoziemców",
    "Małopolski Urząd Wojewódzki w Krakowie, Wydział Spraw Obywatelskich i Cudzoziemców",
    "Dolnośląski Urząd Wojewódzki we Wrocławiu, Wydział Spraw Cudzoziemców",
]
OFFICES_TEST_ONLY = [
    "Mazowiecki Urząd Wojewódzki w Warszawie, Delegatura w Radomiu, Oddział Spraw Cudzoziemców",
    "Małopolski Urząd Wojewódzki w Krakowie, Delegatura w Nowym Sączu, Referat Legalizacji Pobytu",
    "Dolnośląski Urząd Wojewódzki we Wrocławiu, Delegatura w Wałbrzychu, Oddział Legalizacji Pobytu",
]
CITY = {"Warszawie": "Warszawa", "Krakowie": "Kraków", "Wrocławiu": "Wrocław", "Radomiu": "Radom", "Sączu": "Nowy Sącz", "Wałbrzychu": "Wałbrzych"}
FIRST = "Oleksandr Iryna Taras Olha Andrii Mariia Dmytro Natalia Yaroslav Svitlana Arjun Priya Rahul Ananya Vikram Lakshmi Aliaksandr Hanna Dzmitry Volha Nguyen Linh Tuan Mai Bakhtiyor Madina Rustam Dilnoza Giorgi Nino Levan Tamar".split()
LAST = "Kovalenko Shevchenko Bondarenko Melnyk Tkachenko Kravets Sharma Patel Reddy Iyer Nair Kumar Lukashenka Kavalenka Sidarenka Ivanou Tran Pham Hoang Le Karimov Yusupova Rakhimov Abdullaev Beridze Kapanadze Gelashvili".split()
STREETS = "Lipowa Polna Kwiatowa Słoneczna Krótka Leśna Ogrodowa Szkolna Parkowa Zielona Spokojna Brzozowa".split()


def easter(y: int) -> D:
    a, b, c = y % 19, y // 100, y % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mo, da = divmod(h + l - 7 * m + 114, 31)
    return D(y, mo, da + 1)


def holidays(y: int) -> set:
    e = easter(y)
    s = {D(y, 1, 1), D(y, 1, 6), D(y, 5, 1), D(y, 5, 3), D(y, 8, 15), D(y, 11, 1), D(y, 11, 11), D(y, 12, 25), D(y, 12, 26),
         e, e + dt.timedelta(1), e + dt.timedelta(49), e + dt.timedelta(60)}
    if y >= 2025:
        s.add(D(y, 12, 24))  # Wigilia is a public holiday from 2025
    return s


def is_free(d: D) -> bool:
    return d.weekday() == 5 or d in holidays(d.year) or d.weekday() == 6


def deadline_for(start: D, days: int):
    """Returns (raw_last_day, deadline): start + days, moved forward past Saturdays, Sundays and public holidays."""
    raw = start + dt.timedelta(days)
    d = raw
    while is_free(d):
        d += dt.timedelta(1)
    return raw, d


def norm(s: str) -> str:
    """Comparison form for free-text fields: case and punctuation/line breaks ignored."""
    return re.sub(r"[\W_]+", "", s.casefold())


def holiday_list_text() -> str:
    hs = sorted(h for y in (2026, 2027) for h in holidays(y) if D(2026, 9, 1) <= h <= D(2027, 7, 31))
    return ", ".join(h.isoformat() for h in hs)


# label, Polish description for the letter writer, stem regex the letter must contain
ACTIONS = {
    "docs": ("submit missing documents", "uzupełnić braki formalne wniosku i dostarczyć wskazane brakujące dokumenty", r"dokument|uzupełn"),
    "prints": ("appear in person to give fingerprints", "stawić się osobiście w urzędzie w celu pobrania odcisków linii papilarnych", r"odcisk"),
    "fee": ("pay the stamp duty fee", "wnieść opłatę skarbową w podanej kwocie i dostarczyć dowód wpłaty", r"opłat"),
    "insurance": ("provide proof of health insurance", "przedstawić potwierdzenie posiadania ubezpieczenia zdrowotnego", r"ubezpiecz"),
    "address": ("provide proof of address", "przedstawić dokument potwierdzający adres zamieszkania w Polsce", r"adres|zamieszk"),
    "employer": ("provide an employer statement", "dostarczyć zaświadczenie lub oświadczenie pracodawcy o zatrudnieniu", r"pracodawc|zatrudni"),
    "income": ("provide proof of stable income", "przedstawić dokumenty potwierdzające stałe, regularne źródło dochodu", r"dochod"),
    "translation": ("submit a sworn translation", "dostarczyć tłumaczenie przysięgłe wskazanego dokumentu na język polski", r"tłumacz"),
    "card": ("collect the residence card", "odebrać kartę pobytu w urzędzie", r"kart"),
    "appeal": ("file an appeal if you disagree", "wnieść odwołanie, jeśli strona nie zgadza się z decyzją (organ pouczył o prawie do odwołania)", r"odwołan"),
    "complaint": ("file a complaint against the order", "wnieść zażalenie na postanowienie, jeśli strona się z nim nie zgadza", r"zażale"),
    "evidence": ("review the evidence and respond", "zapoznać się z zebranym materiałem dowodowym i wypowiedzieć się co do niego", r"dowod"),
    "contact": ("update contact details", "zaktualizować dane kontaktowe (adres korespondencyjny, numer telefonu)", r"kontakt|telefon"),
    "none": ("none", "żadnych czynności od adresata nie wymaga; pismo ma charakter wyłącznie informacyjny", r"informuj|informac|zawiadamia"),
}
# doc type -> (label, header word regex, [(action key, deadline days or None, weight)])
DOC_TYPES = {
    "wezwanie": ("WEZWANIE", r"wezwa", [("docs", 14, 5), ("docs", 7, 2), ("docs", 30, 2), ("prints", 14, 2), ("fee", 14, 2), ("fee", 7, 1), ("insurance", 14, 2), ("address", 14, 1),
                                        ("employer", 14, 2), ("employer", 30, 1), ("income", 30, 1), ("translation", 30, 2), ("translation", 14, 1), ("evidence", 7, 1), ("evidence", 14, 1)]),
    "decyzja": ("DECYZJA", r"decyzj", [("appeal", 14, 8), ("card", 14, 2), ("card", 30, 1), ("fee", 14, 1)]),
    "postanowienie": ("POSTANOWIENIE", r"postanowi", [("complaint", 7, 6), ("evidence", 7, 2), ("docs", 7, 2), ("docs", 14, 1), ("address", 7, 1)]),
    "zawiadomienie": ("ZAWIADOMIENIE", r"zawiadom", [("prints", 14, 2), ("prints", 30, 1), ("evidence", 7, 2), ("card", 30, 1), ("none", None, 2), ("contact", 14, 1)]),
    "pismo informacyjne": ("PISMO INFORMACYJNE", r"informac", [("none", None, 6), ("contact", 30, 1), ("address", 30, 1), ("card", 30, 1)]),
}
# pattern id -> case number template
PATTERNS_TRAIN = ["WSC-II-S.6151.{n}.{y}", "SC-III.6151.{n}.{y}.{ab}", "DOW-WSC-II.6151.{n}.{y}.{ab}"]
PATTERNS_TEST_ONLY = ["OS.I.6153.{n}.{y}", "WSC.II.6154.{n}.{y}.{ab}", "DW-ZC/{n}/{y}", "{n}/{y}/WSC-LP"]
MONTHS = "stycznia lutego marca kwietnia maja czerwca lipca sierpnia września października listopada grudnia".split()


def fmt_date(d: D, style: int) -> str:
    return f"{d.day:02d}.{d.month:02d}.{d.year} r." if style == 0 else f"{d.day} {MONTHS[d.month - 1]} {d.year} r."


def _case_no(rng, pattern: str, year: int, used: set) -> str:
    while True:
        n = str(rng.randint(100, 99999))
        ab = rng.choice("ABCDEFGHJKLMNPRSTWZ") + rng.choice("ABCDEFGHJKLMNPRSTWZ")
        c = pattern.format(n=n, y=year, ab=ab)
        if c not in used:
            used.add(c)
            return c


def sample_specs(n: int, seed: int, split: str, used_cases: set) -> list:
    """split 'train': train offices and patterns. 'test': 45% train-style, 25% train office + unseen pattern, 30% unseen office + unseen pattern."""
    rng = random.Random(seed)
    out = []
    holi = sorted(h for y in (2026, 2027) for h in holidays(y) if D(2026, 9, 5) <= h <= D(2027, 6, 20))
    while len(out) < n:
        dtype = rng.choices(list(DOC_TYPES), weights=[40, 22, 12, 14, 12])[0]
        acts = DOC_TYPES[dtype][2]
        key, days, _ = rng.choices(acts, weights=[a[2] for a in acts])[0]
        if days is None:
            counted = "none"
        else:
            counted = "delivery" if (dtype in ("decyzja", "postanowienie") or rng.random() < 0.8) else "letter_date"
        # delivery date: uniform, or (40%) steered so the raw last day lands on a Saturday, Sunday or holiday
        if days and rng.random() < 0.4:
            target = rng.choice(holi) if rng.random() < 0.5 else D(2026, 9, 5) + dt.timedelta(rng.randrange(0, 280))
            while not is_free(target):
                target += dt.timedelta(1)
            start = target - dt.timedelta(days)
        else:
            start = D(2026, 9, 5) + dt.timedelta(rng.randrange(0, 280))
        gap = rng.randint(2, 7)
        if counted == "letter_date":
            letter_date, delivery = start, start + dt.timedelta(gap)
        else:
            delivery = start if days else D(2026, 9, 5) + dt.timedelta(rng.randrange(0, 280))
            letter_date = delivery - dt.timedelta(gap)
        if split == "train":
            office, pat = rng.choice(OFFICES_TRAIN), rng.choice(PATTERNS_TRAIN)
        else:
            r = rng.random()
            office = rng.choice(OFFICES_TRAIN) if r < 0.7 else rng.choice(OFFICES_TEST_ONLY)
            pat = rng.choice(PATTERNS_TRAIN) if r < 0.45 else rng.choice(PATTERNS_TEST_ONLY)
        city = CITY[re.search(r" (?:w|we) (\w+)", office).group(1)]
        case = _case_no(rng, pat, letter_date.year, used_cases)
        start_date = {"delivery": delivery, "letter_date": letter_date}.get(counted)
        raw = last = None
        if days:
            raw, last = deadline_for(start_date, days)
        pool = [("data złożenia wniosku", letter_date - dt.timedelta(rng.randint(40, 240))), ("data poprzedniego pisma organu w sprawie", letter_date - dt.timedelta(rng.randint(15, 90))),
                ("data ważności dotychczasowego pobytu lub wizy", letter_date + dt.timedelta(rng.randint(20, 150))), ("data wpływu uzupełnienia do akt", letter_date - dt.timedelta(rng.randint(8, 60)))]
        spec = {
            "doc_type": dtype, "office": office, "city": city, "case_number": case, "action_key": key, "required_action": ACTIONS[key][0], "deadline_days": days,
            "counted_from": counted, "letter_date": letter_date.isoformat(), "delivery_date": delivery.isoformat(), "date_style": rng.randint(0, 1),
            "start_date": start_date.isoformat() if start_date else None, "raw_deadline": raw.isoformat() if raw else None, "raw_weekday": raw.strftime("%A") if raw else None,
            "deadline_date": last.isoformat() if last else None, "amount_pln": rng.choice([17, 100, 340, 440, 540]) if key == "fee" else None,
            "distractors": [(k, v.isoformat()) for k, v in rng.sample(pool, rng.randint(2, 3))],
            "addressee": f"{rng.choice(FIRST)} {rng.choice(LAST)}", "addr": f"ul. {rng.choice(STREETS)} {rng.randint(1, 80)}/{rng.randint(1, 60)}", "tone": rng.choice(["urzędowy, sztywny", "urzędowy, zwięzły", "urzędowy, uprzejmy i szczegółowy"]),
            "pool": split if split == "train" else ("test_seen_style" if (office in OFFICES_TRAIN and pat in PATTERNS_TRAIN) else "test_unseen"),
        }
        out.append(spec)
    return out


READER_RULES = (
    "Read the Polish administrative letter below and return ONE JSON object, nothing else, with exactly these keys in this order:\n"
    '"document_type": one of "wezwanie", "decyzja", "postanowienie", "zawiadomienie", "pismo informacyjne";\n'
    '"issuing_office": the issuing office (name and department) from the letter header, on one line with the parts separated by ", ";\n'
    '"case_number": the case signature (znak sprawy) exactly as written;\n'
    '"required_action": what the recipient must do, the closest one of: ' + "; ".join(f'"{a[0]}"' for a in ACTIONS.values()) + ".\n"
    '"deadline_days": the number of days the recipient has, as an integer, or null if there is no deadline;\n'
    '"counted_from": "delivery" (from delivery of the letter), "letter_date" (from the date of the letter) or "none";\n'
    '"start_date": the event the days are counted from, as YYYY-MM-DD (delivery date given below, or the date of the letter), or null;\n'
    '"raw_deadline": start_date plus deadline_days days, as YYYY-MM-DD, or null (the day of the event itself is not counted);\n'
    '"raw_weekday": the English weekday of raw_deadline, or null;\n'
    '"deadline_date": raw_deadline moved forward to the next working day if it is a Saturday, Sunday or Polish public holiday, as YYYY-MM-DD, or null.\n'
    "Polish public holidays (non-working days) from September 2026 to July 2027: " + holiday_list_text() + ".\n")
KEYS = ["document_type", "issuing_office", "case_number", "required_action", "deadline_days", "counted_from", "start_date", "raw_deadline", "raw_weekday", "deadline_date"]


def reader_prompt(letter: str, delivery_date: str) -> str:
    return READER_RULES + f"\nDelivery date of this letter (data doręczenia): {delivery_date}\n\nLetter:\n{letter}"


def label_of(spec: dict) -> dict:
    return {"document_type": spec["doc_type"], "issuing_office": spec["office"], "case_number": spec["case_number"], "required_action": spec["required_action"],
            "deadline_days": spec["deadline_days"], "counted_from": spec["counted_from"], "start_date": spec["start_date"], "raw_deadline": spec["raw_deadline"],
            "raw_weekday": spec["raw_weekday"], "deadline_date": spec["deadline_date"]}

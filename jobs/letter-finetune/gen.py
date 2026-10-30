"""Letter data for the Dossierly fine-tune: Nemotron 3.5 Lightning on Nebius Token Factory writes each Polish letter from a spec sampled in code.

Labels are the spec (spec.py), never a model output. Letters that miss the case number, office, deadline wording or letter date are dropped.
Standard library only. Usage: NEBIUS_API_KEY=... python3 gen.py [n_train n_test out_dir]
"""
import json
import os
import random
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import spec as S

URL = "https://api.tokenfactory.nebius.com/v1/chat/completions"
MODEL = "nvidia/Nemotron-3_5-Lightning"
USD_PER_M = (0.06, 0.24)  # list price per million input / output tokens (assumed; the real bill is read from Token Factory)
USAGE = {"in": 0, "out": 0, "calls": 0, "failed": 0}
MAX_USD = float(os.environ.get("GEN_MAX_USD", "2.5"))
SYSTEM = ("Jesteś pracownikiem polskiego urzędu wojewódzkiego i piszesz realistyczne, oficjalne pisma administracyjne po polsku dla cudzoziemców. "
          "Wszystkie osoby, adresy i numery są wymyślone. Zwracasz wyłącznie treść pisma, bez komentarzy, bez markdown.")


def usd() -> float:
    return USAGE["in"] / 1e6 * USD_PER_M[0] + USAGE["out"] / 1e6 * USD_PER_M[1]


def chat(user: str) -> tuple:
    body = json.dumps({"model": MODEL, "temperature": 0.9, "max_tokens": 1100, "store": False, "chat_template_kwargs": {"enable_thinking": False},
                       "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]}).encode()
    for attempt in range(4):
        try:
            req = urllib.request.Request(URL, body, {"Authorization": "Bearer " + os.environ["NEBIUS_API_KEY"], "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.load(r)
            USAGE["in"] += d["usage"]["prompt_tokens"]; USAGE["out"] += d["usage"]["completion_tokens"]; USAGE["calls"] += 1
            c = d["choices"][0]
            return (c["message"]["content"] or ""), c.get("finish_reason")
        except Exception:
            time.sleep(2 + 3 * attempt)
    USAGE["failed"] += 1
    return "", "error"


def writer_prompt(sp: dict) -> str:
    label, _, _ = S.DOC_TYPES[sp["doc_type"]]
    act = S.ACTIONS[sp["action_key"]][1]
    n = sp["deadline_days"]
    if n is None:
        dl = "Pismo NIE wyznacza żadnego terminu i nie zawiera żadnej liczby dni. Nie pisz o terminach w dniach."
    elif sp["counted_from"] == "delivery":
        dl = f"Wyznacz termin dokładnie tak: „w terminie {n} dni od dnia doręczenia niniejszego pisma\". Nie podawaj daty końcowej terminu ani żadnej innej liczby dni."
    else:
        dl = f"Wyznacz termin dokładnie tak: „w terminie {n} dni od daty niniejszego pisma\" (liczony od daty pisma, nie od doręczenia). Nie podawaj daty końcowej ani żadnej innej liczby dni."
    amount = f"Kwota opłaty: {sp['amount_pln']} zł.\n" if sp["amount_pln"] else ""
    dis = "\n".join(f"- {k}: {S.fmt_date(S.D.fromisoformat(v), sp['date_style'])}" for k, v in sp["distractors"])
    return (f"Napisz TYLKO treść pisma urzędowego (130-230 słów): od zwrotu do adresata do podpisu. Nagłówek z nazwą urzędu, datą i znakiem sprawy dodamy osobno, więc go NIE pisz.\n"
            f"Rodzaj pisma: {label} (typ „{sp['doc_type']}\"); nie pisz nagłówka z rodzajem pisma.\n"
            f"Adresat: {sp['addressee']}, {sp['addr']}, {sp['city']}\n"
            f"Czynność wymagana od adresata: {act}.\n{amount}{dl}\n"
            f"Wpleć w treść te daty jako tło sprawy (nie jako terminy do wykonania czynności):\n{dis}\n"
            f"Ton: {sp['tone']}. Dodaj pouczenie o skutkach niedotrzymania terminu (jeśli jest termin) i podpis „z upoważnienia Wojewody\" bez nazwiska. "
            "Nie dopisuj dat ani terminów spoza podanych.")


def assemble(sp: dict, body: str) -> str:
    """Header (office, place and date, case number, document type) is written by code so labels are verbatim; Nemotron writes the body."""
    ld = S.fmt_date(S.D.fromisoformat(sp["letter_date"]), sp["date_style"])
    head = S.DOC_TYPES[sp["doc_type"]][0]
    lay = sum(map(ord, sp["case_number"])) % 3
    office = sp["office"].replace(", ", "\n") if sp["date_style"] == 1 and lay != 1 else sp["office"]
    if lay == 0:
        top = f"{office}\n{sp['city']}, {ld}\nZnak sprawy: {sp['case_number']}\n\n{head}"
    elif lay == 1:
        top = f"{head}\n{office}\nNr sprawy: {sp['case_number']}\n{sp['city']}, {ld}"
    else:
        top = f"{sp['city']}, {ld}\n{office}\n\n{head}\nZnak: {sp['case_number']}"
    return top + "\n\n" + body


def validate(sp: dict, text: str) -> str:
    """Returns '' when the letter carries what its label claims, else the reason it is dropped."""
    t = text.lower()
    if len(text) < 500 or len(text.split()) > 420:
        return "length"
    if sp["case_number"] not in text or S.norm(sp["office"]) not in S.norm(text):
        return "header"
    if not re.search(S.ACTIONS[sp["action_key"]][2], t):
        return "action_words"
    n = sp["deadline_days"]
    day_counts = {int(m) for m in re.findall(r"(\d+)\s*(?:-\s*)?(?:dni|dniowy|dniowym)", t)}
    if n is None:
        if day_counts or "w terminie" in t:
            return "unexpected_deadline"
    else:
        if day_counts != {n}:
            return "deadline_days"
        if sp["counted_from"] == "delivery" and not re.search(r"od\s+(dnia\s+|daty\s+)?doręczeni", t):
            return "counted_from_delivery"
        if sp["counted_from"] == "letter_date" and ("od daty niniejszego pisma" not in t or re.search(r"od\s+(dnia\s+|daty\s+)?doręczeni", t)):
            return "counted_from_letter"
    for fmt in (0, 1):  # the final deadline date must not be written out, the reader has to compute it
        if sp["deadline_date"] and S.fmt_date(S.D.fromisoformat(sp["deadline_date"]), fmt) in text:
            return "deadline_date_leaked"
    return ""


def one(sp: dict) -> dict:
    if usd() > MAX_USD:
        return {"spec": sp, "text": "", "drop": "budget"}
    text, fin = chat(writer_prompt(sp))
    text = text.replace("**", "").strip()
    if fin != "stop":
        return {"spec": sp, "text": text, "drop": f"finish_{fin}"}
    text = assemble(sp, text)
    return {"spec": sp, "text": text, "drop": validate(sp, text)}


def build(n_train: int, n_test: int, workers: int = 40) -> dict:
    t0 = time.time()
    used: set = set()
    train_specs = S.sample_specs(int(n_train * 1.3), 11, "train", used)
    test_specs = S.sample_specs(int(n_test * 1.5), 29, "test", used)
    with ThreadPoolExecutor(workers) as ex:
        res = list(ex.map(one, train_specs + test_specs))
    tr, te = res[:len(train_specs)], res[len(train_specs):]
    drops: dict = {}
    for r in tr + te:
        if r["drop"]:
            drops[r["drop"]] = drops.get(r["drop"], 0) + 1
    train = [r for r in tr if not r["drop"]][:n_train]
    test = [r for r in te if not r["drop"]][:n_test]
    return {"train": train, "test": test, "stats": {"train_specs": len(train_specs), "test_specs": len(test_specs), "dropped": drops, "usage": dict(USAGE),
                                                    "usd_est": round(usd(), 3), "seconds": round(time.time() - t0, 1), "model": MODEL}}


if __name__ == "__main__":
    import sys
    a = sys.argv
    out = build(int(a[1]) if len(a) > 1 else 6, int(a[2]) if len(a) > 2 else 3)
    print(json.dumps(out["stats"], ensure_ascii=False))
    for r in out["train"][:2]:
        print("-----", r["spec"]["doc_type"], r["spec"]["deadline_days"], r["spec"]["counted_from"], r["spec"]["deadline_date"], "\n" + r["text"])
    if len(a) > 3:
        os.makedirs(a[3], exist_ok=True)
        json.dump(out, open(os.path.join(a[3], "data.json"), "w"), ensure_ascii=False)

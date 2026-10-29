"""Masks personal data in free-text fields with NVIDIA GLiNER-PII (CPU). Reads JSON {"texts": [...]} on stdin,
writes {"texts": [...masked...], "count": n, "labels": {...}} on stdout. Nothing leaves the machine."""
import json
import sys

LABELS = ["person name", "street address", "phone number", "email address", "passport number",
          "national id number", "date of birth", "bank account number", "employer name"]


def mask_text(model, text, counters, found):
    if not text.strip():
        return text
    ents = model.predict_entities(text, LABELS, threshold=0.5)
    ents = sorted(ents, key=lambda e: e["start"])
    out, pos = [], 0
    for e in ents:
        if e["start"] < pos:
            continue
        tag = e["label"].upper().replace(" ", "_")
        counters[tag] = counters.get(tag, 0) + 1
        found[tag] = found.get(tag, 0) + 1
        out.append(text[pos:e["start"]])
        out.append(f"[{tag}_{counters[tag]}]")
        pos = e["end"]
    out.append(text[pos:])
    return "".join(out)


def main():
    from gliner import GLiNER
    payload = json.load(sys.stdin)
    model = GLiNER.from_pretrained("nvidia/gliner-PII")
    counters, found = {}, {}
    texts = [mask_text(model, t, counters, found) for t in payload["texts"]]
    json.dump({"texts": texts, "count": sum(found.values()), "labels": found}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()

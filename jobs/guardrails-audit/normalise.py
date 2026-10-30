"""Input normalisation applied before the rail. Mirrors src/lib/safety.ts (normaliseForScreening, screenWindows);
normalise_cases.json is checked by both implementations."""
import base64
import re
import unicodedata

# zero-width, bidi controls, soft hyphen, word joiner, BOM, variation selectors, Unicode tag characters
_INVISIBLE = re.compile(
    "[­͏؜ᅟᅠ឴឵᠋-᠎​-‏‪-‮⁠-⁯"
    "ㅤ︀-️﻿ﾠ\U000e0000-\U000e007f]"
)

_HOMOGLYPHS = {
    # Cyrillic
    "а": "a", "с": "c", "е": "e", "о": "o", "р": "p", "х": "x", "у": "y", "і": "i", "ј": "j", "ѕ": "s", "ԛ": "q",
    "ԝ": "w", "һ": "h", "ӏ": "l", "ѵ": "v",
    "А": "A", "В": "B", "С": "C", "Е": "E", "Н": "H", "І": "I", "Ј": "J", "К": "K", "М": "M", "О": "O", "Р": "P",
    "Ѕ": "S", "Т": "T", "Х": "X", "У": "Y",
    # Greek
    "α": "a", "ο": "o", "ν": "v", "ρ": "p", "ι": "i", "κ": "k", "υ": "u", "τ": "t",
    "Α": "A", "Β": "B", "Ε": "E", "Ζ": "Z", "Η": "H", "Ι": "I", "Κ": "K", "Μ": "M", "Ν": "N", "Ο": "O", "Ρ": "P",
    "Τ": "T", "Υ": "Y", "Χ": "X",
}
_NON_LATIN = re.compile("[Ͱ-ϿЀ-ӿ]")
_LATIN = re.compile("[A-Za-z]")
_B64 = re.compile(r"[A-Za-z0-9+/_-]{16,}={0,2}")
_HEX = re.compile(r"(?<![0-9A-Za-z])(?:[0-9a-fA-F]{2}(?:[ :]|(?=[0-9a-fA-F]{2}))){7,}[0-9a-fA-F]{2}(?![0-9A-Za-z])")
_SPACED = re.compile(r"(?<![A-Za-z])(?:[A-Za-z][ .\-_]){4,}[A-Za-z](?![A-Za-z])")


def _unmix(text: str) -> str:
    """Map look-alike Cyrillic/Greek letters to Latin, but only inside words that already mix in Latin letters,
    so genuine Ukrainian or Greek words stay intact."""
    def fix(m):
        w = m.group(0)
        if _LATIN.search(w) and _NON_LATIN.search(w):
            return "".join(_HOMOGLYPHS.get(ch, ch) for ch in w)
        return w
    return re.sub(r"\S+", fix, text)


def _printable_text(raw: bytes):
    try:
        s = raw.decode("utf-8")
    except UnicodeDecodeError:
        return None
    if len(s) < 6:
        return None
    ok = sum(1 for ch in s if ch.isprintable() or ch in "\n\t")
    letters = sum(1 for ch in s if ch.isalpha() or ch == " ")
    if ok / len(s) < 0.95 or letters / len(s) < 0.7:
        return None
    return s.strip()


def _decode_runs(text: str):
    found = []
    for m in _HEX.finditer(text):
        h = re.sub(r"[ :]", "", m.group(0))
        if len(h) % 2 == 0:
            s = _printable_text(bytes.fromhex(h))
            if s:
                found.append(s)
    for m in _B64.finditer(text):
        b = m.group(0).rstrip("=").replace("-", "+").replace("_", "/")
        if re.fullmatch(r"[0-9a-fA-F]+", b):
            continue
        try:
            s = _printable_text(base64.b64decode(b + "=" * (-len(b) % 4), validate=True))
        except Exception:
            s = None
        if s:
            found.append(s)
    return found


def normalise(text: str) -> str:
    t = unicodedata.normalize("NFKC", text)
    t = _INVISIBLE.sub("", t)
    t = _unmix(t)
    extra = [re.sub(r"[ .\-_]", "", m.group(0)) for m in _SPACED.finditer(t)]
    extra += _decode_runs(t)
    if extra:
        t += "\n[decoded] " + "\n[decoded] ".join(extra)
    return t


def windows(text: str, size: int = 3, stride: int = 2):
    """Overlapping windows of `size` lines so one planted line cannot hide in a long block."""
    units = []
    for line in re.split(r"\n+", text):
        line = line.strip()
        if not line:
            continue
        if len(line) > 300:
            units.extend(s for s in re.split(r"(?<=[.!?])\s+", line) if s)
        else:
            units.append(line)
    if len(units) <= size + 1:
        return [text]
    out = [units[i:i + size] for i in range(0, len(units) - size + 1, stride)]
    if (len(units) - size) % stride:
        out.append(units[-size:])
    return ["\n".join(w) for w in out]

"""Local speech translation for the Dossierly bridge: NVIDIA Canary 1B v2 (MLX port via mlx-audio).

POST /translate?src=pl&tgt=en  body = raw 16 kHz mono 16-bit WAV  ->  {"text", "ms"}
Binds to 127.0.0.1 only. One request at a time. Never logs transcripts or audio.
"""
import io
import json
import os
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

import soundfile as sf

MODEL_ID = os.environ.get("CANARY_MODEL", "CogniSoftOrg/canary-1b-v2-mlx-bf16")
HOST, PORT = "127.0.0.1", int(os.environ.get("CANARY_PORT", "8092"))
LANGS = {"pl", "en", "uk"}
MAX_BYTES = 16_000 * 2 * 120
LOCK = threading.Lock()

t0 = time.time()
from mlx_audio.stt.utils import load  # noqa: E402

model = load(MODEL_ID)
LOAD_S = round(time.time() - t0, 1)
sys.stderr.write(f"model loaded in {LOAD_S}s\n")
sys.stderr.flush()


def translate(wav: bytes, src: str, tgt: str) -> str:
    try:
        data, rate = sf.read(io.BytesIO(wav), dtype="int16", always_2d=True)
    except Exception:
        raise ValueError("not a decodable WAV")
    if rate != 16000 or data.shape[1] != 1:
        raise ValueError("expected 16 kHz mono WAV")
    if data.shape[0] < 1600:
        raise ValueError("audio shorter than 100 ms")
    fd, path = tempfile.mkstemp(suffix=".wav")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(wav)
        return model.generate(path, source_lang=src, target_lang=tgt, use_pnc=True, no_repeat_ngram_size=3).text.strip()
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code: int, body: dict):
        raw = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "model": "nvidia/canary-1b-v2", "weights": MODEL_ID, "loadS": LOAD_S})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != "/translate":
            return self._send(404, {"error": "not found"})
        q = parse_qs(u.query)
        src, tgt = (q.get("src") or [""])[0], (q.get("tgt") or [""])[0]
        if src not in LANGS or tgt not in LANGS:
            return self._send(400, {"error": "src and tgt must be one of pl, en, uk"})
        try:
            n = int(self.headers.get("content-length", "0"))
        except ValueError:
            n = 0
        if n <= 44 or n > MAX_BYTES + 44:
            return self._send(400, {"error": "body must be a WAV of 0.1 s to 120 s"})
        wav = self.rfile.read(n)
        start = time.time()
        try:
            with LOCK:
                text = translate(wav, src, tgt)
        except ValueError as e:
            return self._send(400, {"error": str(e)})
        except Exception:
            sys.stderr.write("translate failed\n")
            return self._send(500, {"error": "translation failed"})
        self._send(200, {"text": text, "ms": round((time.time() - start) * 1000)})


if __name__ == "__main__":
    HTTPServer((HOST, PORT), Handler).serve_forever()

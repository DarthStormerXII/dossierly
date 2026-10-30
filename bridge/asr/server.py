"""Local speech recognition for the Dossierly bridge: NVIDIA Parakeet TDT 0.6B v3 (MLX port).

POST /transcribe  body = raw 16 kHz mono 16-bit WAV  ->  {"text", "ms"}
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

import soundfile as sf

MODEL_ID = os.environ.get("ASR_MODEL", "mlx-community/parakeet-tdt-0.6b-v3")
HOST, PORT = "127.0.0.1", int(os.environ.get("ASR_PORT", "8091"))
MAX_BYTES = 16_000 * 2 * 120  # two minutes of 16 kHz 16-bit mono
LOCK = threading.Lock()

t0 = time.time()
from parakeet_mlx import from_pretrained  # noqa: E402

model = from_pretrained(MODEL_ID)
LOAD_S = round(time.time() - t0, 1)
sys.stderr.write(f"model loaded in {LOAD_S}s\n")
sys.stderr.flush()


def transcribe(wav: bytes) -> str:
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
        return model.transcribe(path).text.strip()
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # no access log
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
            return self._send(200, {"ok": True, "model": MODEL_ID, "loadS": LOAD_S})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path.split("?")[0] != "/transcribe":
            return self._send(404, {"error": "not found"})
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
                text = transcribe(wav)
        except ValueError as e:
            return self._send(400, {"error": str(e)})
        except Exception:
            sys.stderr.write("transcribe failed\n")
            return self._send(500, {"error": "recognition failed"})
        self._send(200, {"text": text, "ms": round((time.time() - start) * 1000)})


if __name__ == "__main__":
    HTTPServer((HOST, PORT), Handler).serve_forever()

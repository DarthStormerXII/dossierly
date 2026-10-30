"""Dossierly letter reader: generate data, dedupe train vs test, LoRA fine-tune Llama-3.1-Nemotron-Nano-4B-v1.1, evaluate base vs tuned.

Runs inside ONE Nebius AI Cloud Serverless GPU job (1x H100, eu-north1). Prints one line `RESULT {json}` at the end.
Base and tuned models get the identical prompt (spec.reader_prompt) and the identical parser; greedy decoding.
"""
import json
import math
import os
import random
import re
import sys
import threading
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen  # noqa: E402
import spec as S  # noqa: E402

T0 = time.time()
BASE = os.environ.get("BASE_MODEL", "nvidia/Llama-3.1-Nemotron-Nano-4B-v1.1")
EPOCHS = int(os.environ.get("EPOCHS", "2"))
N_TRAIN = int(os.environ.get("N_TRAIN", "800"))
N_TEST = int(os.environ.get("N_TEST", "200"))
WALL_LIMIT = int(os.environ.get("WALL_LIMIT_S", str(38 * 60)))  # in-job watchdog; the platform minimum timeout is 1 h, so this keeps the cost ceiling
MAXLEN = 2600
SCORED = ["document_type", "issuing_office", "case_number", "required_action", "deadline_days", "counted_from", "deadline_date"]
SYSTEM_TURN = "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\ndetailed thinking off<|eot_id|>"


def log(msg: str) -> None:
    print(f"[{time.time() - T0:7.1f}s] {msg}", flush=True)


def render(item: dict) -> str:
    return (SYSTEM_TURN + "<|start_header_id|>user<|end_header_id|>\n\n" + S.reader_prompt(item["letter"], item["delivery"])
            + "<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n")


def answer(item: dict) -> str:
    return json.dumps(item["label"], ensure_ascii=False)


def parse(out: str):
    """First JSON object in the model output, or None."""
    a = out.find("{")
    if a < 0:
        return None
    for b in (out.rfind("}"), out.find("}", a)):
        if b > a:
            try:
                d = json.loads(out[a:b + 1])
                return d if isinstance(d, dict) else None
            except ValueError:
                continue
    return None


def same(field: str, p, g) -> bool:
    if g is None:
        return p is None or (isinstance(p, str) and p.strip().lower() in ("null", "none", ""))
    if p is None:
        return False
    if field == "deadline_days":
        try:
            return int(p) == int(g)
        except (TypeError, ValueError):
            return False
    if field == "issuing_office":
        return S.norm(str(p)) == S.norm(str(g))
    return str(p).strip().casefold() == str(g).strip().casefold()


def score(items: list, outs: list) -> dict:
    n = len(items)
    per = {f: 0 for f in SCORED}
    extra = {"start_date": 0, "raw_deadline": 0, "raw_weekday": 0}
    valid = all_ok = date_ok = 0
    n_dl = ok_dl = n_roll = ok_roll = 0
    by_pool: dict = {}
    for it, o in zip(items, outs):
        d = parse(o)
        valid += d is not None
        d = d or {}
        hits = {f: same(f, d.get(f), it["label"][f]) for f in SCORED}
        for f in SCORED:
            per[f] += hits[f]
        for f in extra:
            extra[f] += same(f, d.get(f), it["label"][f])
        full = all(hits.values())
        all_ok += full
        if it["label"]["deadline_date"]:
            n_dl += 1
            ok_dl += hits["deadline_date"]
            if it["label"]["raw_deadline"] != it["label"]["deadline_date"]:
                n_roll += 1
                ok_roll += hits["deadline_date"]
        b = by_pool.setdefault(it["pool"], [0, 0])
        b[0] += 1; b[1] += full
    return {"n": n, "json_valid": round(valid / n, 4), "all_fields_correct": round(all_ok / n, 4), "per_field": {f: round(per[f] / n, 4) for f in SCORED},
            "deadline_date_exact_overall": round(per["deadline_date"] / n, 4), "deadline_date_exact_when_deadline": [ok_dl, n_dl],
            "deadline_date_exact_when_rolled_to_working_day": [ok_roll, n_roll], "scratch_fields_not_scored": {k: round(v / n, 4) for k, v in extra.items()},
            "all_fields_by_test_pool": {k: {"n": v[0], "all_correct": round(v[1] / v[0], 4)} for k, v in by_pool.items()}}


def shingles(text: str, k: int = 4) -> set:
    w = re.findall(r"\w+", text.casefold())
    return {" ".join(w[i:i + k]) for i in range(max(1, len(w) - k + 1))}


def dedupe(train: list, test: list, thr: float = 0.5) -> tuple:
    """Drops training letters that exactly or nearly (word 4-gram Jaccard >= thr) duplicate any test letter. Returns (kept_train, report)."""
    tsh = [shingles(t["letter"]) for t in test]
    exact_norm = {S.norm(t["letter"]) for t in test}
    kept, exact, near, maxes = [], 0, 0, []
    for it in train:
        if S.norm(it["letter"]) in exact_norm:
            exact += 1
            continue
        sh = shingles(it["letter"])
        m = max((len(sh & x) / len(sh | x) for x in tsh), default=0.0)
        maxes.append(m)
        if m >= thr:
            near += 1
            continue
        kept.append(it)
    maxes.sort()
    cases_tr = {i["spec"]["case_number"] for i in train}
    return kept, {"train_before": len(train), "dropped_exact": exact, "dropped_near_dup": near, "near_dup_threshold": f"word 4-gram Jaccard >= {thr}", "train_after": len(kept),
                  "max_similarity_train_to_test": {"max": round(maxes[-1], 3), "p95": round(maxes[int(0.95 * (len(maxes) - 1))], 3), "median": round(maxes[len(maxes) // 2], 3)} if maxes else None,
                  "shared_case_numbers_train_test": len(cases_tr & {t["spec"]["case_number"] for t in test})}


def to_item(r: dict) -> dict:
    sp = r["spec"]
    return {"letter": r["text"], "delivery": sp["delivery_date"], "label": S.label_of(sp), "pool": sp["pool"], "spec": {"case_number": sp["case_number"], "office": sp["office"]}}


def evaluate(model, tok, items: list, batch: int = 16) -> list:
    import torch
    eos = [tok.eos_token_id, tok.convert_tokens_to_ids("<|eot_id|>")]
    order = sorted(range(len(items)), key=lambda i: len(items[i]["letter"]))
    outs = [""] * len(items)
    for s in range(0, len(order), batch):
        idx = order[s:s + batch]
        enc = tok([render(items[i]) for i in idx], return_tensors="pt", padding=True, add_special_tokens=False).to("cuda")
        with torch.no_grad():
            g = model.generate(**enc, max_new_tokens=256, do_sample=False, eos_token_id=eos, pad_token_id=tok.pad_token_id)
        for i, o in zip(idx, tok.batch_decode(g[:, enc["input_ids"].shape[1]:], skip_special_tokens=True)):
            outs[i] = o
    return outs


def train(model, tok, items: list):
    import torch
    from peft import LoraConfig, get_peft_model
    cfg = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, task_type="CAUSAL_LM", target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
    model = get_peft_model(model, cfg)
    model.print_trainable_parameters()
    eot = tok.convert_tokens_to_ids("<|eot_id|>")
    data = []
    for it in items:
        p = tok(render(it), add_special_tokens=False)["input_ids"]
        a = tok(answer(it), add_special_tokens=False)["input_ids"] + [eot]
        if len(p) + len(a) <= MAXLEN:
            data.append((p + a, [-100] * len(p) + a))
    mb, accum = 4, 2
    total = EPOCHS * (len(data) // (mb * accum))
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=2e-4, weight_decay=0.0)
    warm = max(1, int(0.06 * total))
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / warm) * max(0.05, 0.5 * (1 + math.cos(math.pi * s / max(1, total)))))
    model.train()
    t0, step, losses = time.time(), 0, []
    for ep in range(EPOCHS):
        random.Random(ep).shuffle(data)
        for b in range(0, len(data) - mb * accum + 1, mb * accum):
            tot = 0.0
            for k in range(accum):
                ch = data[b + k * mb:b + (k + 1) * mb]
                L = max(len(x[0]) for x in ch)
                ids = torch.tensor([x[0] + [tok.pad_token_id] * (L - len(x[0])) for x in ch]).cuda()
                lab = torch.tensor([x[1] + [-100] * (L - len(x[1])) for x in ch]).cuda()
                att = torch.tensor([[1] * len(x[0]) + [0] * (L - len(x[0])) for x in ch]).cuda()
                with torch.autocast("cuda", dtype=torch.bfloat16):
                    loss = model(input_ids=ids, attention_mask=att, labels=lab).loss / accum
                loss.backward(); tot += loss.item()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step(); opt.zero_grad(set_to_none=True); step += 1; losses.append(tot)
            if step % 10 == 0 or step == 1:
                log(f"epoch {ep + 1}/{EPOCHS} step {step}/{total} loss {tot:.4f}")
    torch.cuda.synchronize()
    st = {"train_seconds": round(time.time() - t0, 1), "steps": step, "examples": len(data), "epochs": EPOCHS, "first_loss": round(losses[0], 4), "last5_loss": round(sum(losses[-5:]) / len(losses[-5:]), 4),
          "lora": {"r": 16, "alpha": 32, "dropout": 0.05, "targets": "q,k,v,o,gate,up,down", "lr": 2e-4, "effective_batch": mb * accum, "dtype": "bf16", "max_len": MAXLEN}}
    return model, st


def main() -> dict:
    rep = {"base_model": BASE, "license": "NVIDIA Open Model License (and the Llama 3.1 Community License it is built on)", "task": "Polish administrative letter -> JSON fields"}
    import torch
    from huggingface_hub import snapshot_download
    rep["gpu"] = torch.cuda.get_device_name(0)
    threading.Thread(target=lambda: snapshot_download(BASE), daemon=True).start()  # download overlaps data generation
    d = gen.build(N_TRAIN, N_TEST)
    log(f"generated train {len(d['train'])} test {len(d['test'])} stats {json.dumps(d['stats'], ensure_ascii=False)}")
    test = [to_item(r) for r in d["test"]]
    train_all = [to_item(r) for r in d["train"]]
    train_items, dd = dedupe(train_all, test)
    log(f"dedupe {json.dumps(dd)}")
    pools: dict = {}
    for t in test:
        pools[t["pool"]] = pools.get(t["pool"], 0) + 1
    rep["data"] = {"source": "nvidia/Nemotron-3_5-Lightning on Nebius Token Factory (thinking off, store false); labels computed in code from each sampled spec", "train": len(train_items),
                   "test": len(test), "test_pools": pools, "generation": d["stats"], "dedupe": dd,
                   "train_counts": {"doc_type": {k: sum(1 for i in train_items if i["label"]["document_type"] == k) for k in S.DOC_TYPES}}}
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(BASE)
    tok.padding_side = "left"
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(BASE, torch_dtype=torch.bfloat16, attn_implementation="sdpa").to("cuda").eval()
    log(f"model loaded, {sum(p.numel() for p in model.parameters()) / 1e9:.2f}B params")
    t = time.time()
    base_out = evaluate(model, tok, test)
    rep["base"] = score(test, base_out)
    rep["base"]["eval_seconds"] = round(time.time() - t, 1)
    log(f"BASE {json.dumps(rep['base'], ensure_ascii=False)}")
    for o in base_out[:2]:
        log("BASE_SAMPLE " + o[:400].replace("\n", " "))
    model, rep["train"] = train(model, tok, train_items)
    model.eval()
    tuned_out = evaluate(model, tok, test)
    rep["tuned"] = score(test, tuned_out)
    log(f"TUNED {json.dumps(rep['tuned'], ensure_ascii=False)}")
    for it, o in list(zip(test, tuned_out))[:3]:
        log("TUNED_SAMPLE " + o[:400].replace("\n", " ") + " || GOLD " + answer(it)[:400])
    miss = [(it["label"]["deadline_date"], (parse(o) or {}).get("deadline_date")) for it, o in zip(test, tuned_out) if it["label"]["deadline_date"] and not same("deadline_date", (parse(o) or {}).get("deadline_date"), it["label"]["deadline_date"])]
    log(f"TUNED deadline_date misses (gold, pred) first 8: {miss[:8]}")
    model.save_pretrained("/tmp/dossierly-letter-lora")
    rep["adapter"] = "saved to /tmp/dossierly-letter-lora inside the job container only; not exported"
    return rep


def _watchdog() -> None:
    print("RESULT " + json.dumps({"state": "failed", "error": f"watchdog: {WALL_LIMIT}s wall limit reached", "wall_seconds": round(time.time() - T0, 1)}), flush=True)
    os._exit(3)


if __name__ == "__main__":
    wd = threading.Timer(WALL_LIMIT, _watchdog)
    wd.daemon = True
    wd.start()
    try:
        report = main()
        report["state"] = "completed"
    except Exception as exc:
        report = {"state": "failed", "error": f"{type(exc).__name__}: {str(exc)[:400]}", "trace": traceback.format_exc()[-1500:]}
    wd.cancel()
    report["wall_seconds"] = round(time.time() - T0, 1)
    print("RESULT " + json.dumps(report, ensure_ascii=False, separators=(",", ":")), flush=True)
    sys.exit(0 if report["state"] == "completed" else 1)

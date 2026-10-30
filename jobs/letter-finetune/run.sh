#!/usr/bin/env bash
# Entrypoint of the Dossierly letter fine-tune job (1x H100, pytorch CUDA image). Files are injected under /opt/dossierly.
set -euo pipefail
export HF_HOME=/tmp/hf PYTHONUNBUFFERED=1 TOKENIZERS_PARALLELISM=false
pip install --no-cache-dir -q "transformers==4.51.3" "peft==0.15.2" "accelerate==1.6.0" "huggingface_hub<1.0"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || true
cd /opt/dossierly
exec python3 -u train_eval.py

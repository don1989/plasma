#!/usr/bin/env python3
"""
Quick LoRA checkpoint evaluator — submits to ComfyUI API, saves output.

Usage:
  python3 eval_lora.py <step> "<prompt>"

Examples (v2 checkpoints):
  python3 eval_lora.py v2_final "spyke_plasma_v1, standing in a forest, anime style, full body"
  python3 eval_lora.py v2_step1000 "spyke_plasma_v1, full body, front view, white sleeveless cloak, anime style"
  python3 eval_lora.py v2_step800 "spyke_plasma_v1, full body, combat stance, white sleeveless cloak, anime style"

Output saved to: /tmp/lora_eval/<step>_<seed>.png
"""

import sys, json, requests, time, shutil, uuid
from pathlib import Path

COMFYUI_URL = "http://127.0.0.1:8188"
OUTPUT_DIR = Path("/tmp/lora_eval")
COMFYUI_OUTPUT = Path.home() / "tools/ComfyUI/output"

NEGATIVE = "lowres, bad anatomy, worst quality, blurry, text, watermark, extra limbs"

SEED = 42  # Fixed seed so all checkpoints are directly comparable

def build_workflow(lora_name: str, prompt: str, seed: int) -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple",
              "inputs": {"ckpt_name": "AnythingXL_inkBase.safetensors"}},
        "10": {"class_type": "ModelComputeDtype",
               "inputs": {"model": ["1", 0], "dtype": "fp32"}},
        "2": {"class_type": "LoraLoader",
              "inputs": {"model": ["10", 0], "clip": ["1", 1],
                         "lora_name": lora_name,
                         "strength_model": 0.8, "strength_clip": 0.8}},
        "3": {"class_type": "CLIPSetLastLayer",
              "inputs": {"clip": ["2", 1], "stop_at_clip_layer": -2}},
        "4": {"class_type": "CLIPTextEncode",
              "inputs": {"clip": ["3", 0], "text": prompt}},
        "5": {"class_type": "CLIPTextEncode",
              "inputs": {"clip": ["3", 0], "text": NEGATIVE}},
        "6": {"class_type": "EmptyLatentImage",
              "inputs": {"width": 512, "height": 512, "batch_size": 1}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["2", 0], "positive": ["4", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": 20,
                         "cfg": 7.0, "sampler_name": "euler_ancestral",
                         "scheduler": "normal", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode",
              "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
        "9": {"class_type": "SaveImage",
              "inputs": {"images": ["8", 0], "filename_prefix": f"eval_{lora_name}"}}
    }

def submit_and_wait(workflow: dict) -> str:
    client_id = str(uuid.uuid4())
    resp = requests.post(f"{COMFYUI_URL}/prompt",
                         json={"prompt": workflow, "client_id": client_id}, timeout=10)
    resp.raise_for_status()
    prompt_id = resp.json()["prompt_id"]
    print(f"  Job submitted: {prompt_id[:8]}...", flush=True)

    # Poll history until done
    for _ in range(300):  # up to 5 min
        time.sleep(2)
        hist = requests.get(f"{COMFYUI_URL}/history/{prompt_id}", timeout=5).json()
        if prompt_id in hist:
            outputs = hist[prompt_id].get("outputs", {})
            for node_out in outputs.values():
                if "images" in node_out:
                    return node_out["images"][0]["filename"]
    raise TimeoutError("ComfyUI did not complete in 5 minutes")

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    step = sys.argv[1]          # e.g. "step1400" or "final"
    prompt = sys.argv[2]

    # Map step label to lora filename in models/loras/
    # vN_final or vN_stepXXX → spyke_plasma_vN.safetensors or spyke_plasma_vN-stepXXXXXXXX.safetensors
    import re as _re
    vm = _re.match(r'^(v\d+)_(.+)$', step)
    if vm:
        ver, tag = vm.group(1), vm.group(2)
        if tag == "final":
            lora_name = f"spyke_plasma_{ver}.safetensors"
        else:
            n = tag.replace("step", "").zfill(8)
            lora_name = f"spyke_plasma_{ver}-step{n}.safetensors"
    else:
        lora_name = f"spyke_plasma_v1_{step}.safetensors"

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\nLoRA:   {lora_name}")
    print(f"Prompt: {prompt}")
    print(f"Seed:   {SEED}")
    print("Generating...", flush=True)

    workflow = build_workflow(lora_name, prompt, SEED)

    try:
        filename = submit_and_wait(workflow)
    except requests.exceptions.ConnectionError:
        print("\nERROR: ComfyUI not running. Start it first:")
        print("  cd ~/tools/ComfyUI && python main.py")
        sys.exit(1)

    # Copy from ComfyUI output dir to /tmp/lora_eval
    src = COMFYUI_OUTPUT / filename
    dest = OUTPUT_DIR / f"{step}_{filename}"
    shutil.copy2(src, dest)

    print(f"\nSaved: {dest}")
    print("Open it with: open", dest)

if __name__ == "__main__":
    main()

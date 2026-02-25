# Phase 5 Benchmark Results

**Date:** 2026-02-19
**Machine:** M1 Pro, macOS 25.2 arm64, 16GB unified memory
**ComfyUI launch flags:** --force-fp16 --listen 127.0.0.1 --port 8188
**ComfyUI version:** 0.14.1
**PyTorch version:** 2.5.1

## System Stats (from /system_stats)

```json
{
    "system": {
        "os": "darwin",
        "ram_total": 17179869184,
        "ram_free": 3989798912,
        "comfyui_version": "0.14.1",
        "required_frontend_version": "1.39.14",
        "installed_templates_version": "0.8.43",
        "required_templates_version": "0.8.43",
        "python_version": "3.11.9 (main, Jun 18 2024, 14:57:51) [Clang 15.0.0 (clang-1500.3.9.4)]",
        "pytorch_version": "2.5.1",
        "embedded_python": false,
        "argv": [
            "main.py",
            "--force-fp16",
            "--listen",
            "127.0.0.1",
            "--port",
            "8188"
        ]
    },
    "devices": [
        {
            "name": "mps",
            "type": "mps",
            "index": null,
            "vram_total": 17179869184,
            "vram_free": 3989798912,
            "torch_vram_total": 17179869184,
            "torch_vram_free": 3989798912
        }
    ]
}
```

## MPS Confirmation

- devices[0].type: mps (PASS — expected: "mps")
- python_version: 3.11.9 (PASS — expected: "3.11.x")
- pytorch_version: 2.5.1 (PASS — confirmed working stable version)

## INFRA-04 Benchmark

**Parameters:**
- Checkpoint: AnythingXL_inkBase.safetensors
- Resolution: 512 x 512
- Steps: 20
- Sampler: euler_ancestral (Euler a)
- Scheduler: normal
- CFG Scale: 7.0
- Prompt: anime character, white cloak, standing, masterpiece

**How to run in ComfyUI browser UI (http://127.0.0.1:8188):**
1. In the "Load Checkpoint" node: select "AnythingXL_inkBase.safetensors"
2. In the "KSampler" node: set sampler_name to "euler_ancestral", scheduler to "normal", steps to 20, cfg to 7.0
3. In the "Empty Latent Image" node: set width to 512, height to 512
4. In the "CLIP Text Encode" (positive prompt) node, enter:
   `anime character, white cloak, standing, masterpiece`
5. Open Activity Monitor → Window → GPU History to monitor Metal utilization
6. Start a timer, click "Queue Prompt", stop timer when image appears

**Results:**
- Elapsed seconds: 15s
- GPU History (Activity Monitor): active (MPS confirmed by speed — 15s is 8x under threshold)

## Verdict

- INFRA-04 benchmark (< 120 seconds): PASS (15s — 8x headroom)
- MPS active (/system_stats devices[0].type == "mps"): PASS
- Phase 5 gate: PASS

"""Reproducible free local image generation; weights and drafts stay outside Git.

Run with the isolated Python 3.12 venv described in HABIT_GAME_LOCAL_ART.
No API keys, remote inference or server/runtime dependency is used.
"""
import argparse
import hashlib
import json
import time
from pathlib import Path

MODEL = "Lykon/dreamshaper-8"
WORKSPACE = Path(__file__).resolve().parents[1]
ART_HOME = WORKSPACE.parent / (WORKSPACE.name + "-art")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--manifest", type=Path, default=WORKSPACE / "docs/art/trials.json")
    parser.add_argument("--only", nargs="*")
    parser.add_argument("--output", type=Path, default=ART_HOME / "drafts")
    parser.add_argument("--cache", type=Path, default=ART_HOME / "models")
    parser.add_argument("--precision", choices=["float32", "float16"], default="float32")
    parser.add_argument("--publish", action="store_true", help="Export only assets marked conceptApproved after visual review.")
    args = parser.parse_args()
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError("Local art requires the authorized CUDA GPU; no paid fallback.")
    properties = torch.cuda.get_device_properties(0)
    print(json.dumps({"gpu": properties.name, "vramMiB": properties.total_memory // 1048576,
                      "torch": torch.__version__, "cuda": torch.version.cuda}), flush=True)
    if args.preflight:
        from huggingface_hub import HfApi
        info = HfApi().model_info(MODEL)
        print(json.dumps({"model": MODEL, "revision": info.sha,
                          "license": info.card_data.license,
                          "files": [item.rfilename for item in info.siblings]}, ensure_ascii=False), flush=True)
        return
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    if manifest["model"] != MODEL or not manifest.get("revision") or manifest["revision"] == "main":
        raise RuntimeError("Pin the verified model revision in the manifest first.")
    if args.publish:
        publish_assets(manifest, args)
        return
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
    print("Loading the pinned free model into the external cache...", flush=True)
    pipeline = StableDiffusionPipeline.from_pretrained(
        MODEL, revision=manifest["revision"], cache_dir=str(args.cache),
        torch_dtype=torch.float32 if args.precision == "float32" else torch.float16,
        use_safetensors=True, variant=manifest.get("variant"), safety_checker=None,
        requires_safety_checker=False,
    )
    pipeline.scheduler = DPMSolverMultistepScheduler.from_config(
        pipeline.scheduler.config, algorithm_type="dpmsolver++", use_karras_sigmas=True)
    pipeline.enable_model_cpu_offload()
    pipeline.enable_attention_slicing("auto")
    pipeline.enable_vae_slicing()
    pipeline.enable_vae_tiling()
    args.output.mkdir(parents=True, exist_ok=True)
    items = [item for item in manifest["assets"] if not args.only or item["id"] in args.only]
    if not items:
        raise RuntimeError("No matching asset IDs in the manifest.")
    for item in items:
        if not item["id"].replace("-", "").replace("_", "").isalnum():
            raise RuntimeError("Unsafe asset ID.")
        destination = args.output / (item["id"] + ".png")
        if destination.exists():
            print("Already generated: " + item["id"], flush=True)
            continue
        prompt = manifest["style"] + ", " + item["prompt"]
        for value in [prompt, manifest["negative"]]:
            if len(pipeline.tokenizer(value).input_ids) > pipeline.tokenizer.model_max_length:
                raise RuntimeError("Prompt exceeds CLIP token limit: " + item["id"])
        def finite_step(_pipeline, _index, _time, tensors):
            if not torch.isfinite(tensors["latents"]).all().item():
                raise RuntimeError("Non-finite image latents; retry with float32, do not deliver black images.")
            return tensors
        torch.cuda.reset_peak_memory_stats()
        start = time.monotonic()
        result = pipeline(
            prompt=prompt,
            negative_prompt=manifest["negative"],
            width=item.get("width", 512), height=item.get("height", 768),
            num_inference_steps=item.get("steps", 28), guidance_scale=item.get("guidance", 7.0),
            generator=torch.Generator(device="cpu").manual_seed(item["seed"]),
            callback_on_step_end=finite_step,
        ).images[0]
        if max(result.getextrema()[channel][1] - result.getextrema()[channel][0] for channel in range(3)) < 10:
            raise RuntimeError("Degenerate image; no artifact is approved or saved.")
        result.save(destination)
        metadata = {"id": item["id"], "model": MODEL, "revision": manifest["revision"],
                    "seed": item["seed"], "prompt": manifest["style"] + ", " + item["prompt"],
                    "negative": manifest["negative"], "size": result.size,
                    "steps": item.get("steps", 28), "guidance": item.get("guidance", 7.0),
                    "precision": args.precision,
                    "seconds": round(time.monotonic() - start, 2),
                    "peakMiB": torch.cuda.max_memory_allocated() // 1048576,
                    "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(), "qa": "pending"}
        destination.with_suffix(".json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(metadata, ensure_ascii=False), flush=True)
    del pipeline
    torch.cuda.empty_cache()


def publish_assets(manifest, args):
    from PIL import Image
    destination = WORKSPACE / "web/assets/than-lo"
    destination.mkdir(parents=True, exist_ok=True)
    inventory = WORKSPACE / "docs/art/assets.json"
    records = json.loads(inventory.read_text(encoding="utf-8")) if inventory.exists() else []
    for item in manifest["assets"]:
        if args.only and item["id"] not in args.only:
            continue
        if not item.get("conceptApproved"):
            raise RuntimeError("Visual review required before exporting: " + item["id"])
        asset_id = item["publishId"]
        if not asset_id.replace("-", "").isalnum() or len(asset_id) > 64:
            raise RuntimeError("Invalid final asset ID.")
        source = args.output / (item["id"] + ".png")
        metadata = json.loads(source.with_suffix(".json").read_text(encoding="utf-8"))
        if hashlib.sha256(source.read_bytes()).hexdigest() != metadata["sha256"] or metadata["revision"] != manifest["revision"]:
            raise RuntimeError("Source provenance mismatch.")
        original = Image.open(source).convert("RGB")
        outputs = []
        for suffix, width in [("", original.width), ("-thumb", 160)]:
            output = destination / (asset_id + suffix + ".webp")
            image = original.copy()
            if width < image.width:
                image.thumbnail((width, max(1, round(original.height * width / original.width))), Image.Resampling.LANCZOS)
            image.save(output, "WEBP", quality=86 if not suffix else 82, method=6)
            outputs.append({"path": output.relative_to(WORKSPACE).as_posix(), "width": image.width,
                            "height": image.height, "bytes": output.stat().st_size,
                            "sha256": hashlib.sha256(output.read_bytes()).hexdigest()})
        records = [record for record in records if record["id"] != asset_id]
        records.append({"id": asset_id, "contentId": item["contentId"], "alt": item["alt"],
                        "role": item["role"], "focalPoint": item["focalPoint"],
                        "modelLicense": "creativeml-openrail-m", "workflow": "scripts/art-local.py",
                        "source": metadata, "files": outputs,
                        "qa": {"concept": "approved", "integratedUi": "pending", "review": item["qaNote"]}})
        print(json.dumps({"published": asset_id, "files": outputs}), flush=True)
    inventory.parent.mkdir(parents=True, exist_ok=True)
    inventory.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()

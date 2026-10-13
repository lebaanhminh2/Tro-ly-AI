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
    parser.add_argument("--contact-sheet", type=Path, help="Build a labelled draft contact sheet without loading the model.")
    args = parser.parse_args()
    if args.contact_sheet:
        contact_sheet(json.loads(args.manifest.read_text(encoding="utf-8")), args)
        return
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
    if args.only:
        unknown = set(args.only) - {item["id"] for item in manifest["assets"]}
        if unknown:
            raise RuntimeError("Unknown requested asset IDs: " + ", ".join(sorted(unknown)))
    model = manifest["model"]
    if not model or not manifest.get("revision") or manifest["revision"] == "main":
        raise RuntimeError("Pin the verified model revision in the manifest first.")
    if args.publish:
        publish_assets(manifest, args)
        return
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
    print("Loading the pinned free model into the external cache...", flush=True)
    pipeline = StableDiffusionPipeline.from_pretrained(
        model, revision=manifest["revision"], cache_dir=str(args.cache),
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
        prompt = item.get("style", manifest["style"]) + ", " + item["prompt"]
        negative = manifest["negative"] + (", " + item["negative"] if item.get("negative") else "")
        if destination.exists():
            saved = json.loads(destination.with_suffix(".json").read_text(encoding="utf-8"))
            if saved["model"] != model or saved["revision"] != manifest["revision"] or saved["seed"] != item["seed"] or saved["prompt"] != prompt or saved["negative"] != negative:
                raise RuntimeError("Existing draft belongs to another workflow; use a versioned asset ID: " + item["id"])
            expected = {"size": [item.get("width", 512), item.get("height", 768)],
                        "steps": item.get("steps", 28), "guidance": item.get("guidance", 7.0),
                        "precision": args.precision}
            if any(saved.get(key) != value for key, value in expected.items()):
                raise RuntimeError("Existing draft settings changed; use a versioned asset ID: " + item["id"])
            if hashlib.sha256(destination.read_bytes()).hexdigest() != saved["sha256"]:
                raise RuntimeError("Existing draft hash mismatch: " + item["id"])
            print("Already generated and verified: " + item["id"], flush=True)
            continue
        for value in [prompt, negative]:
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
            negative_prompt=negative,
            width=item.get("width", 512), height=item.get("height", 768),
            num_inference_steps=item.get("steps", 28), guidance_scale=item.get("guidance", 7.0),
            generator=torch.Generator(device="cpu").manual_seed(item["seed"]),
            callback_on_step_end=finite_step,
        ).images[0]
        if max(result.getextrema()[channel][1] - result.getextrema()[channel][0] for channel in range(3)) < 10:
            raise RuntimeError("Degenerate image; no artifact is approved or saved.")
        temporary_image = destination.with_suffix(".pending.png")
        result.save(temporary_image)
        metadata = {"id": item["id"], "model": model, "revision": manifest["revision"],
                    "seed": item["seed"], "prompt": prompt,
                    "negative": negative, "size": result.size,
                    "steps": item.get("steps", 28), "guidance": item.get("guidance", 7.0),
                    "precision": args.precision,
                    "seconds": round(time.monotonic() - start, 2),
                    "peakMiB": torch.cuda.max_memory_allocated() // 1048576,
                    "sha256": hashlib.sha256(temporary_image.read_bytes()).hexdigest(), "qa": "pending"}
        temporary_metadata = destination.with_suffix(".pending.json")
        temporary_metadata.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary_metadata.replace(destination.with_suffix(".json"))
        temporary_image.replace(destination)
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
        if hashlib.sha256(source.read_bytes()).hexdigest() != metadata["sha256"] or metadata["revision"] != manifest["revision"] or metadata["model"] != manifest["model"]:
            raise RuntimeError("Source provenance mismatch.")
        expected = {"id": item["id"], "seed": item["seed"],
                    "prompt": item.get("style", manifest["style"]) + ", " + item["prompt"],
                    "negative": manifest["negative"] + (", " + item["negative"] if item.get("negative") else ""),
                    "size": [item.get("width", 512), item.get("height", 768)],
                    "steps": item.get("steps", 28), "guidance": item.get("guidance", 7.0)}
        if any(metadata.get(key) != value for key, value in expected.items()):
            raise RuntimeError("Source settings do not match publication manifest: " + item["id"])
        original = Image.open(source).convert("RGB")
        crop = item.get("crop")
        if crop:
            if len(crop) != 4 or not (0 <= crop[0] < crop[2] <= 1 and 0 <= crop[1] < crop[3] <= 1):
                raise RuntimeError("Invalid normalized crop: " + item["id"])
            original = original.crop(tuple(round(value * original.size[index % 2]) for index, value in enumerate(crop)))
        outputs = []
        for suffix, width in [("", original.width), ("-thumb", 160)]:
            output = destination / (asset_id + suffix + ".webp")
            image = original.copy()
            if suffix and item["role"] in ("boss", "portrait"):
                edge = min(image.size)
                focal_x, focal_y = item["focalPoint"]
                left = max(0, min(image.width - edge, round(focal_x * image.width - edge / 2)))
                top = max(0, min(image.height - edge, round(focal_y * image.height - edge / 2)))
                image = image.crop((left, top, left + edge, top + edge))
            if width < image.width:
                image.thumbnail((width, max(1, round(image.height * width / image.width))), Image.Resampling.LANCZOS)
            temporary_output = output.with_suffix(".pending.webp")
            image.save(temporary_output, "WEBP", quality=86 if not suffix else 82, method=6)
            temporary_output.replace(output)
            outputs.append({"path": output.relative_to(WORKSPACE).as_posix(), "width": image.width,
                            "height": image.height, "bytes": output.stat().st_size,
                            "sha256": hashlib.sha256(output.read_bytes()).hexdigest()})
        records = [record for record in records if record["id"] != asset_id]
        records.append({"id": asset_id, "contentId": item["contentId"], "alt": item["alt"],
                        "role": item["role"], "focalPoint": item["focalPoint"],
                        "crop": crop, "direction": manifest.get("direction", "original-v1"),
                        "modelLicense": manifest.get("license", "creativeml-openrail-m"), "workflow": "scripts/art-local.py",
                        "source": metadata, "files": outputs,
                        "qa": {"concept": "approved", "integratedUi": "pending", "review": item["qaNote"]}})
        print(json.dumps({"published": asset_id, "files": outputs}), flush=True)
    inventory.parent.mkdir(parents=True, exist_ok=True)
    temporary_inventory = inventory.with_suffix(".pending.json")
    temporary_inventory.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary_inventory.replace(inventory)


def contact_sheet(manifest, args):
    from PIL import Image, ImageDraw, ImageOps
    items = [item for item in manifest["assets"] if (not args.only or item["id"] in args.only)
             and (args.output / (item["id"] + ".png")).exists()]
    if not items:
        raise RuntimeError("No generated drafts to inspect.")
    columns = min(5, len(items))
    cell_width, cell_height = 224, 336
    sheet = Image.new("RGB", (columns * cell_width, ((len(items) + columns - 1) // columns) * cell_height), "#eee8df")
    draw = ImageDraw.Draw(sheet)
    for index, item in enumerate(items):
        x, y = (index % columns) * cell_width, (index // columns) * cell_height
        source = Image.open(args.output / (item["id"] + ".png")).convert("RGB")
        preview = ImageOps.contain(source, (cell_width - 16, cell_height - 44))
        sheet.paste(preview, (x + (cell_width - preview.width) // 2, y + 8))
        draw.text((x + 8, y + cell_height - 24), item.get("publishId", item["id"]), fill="#282a2c")
    args.contact_sheet.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.contact_sheet)
    print(json.dumps({"contactSheet": str(args.contact_sheet), "drafts": len(items)}), flush=True)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Prepare generated GridStrike actors and scenario previews for shipping."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def prepare_actor(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGBA")
    bounds = image.getbbox()
    if bounds is None:
        raise ValueError(f"{source} does not contain visible pixels")
    left, top, right, bottom = bounds
    padding = 12
    image = image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        )
    )
    image.thumbnail((640, 640), Image.Resampling.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, format="PNG", optimize=True)


def prepare_preview(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGB")
    target_ratio = 16 / 9
    current_ratio = image.width / image.height
    if current_ratio > target_ratio:
        cropped_width = round(image.height * target_ratio)
        left = (image.width - cropped_width) // 2
        image = image.crop((left, 0, left + cropped_width, image.height))
    else:
        cropped_height = round(image.width / target_ratio)
        top = (image.height - cropped_height) // 2
        image = image.crop((0, top, image.width, top + cropped_height))
    image = image.resize((1600, 900), Image.Resampling.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, format="WEBP", quality=78, method=6)
    if target.stat().st_size > 500_000:
        image.save(target, format="WEBP", quality=70, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=("actor", "preview"))
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    if args.kind == "actor":
        prepare_actor(args.source, args.target)
    else:
        prepare_preview(args.source, args.target)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Fetch puzzle completion JSONs from NYT and save them locally.

This script expects a file named `subscription_header.txt` in the same folder
containing the NYT cookie value (either the raw value or `NYT-S=...`).

Usage:
    python3 fetch_puzzles.py
    python3 fetch_puzzles.py -i puzzle_data.json -c subscription_header.txt -o puzzle_completion_data --force

Notes:
 - The script reads `puzzle_data.json` (or custom -i) and iterates `results`.
 - For each object with a `puzzle_id`, it calls curl:
     curl 'https://www.nytimes.com/svc/crosswords/v6/game/{id}.json' -H 'accept: application/json' --cookie 'NYT-S={cookie}'
 - Output files are written to the output directory as `{puzzle_id}.json`.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


def load_cookie(cookie_file: Path) -> str:
    if not cookie_file.exists():
        raise FileNotFoundError(f"Cookie file not found: {cookie_file}")
    raw = cookie_file.read_text(encoding="utf-8").strip()
    if not raw:
        raise ValueError("Cookie file is empty")
    # allow either full `NYT-S=...` or just the value
    return raw if raw.startswith("NYT-S=") else f"NYT-S={raw}"


def load_puzzle_ids(json_path: Path) -> list[int]:
    with json_path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list):
        # try to find results nested
        def find_results(obj: Any):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if k == "results" and isinstance(v, list):
                        return v
                    r = find_results(v)
                    if r:
                        return r
            elif isinstance(obj, list):
                for el in obj:
                    r = find_results(el)
                    if r:
                        return r
            return None

        results = find_results(data) or []

    ids: list[int] = []
    for el in results:
        if isinstance(el, dict) and "puzzle_id" in el:
            try:
                ids.append(int(el["puzzle_id"]))
            except Exception:
                continue
    return ids


def fetch_one(puzzle_id: int, cookie: str, out_path: Path, timeout: int = 60) -> None:
    url = f"https://www.nytimes.com/svc/crosswords/v6/game/{puzzle_id}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Use curl to match requested call
    cmd = [
        "curl",
        url,
        "-H",
        "accept: application/json",
        "--cookie",
        cookie,
        "-sS",
        "-o",
        str(out_path),
    ]
    try:
        subprocess.run(cmd, check=True, timeout=timeout)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"curl failed for {puzzle_id}: {e}")


def main() -> None:
    p = argparse.ArgumentParser(description="Fetch NYT puzzle completion JSONs for puzzle_ids in a JSON file")
    p.add_argument("-i", "--input", default="data_output/puzzle_data.json", help="Input JSON file containing `results`")
    p.add_argument("-c", "--cookie-file", default="subscription_header.txt", help="File containing NYT cookie value (or full NYT-S=...)")
    p.add_argument("-o", "--out-dir", default="data_output/puzzle_completion_data", help="Directory to save fetched puzzle JSONs")
    p.add_argument("--delay", type=float, default=0.3, help="Delay in seconds between requests")
    p.add_argument("--force", action="store_true", help="Overwrite existing files")
    args = p.parse_args()

    inp = Path(args.input)
    cookie_file = Path(args.cookie_file)
    out_dir = Path(args.out_dir)

    if not inp.exists():
        print(f"Input file not found: {inp}")
        sys.exit(1)

    try:
        cookie = load_cookie(cookie_file)
    except Exception as e:
        print(f"Error reading cookie: {e}")
        sys.exit(1)

    ids = load_puzzle_ids(inp)
    if not ids:
        print("No puzzle_ids found in input JSON")
        sys.exit(0)

    print(f"Found {len(ids)} puzzle_ids — saving to {out_dir}")

    for i, pid in enumerate(ids, start=1):
        out_path = out_dir / f"{pid}.json"
        if out_path.exists() and not args.force:
            print(f"[{i}/{len(ids)}] Skipping {pid} (exists) -> {out_path}")
        else:
            print(f"[{i}/{len(ids)}] Fetching {pid} -> {out_path}")
            try:
                fetch_one(pid, cookie, out_path)
                time.sleep(args.delay)
            except Exception as e:
                print(f"  ERROR fetching {pid}: {e}")
        # time.sleep(args.delay)


if __name__ == "__main__":
    main()

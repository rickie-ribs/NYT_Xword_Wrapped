#!/usr/bin/env python3
"""Flatten 'results' objects in a JSON file and write them to CSV.

Usage:
    python3 flatten_results_to_csv.py -i puzzle_data.json -o puzzle_data.csv

The script searches the JSON for any `results` key. If `results` is a list,
each element becomes a row; if it's a dict, it's treated as a single row.
Nested objects are flattened with dot-separated keys.
"""
import argparse
import json
import csv
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime


def flatten_dict(d: Dict[str, Any], parent_key: str = "", sep: str = ".") -> Dict[str, Any]:
    items: Dict[str, Any] = {}
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.update(flatten_dict(v, new_key, sep=sep))
        else:
            # For lists or other non-primitive types, store JSON string
            if isinstance(v, (list, tuple)):
                items[new_key] = json.dumps(v, ensure_ascii=False)
            else:
                items[new_key] = v
    return items


def find_results_nodes(obj: Any) -> List[Dict[str, Any]]:
    """Recursively find all `results` nodes and return a list of dicts to write as rows."""
    nodes: List[Dict[str, Any]] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "results":
                if isinstance(v, list):
                    for el in v:
                        if isinstance(el, dict):
                            nodes.append(el)
                        else:
                            nodes.append({"value": el})
                elif isinstance(v, dict):
                    nodes.append(v)
                else:
                    nodes.append({"value": v})
            else:
                nodes.extend(find_results_nodes(v))
    elif isinstance(obj, list):
        for el in obj:
            nodes.extend(find_results_nodes(el))
    return nodes


def _find_key_recursive(obj: Any, target: str) -> Optional[Any]:
    if isinstance(obj, dict):
        if target in obj:
            return obj[target]
        for v in obj.values():
            res = _find_key_recursive(v, target)
            if res is not None:
                return res
    elif isinstance(obj, list):
        for el in obj:
            res = _find_key_recursive(el, target)
            if res is not None:
                return res
    return None


def extract_seconds_from_completion(puzzle_id: Any, completion_dir: Path) -> Optional[int]:
    if puzzle_id is None:
        return None
    path = completion_dir / f"{puzzle_id}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None

    calcs = None
    # prefer top-level calcs
    if isinstance(data, dict) and "calcs" in data:
        calcs = data.get("calcs")
    else:
        calcs = _find_key_recursive(data, "calcs")

    # calcs may be a dict or a list
    if isinstance(calcs, dict):
        # direct seconds value
        if "secondsSpentSolving" in calcs:
            try:
                return int(calcs["secondsSpentSolving"])
            except Exception:
                return None
        # nested inside dict
        val = _find_key_recursive(calcs, "secondsSpentSolving")
        if val is not None:
            try:
                return int(val)
            except Exception:
                return None
        return None

    if isinstance(calcs, list):
        for entry in calcs:
            if isinstance(entry, dict):
                if "secondsSpentSolving" in entry:
                    try:
                        return int(entry["secondsSpentSolving"])
                    except Exception:
                        return None
                val = _find_key_recursive(entry, "secondsSpentSolving")
                if val is not None:
                    try:
                        return int(val)
                    except Exception:
                        return None
    return None


def write_csv(rows: List[Dict[str, Any]], out_path: str) -> None:
    if not rows:
        print("No rows to write.")
        return
    # collect all fieldnames
    fieldnames = sorted({k for r in rows for k in r.keys()})
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            # ensure all keys present
            writer.writerow({k: (r.get(k, "") if r.get(k, "") is not None else "") for k in fieldnames})
    print(f"Wrote {len(rows)} rows to {out_path}")


def main():
    p = argparse.ArgumentParser(description="Flatten 'results' in JSON to CSV")
    p.add_argument("-i", "--input", default="data_output/puzzle_data.json", help="Input JSON file path")
    p.add_argument("-o", "--output", default="data_output/puzzle_data.csv", help="Output CSV path")
    p.add_argument("-k", "--key", default="results", help="Key name to search for (default: results)")
    p.add_argument("--completion-dir", default="data_output/puzzle_completion_data", help="Directory with per-puzzle completion JSONs")
    args = p.parse_args()

    try:
        with open(args.input, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception as e:
        print(f"Error reading JSON file: {e}")
        sys.exit(1)

    # find nodes under the chosen key name (supporting nested search)
    if args.key != "results":
        # quick custom-key search: wrap original function by temporarily renaming
        # Not replacing the function; we'll do a simple recursive search equivalent
        def find_key(obj: Any, target: str) -> List[Dict[str, Any]]:
            nodes: List[Dict[str, Any]] = []
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if k == target:
                        if isinstance(v, list):
                            for el in v:
                                if isinstance(el, dict):
                                    nodes.append(el)
                                else:
                                    nodes.append({"value": el})
                        elif isinstance(v, dict):
                            nodes.append(v)
                        else:
                            nodes.append({"value": v})
                    else:
                        nodes.extend(find_key(v, target))
            elif isinstance(obj, list):
                for el in obj:
                    nodes.extend(find_key(el, target))
            return nodes

        raw_nodes = find_key(data, args.key)
    else:
        raw_nodes = find_results_nodes(data)

        rows = [flatten_dict(n) for n in raw_nodes]

        # augment rows with secondsSpentSolving from completion files
        completion_dir = Path(args.completion_dir)
        for r in rows:
            pid = r.get("puzzle_id")
            seconds = extract_seconds_from_completion(pid, completion_dir)
            # store as integer if found, else blank
            r["secondsSpentSolving"] = seconds if seconds is not None else ""

        # add Day column derived from print_date (e.g., Monday, Tuesday)
        for r in rows:
            pd = r.get("print_date")
            day = ""
            if isinstance(pd, str) and pd:
                try:
                    day = datetime.fromisoformat(pd).strftime("%A")
                except Exception:
                    day = ""
            r["Day"] = day

        write_csv(rows, args.output)


if __name__ == "__main__":
    main()

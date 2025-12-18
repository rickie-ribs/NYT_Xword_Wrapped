#!/usr/bin/env python3
"""Build a consolidated `puzzle_data.json` by querying the NYT puzzles API month-by-month.

This script queries the service for each month in the given year and collects the `results` arrays
from each response into one combined JSON with the shape:

  { "results": [ ... ] }

Usage examples:
  python3 build_puzzle_data.py                # build for 2025 (Jan-Dec)
  python3 build_puzzle_data.py -y 2025 -o puzzle_data.json
  python3 build_puzzle_data.py -y 2024 -s 3 -e 12

Options:
  -y/--year            Year to fetch (default: 2025)
  -s/--start-month     Start month (1-12, default: 1)
  -e/--end-month       End month (1-12, default: 12)
  -c/--cookie-file     Cookie file path (default: subscription_header.txt)
  -o/--out-file        Output JSON file path (default: puzzle_data.json)
  --delay              Delay between requests in seconds (default: 0.5)
  --retries            Number of retries per request (default: 3)
  --publish-type       publish_type query param (default: daily)

"""
from __future__ import annotations

import argparse
import calendar
import json
import sys
import time
from pathlib import Path
from typing import Any

try:
    # Use built-in urllib to avoid adding runtime deps
    from urllib.request import Request, urlopen
    from urllib.error import URLError, HTTPError
except Exception:  # pragma: no cover - fallback
    raise


def load_cookie(cookie_file: Path) -> str:
    if not cookie_file.exists():
        raise FileNotFoundError(f"Cookie file not found: {cookie_file}")
    raw = cookie_file.read_text(encoding="utf-8").strip()
    if not raw:
        raise ValueError("Cookie file is empty")
    return raw if raw.startswith("NYT-S=") else f"NYT-S={raw}"


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


def fetch_month_results(year: int, month: int, cookie: str, publish_type: str = "daily", retries: int = 3, timeout: int = 30):
    """Fetch a month's results list from the NYT puzzles service.

    Returns the list of results (possibly empty) or raises an exception on
    unrecoverable error.
    """
    last_day = calendar.monthrange(year, month)[1]
    date_start = f"{year}-{month:02d}-01"
    date_end = f"{year}-{month:02d}-{last_day:02d}"
    url = (
        "https://www.nytimes.com/svc/crosswords/v3/36569100/puzzles.json"
        f"?publish_type={publish_type}&date_start={date_start}&date_end={date_end}"
    )

    headers = {"Accept": "application/json", "Cookie": cookie}

    last_err = None
    for attempt in range(1, retries + 1):
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                data = json.loads(raw)
                results = find_results(data)
                if results is None:
                    # no results key; return empty list and warn
                    print(f"Warning: no 'results' found for {date_start}..{date_end}")
                    return []
                if not isinstance(results, list):
                    print(f"Warning: 'results' is not a list for {date_start}..{date_end}")
                    return []
                return results
        except (HTTPError, URLError) as e:
            last_err = e
            wait = 2 ** (attempt - 1)
            print(f"Error fetching {date_start}..{date_end} (attempt {attempt}/{retries}): {e}; retrying in {wait}s...")
            time.sleep(wait)
        except Exception as e:  # JSON errors, etc.
            last_err = e
            print(f"Error parsing response for {date_start}..{date_end}: {e}")
            break
    raise RuntimeError(f"Failed fetching {date_start}..{date_end}") from last_err


def build_results(year: int, start_month: int, end_month: int, cookie: str, publish_type: str, delay: float, retries: int):
    combined: list = []
    total_months = end_month - start_month + 1
    count = 0
    for i, m in enumerate(range(start_month, end_month + 1), start=1):
        print(f"[{i}/{total_months}] Fetching {year}-{m:02d}...")
        try:
            results = fetch_month_results(year, m, cookie, publish_type=publish_type, retries=retries)
        except Exception as e:
            print(f"  ERROR: {e}")
            results = []
        combined.extend(results)
        count += len(results)
        print(f"  got {len(results)} items (total so far: {count})")
        time.sleep(delay)
    return combined


def main(argv=None):
    p = argparse.ArgumentParser(description="Build a consolidated puzzle_data.json for a year by querying the NYT service month-by-month")
    p.add_argument("-y", "--year", type=int, default=2025, help="Year to fetch (default: 2025)")
    p.add_argument("-s", "--start-month", type=int, default=1, help="Start month (1-12)")
    p.add_argument("-e", "--end-month", type=int, default=12, help="End month (1-12)")
    p.add_argument("-c", "--cookie-file", default="subscription_header.txt", help="File containing NYT cookie value (NYT-S=...) or raw value")
    p.add_argument("-o", "--out-file", default="puzzle_data.json", help="Output JSON file path")
    p.add_argument("--delay", type=float, default=0.5, help="Delay between requests in seconds (default: 0.5)")
    p.add_argument("--retries", type=int, default=3, help="Number of retries per request (default: 3)")
    p.add_argument("--publish-type", default="daily", help="publish_type query param (default: daily)")

    args = p.parse_args(argv)

    cookie_file = Path(args.cookie_file)
    try:
        cookie = load_cookie(cookie_file)
    except Exception as e:
        print(f"Error reading cookie file: {e}")
        sys.exit(1)

    if not (1 <= args.start_month <= 12 and 1 <= args.end_month <= 12 and args.start_month <= args.end_month):
        print("Start and end months must be between 1 and 12 and start <= end")
        sys.exit(1)

    print(f"Building results for {args.year}, months {args.start_month}..{args.end_month}")
    combined = build_results(args.year, args.start_month, args.end_month, cookie, args.publish_type, args.delay, args.retries)

    out = {"results": combined}
    # Always write output into the `data_output` directory (use provided filename)
    out_dir = Path('data_output')
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file_name = Path(args.out_file).name
    out_path = out_dir / out_file_name
    out_path.write_text(json.dumps(out, indent=4, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(combined)} total items to {out_path}")


if __name__ == "__main__":
    main()

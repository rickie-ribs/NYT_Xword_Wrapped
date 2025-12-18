#!/usr/bin/env python3
"""Run the full data pipeline and optionally serve the web app.

Usage:
  python3 run_all.py [--no-fetch] [--no-browser] [--port 8000] [--force-fetch]

This script runs, in order:
  1. build_puzzle_data.py
  2. fetch_puzzles.py
  3. flatten_results_to_csv.py
  4. data_pipeline.py

Then it starts a static HTTP server serving `data_output/` on the provided port
and (by default) opens a web browser to http://localhost:PORT/

Options allow skipping steps or passing through a few common args.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
import signal
import webbrowser
from pathlib import Path
from typing import List

PY = sys.executable or "python3"
ROOT = Path(__file__).parent.resolve()
DATA_OUTPUT = ROOT / "data_output"


def run_cmd(cmd: List[str], check: bool = True) -> int:
    print(f"\n>>> Running: {' '.join(cmd)}")
    proc = subprocess.run(cmd)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)} (exit {proc.returncode})")
    return proc.returncode


class ServerHandle:
    def __init__(self, port: int):
        self.port = port
        self.proc = None

    def start(self):
        # Start the server in DATA_OUTPUT directory
        if not DATA_OUTPUT.exists():
            raise FileNotFoundError(f"data_output directory not found: {DATA_OUTPUT}")
        cmd = [PY, "-m", "http.server", str(self.port)]
        print(f"Starting HTTP server in {DATA_OUTPUT} on port {self.port}...")
        self.proc = subprocess.Popen(cmd, cwd=str(DATA_OUTPUT))
        time.sleep(0.5)
        if self.proc.poll() is not None:
            raise RuntimeError("Failed starting HTTP server")
        print(f"Server started (pid {self.proc.pid})")

    def stop(self):
        if self.proc and self.proc.poll() is None:
            print("Stopping server...")
            self.proc.terminate()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait(timeout=5)
            print("Server stopped.")


def main(argv=None):
    p = argparse.ArgumentParser(description="Run full pipeline and optionally serve the app")
    p.add_argument("--no-build", action="store_true", help="Skip build_puzzle_data.py")
    p.add_argument("--no-fetch", action="store_true", help="Skip fetch_puzzles.py")
    p.add_argument("--no-flatten", action="store_true", help="Skip flatten_results_to_csv.py")
    p.add_argument("--no-pipeline", action="store_true", help="Skip data_pipeline.py")
    p.add_argument("--no-browser", action="store_true", help="Don't open a web browser")
    p.add_argument("--force-fetch", action="store_true", help="Pass --force to fetch_puzzles.py")
    p.add_argument("--port", type=int, default=8000, help="Port to serve on (default: 8000)")
    p.add_argument("--build-year", type=int, help="Year to pass to build_puzzle_data.py (optional)")
    args = p.parse_args(argv)

    try:
        # 1. build_puzzle_data.py
        if not args.no_build:
            cmd = [PY, str(ROOT / "build_puzzle_data.py")]
            if args.build_year:
                cmd += ["-y", str(args.build_year)]
            run_cmd(cmd)
        else:
            print("Skipping build step")

        # 2. fetch_puzzles.py
        if not args.no_fetch:
            cmd = [PY, str(ROOT / "fetch_puzzles.py"), "-i", "data_output/puzzle_data.json"]
            if args.force_fetch:
                cmd.append("--force")
            run_cmd(cmd)
        else:
            print("Skipping fetch step")

        # 3. flatten_results_to_csv.py
        if not args.no_flatten:
            cmd = [PY, str(ROOT / "flatten_results_to_csv.py"), "-i", "data_output/puzzle_data.json", "-o", "data_output/puzzle_data.csv"]
            run_cmd(cmd)
        else:
            print("Skipping flatten step")

        # 4. data_pipeline.py
        if not args.no_pipeline:
            cmd = [PY, str(ROOT / "data_pipeline.py")]
            run_cmd(cmd)
        else:
            print("Skipping data pipeline step")

        # Start server
        server = ServerHandle(args.port)
        server.start()

        url = f"http://localhost:{args.port}/"
        print(f"App should be available at: {url}")

        if not args.no_browser:
            print("Opening web browser...")
            try:
                webbrowser.open(url)
            except Exception as e:
                print(f"Failed to open browser: {e}")

        # Wait until server process terminates (or user hits Ctrl-C)
        def _sigint(signum, frame):
            print("\nReceived interrupt, shutting down...")
            server.stop()
            sys.exit(0)

        signal.signal(signal.SIGINT, _sigint)
        signal.signal(signal.SIGTERM, _sigint)

        # Block while server is running
        while True:
            if server.proc.poll() is not None:
                print("Server exited")
                break
            time.sleep(0.5)

    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

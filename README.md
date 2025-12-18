# NYT_Xword_Wrapped

NYT CROSSWORD WRAPPED

Crossword solve analytics and personal NYT Crossword tracking.

This repository collects NYT puzzle metadata and your per-puzzle completion data, processes it into summarized views, and provides a static web UI for interactive visualization.

---

## Quickstart ✅

Prerequisites:
- Python 3.8+ (3.10+ recommended)
- `curl` available on PATH (used by `fetch_puzzles.py`)
- Valid NYT session cookie saved in `subscription_header.txt` (see Security note)

Run the full pipeline and serve the web app:

```bash
# from repository root
# gather all necessary crossword data, construct the summarized views, then launch web app
python3 run_all.py
```

Common flags:
- `--no-build` — skip `build_puzzle_data.py`
- `--no-fetch` — skip `fetch_puzzles.py`
- `--no-flatten` — skip `flatten_results_to_csv.py`
- `--no-pipeline` — skip `data_pipeline.py`
- `--no-browser` — don't open a browser
- `--force-fetch` — pass `--force` to `fetch_puzzles.py`
- `--port <port>` — change server port (default: 8000)
- `--build-year <year>` — pass the year to `build_puzzle_data.py`

If you prefer to run steps manually, run them in order:

1. Build puzzle metadata (writes `data_output/puzzle_data.json`)

```bash
python3 build_puzzle_data.py -y 2025 -o puzzle_data.json
# writes into data_output/puzzle_data.json
```

2. Fetch per-puzzle completion JSONs

```bash
python3 fetch_puzzles.py -i data_output/puzzle_data.json -o data_output/puzzle_completion_data --force
```

3. Flatten results to CSV (includes seconds from per-puzzle JSONs)

```bash
python3 flatten_results_to_csv.py -i data_output/puzzle_data.json -o data_output/puzzle_data.csv
```

4. Run the data pipeline to generate card JSON files

```bash
python3 data_pipeline.py
# generates JSON files in data_output/card_data
```

5. Serve the `data_output` folder

```bash
# quick and simple static server
python3 -m http.server
# then browse to http://localhost:8000/
```

---

## Files & Scripts 🔧

- `build_puzzle_data.py` — fetches monthly puzzle metadata from the NYT API and writes `data_output/puzzle_data.json`.
- `fetch_puzzles.py` — fetches a user's per-puzzle completion JSONs (one file per `puzzle_id`) into `data_output/puzzle_completion_data/`.
- `flatten_results_to_csv.py` — flattens `results` into `data_output/puzzle_data.csv` and augments rows with `secondsSpentSolving` from fetched completion files.
- `data_pipeline.py` — processes the CSV into card JSON outputs used by the frontend (`data_output/card_data/`).
- `run_all.py` — master runner that executes all steps (with flags) and starts a static server, optionally opening a web browser.

---

## License

This project is licensed under the MIT License — see the `LICENSE` file for details.


---

## NYT APIs Used

This project uses the following two requests to NYT. Successful execution of these requires a session cookie to authenticate the request for your user.

- URL to get puzzle IDs and data: https://www.nytimes.com/svc/crosswords/v3/36569100/puzzles.json?publish_type=daily&date_start=2025-11-01&date_end=2025-12-31 (where start date and end date are updated to a maximum window of 100 days)
- URL to get puzzle details: https://www.nytimes.com/svc/crosswords/v6/game/23290.json (where 23290 is the puzzle id)


---

## Security / Privacy ⚠️

This project requires an NYT session cookie to fetch per-puzzle data. Do NOT commit your `subscription_header.txt` file or any cookies to source control. 

**Data & NYT Content Notice**

- This repository contains personal analytics built from data fetched from the New York Times service for your own account. You are responsible for complying with NYT's Terms of Service. Do not redistribute NYT puzzle content or per-user completion data from this repository (including under `data_output/`) unless you have the right to do so.
- Public distribution of fetched NYT content may violate NYT terms; the code is provided for personal analytics and research only.

---

## Development & Notes 💡

- The generated outputs live in `data_output/` and include the static site used by the frontend (`index.html`, JS/JSON assets).

---

## License / Attribution

This repository is for personal analytics and uses the NYT public APIs for puzzle metadata. Respect NYT terms-of-service and your own account privacy.

---
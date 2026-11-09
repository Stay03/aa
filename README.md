# Finals of Arsenal, Chelsea, Liverpool, Man City and Man United, 1996–2026: dataset and analysis

Deliverables are in `deliverables/`:

| File | Contents |
|---|---|
| `finals_dataset.xlsx` | Workbook. Data tabs: Finals, Club_Appearances, Contested_Decisions, Referees, Referee_PL_Records, Excluded_OneOffs, Uncertain. Analysis tabs: A_* |
| `csv/` | One CSV per workbook tab |
| `METHODOLOGY.md` | Definitions, sources, exclusions, statistical methods |
| `FINDINGS.md` | What the data show, how strong the evidence is, limitations |
| `UNCERTAIN.md` + `uncertain_items.csv` | Unverified or uncertain data points |

To rebuild from source data (run from `scripts/`):

```
python3 standings.py
python3 own_elo.py
python3 refrecords.py
python3 merge.py
python3 analysis.py
python3 build_outputs.py
```

Inputs:

- `raw/`: cached Wikipedia wikitext and football-data.co.uk CSVs.
- `work/out_*.json`: per-final research records with source URLs.
- `work/curated_overrides.json`: manual corrections, each with its reason.

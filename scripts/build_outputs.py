"""Build final deliverables: XLSX workbook + CSV copies of each tab."""
import json, os, re, glob, warnings
warnings.filterwarnings("ignore")
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/.."
W = ROOT + "/work/"
OUT = ROOT + "/deliverables/"
os.makedirs(OUT + "csv", exist_ok=True)
CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Manchester City", "Manchester United"]

fin = pd.read_csv(W + "m_finals.csv")
app = pd.read_csv(W + "analysis/appearances_used.csv")
dec = pd.read_csv(W + "m_decisions.csv")
plrec = pd.read_csv(W + "pl_referee_club_records.csv")
foreign = json.load(open(W + "out_foreign_referees.json"))

# ---------- referees tab ----------
SPECIAL = {"Bobby Madley": "R Madley", "Robert Madley": "R Madley", "Andrew Madley": "A Madley", "Stephen Lodge": "S Lodge",
           "Andy D'Urso": "A D'Urso", "Steve Bennett": "S Bennett"}


def fd_name(full):
    if not isinstance(full, str):
        return None
    full = re.sub(r"\(.*?\)", "", full).strip()
    if full in SPECIAL:
        return SPECIAL[full]
    p = full.split()
    return f"{p[0][0]} {p[-1]}" if len(p) >= 2 else full


fmap = {f["referee"]: f for f in foreign}


def foreign_lookup(name):
    if name in fmap:
        return fmap[name]
    for k, v in fmap.items():
        if k.split()[-1] == name.split()[-1] and k.split()[0][0] == name.split()[0][0]:
            return v
    return None


ref_rows = []
for ref, g in fin.groupby("referee"):
    row = {"referee": ref, "nationality": "; ".join(sorted(set(g.referee_nationality.dropna().astype(str)))),
           "federation": "; ".join(sorted(set(g.referee_association.dropna().astype(str)))),
           "finals_officiated": len(g), "finals": "; ".join(g.final_id)}
    a = app[app.referee == ref]
    for c in CLUBS:
        ac = a[a.club == c]
        row[f"{c}: finals W-L (these finals)"] = f"{int(ac.won.sum())}-{int((~ac.won.astype(bool)).sum())}" if len(ac) else ""
    d = dec[dec.referee == ref]
    row["contested_decisions_in_these_finals"] = len(d)
    for c in CLUBS:
        fv, ag = int((d.favoured_team == c).sum()), int((d.against_team == c).sum())
        row[f"{c}: contested decisions for/against"] = f"{fv}/{ag}" if fv + ag else ""
    fd = fd_name(ref)
    pr = plrec[plrec.referee_fd == fd]
    eng = g.referee_association.astype(str).str.contains("FA|PGMOL|England").any()
    if eng:
        for c in CLUBS:
            x = pr[pr.club == c]
            row[f"{c}: overall record (source)"] = (
                f"PL {x.seasons.iloc[0]}: P{x.P.iloc[0]} W{x.W.iloc[0]} D{x.D.iloc[0]} L{x.L.iloc[0]}; win% {x.win_pct.iloc[0]} vs club's same-season {x.expected_win_pct.iloc[0]}"
                if len(x) else "no PL record in football-data (2000-01 onward)")
        row["overall_record_scope"] = "Premier League only, 2000-01 to 2026-27 (football-data.co.uk referee field); cup/European matches NOT included; pre-2000 matches unavailable"
        row["overall_record_sources"] = "https://www.football-data.co.uk/englandm.php (season CSVs E0, 'Referee' column)"
        row["record_uncertain"] = "Referee names in source are abbreviated (initial+surname); a few seasons have spelling variants (normalised). Records for 1996-2000 finals' referees exclude their pre-2000 matches."
    else:
        f = foreign_lookup(ref)
        srcs = []
        for c in CLUBS:
            txt = "not found"
            if f:
                for r in f.get("records") or []:
                    if r.get("club") == c:
                        if r.get("P") is not None:
                            txt = f"P{r.get('P')} W{r.get('W')} D{r.get('D')} L{r.get('L')} ({r.get('scope')}; {r.get('source_type')})"
                        else:
                            txt = f"{r.get('scope') or 'partial'}: {(r.get('note') or '')[:250]}"
                        if r.get("source"):
                            srcs.append(r["source"])
            row[f"{c}: overall record (source)"] = txt
        row["overall_record_scope"] = "All competitions where found (Liverpool via LFChistory.net referee pages; others mostly partial)"
        row["overall_record_sources"] = " | ".join(dict.fromkeys(srcs))
        row["record_uncertain"] = " || ".join((f or {}).get("uncertain") or [])
        if f:
            row["nationality_sources"] = " | ".join(f.get("nationality_sources") or [])
            row["notable_prior_incidents"] = " || ".join(f"{i.get('date')} {i.get('match')}: {i.get('description')} [{' | '.join(i.get('sources') or [])}]" for i in f.get("notable_prior_incidents") or [])
    row["finals_referee_sources"] = " | ".join(dict.fromkeys(s for x in g.referee_sources.dropna() for s in str(x).split(" | ")))
    ref_rows.append(row)
refs = pd.DataFrame(ref_rows).sort_values("referee")

# ---------- PL referee records restricted to referees in the finals ----------
fdnames = {fd_name(r) for r in fin.referee.dropna()}
pl_tab = plrec[plrec.referee_fd.isin(fdnames)].copy()
pl_tab["source"] = "football-data.co.uk Premier League CSVs (Referee, results, cards), 2000-01 onward"
pl_tab["note"] = "expected_* = club's average in the same seasons across all PL matches (baseline). Not a test of bias: referee allocation is not random."

# ---------- uncertain list ----------
unc = []
for r in fin.itertuples():
    for u in str(r.uncertain).split(" || ") if isinstance(r.uncertain, str) else []:
        unc.append({"final_id": r.final_id, "area": "match data", "item": u})
    if r.core_verified is False or str(r.core_verified) == "False":
        unc.append({"final_id": r.final_id, "area": "core facts", "item": "core facts (date/venue/teams/score/winner) NOT confirmed by two independent non-Wikipedia sources"})
    if str(r.cards_complete) == "False":
        unc.append({"final_id": r.final_id, "area": "cards", "item": "card list not confirmed complete"})
    if not isinstance(r.referee_sources, str) or len(str(r.referee_sources).split(" | ")) < 2:
        unc.append({"final_id": r.final_id, "area": "referee", "item": "referee identity confirmed by fewer than two independent non-Wikipedia sources"})
    if pd.isna(r.var_in_use):
        unc.append({"final_id": r.final_id, "area": "VAR", "item": "VAR use not confirmed by a source"})
    if pd.isna(r.glt_in_use):
        unc.append({"final_id": r.final_id, "area": "GLT", "item": "goal-line technology use not confirmed by a source"})
for r in dec.itertuples():
    if r.n_sources < 2:
        unc.append({"final_id": r.final_id, "area": "contested decision", "item": f"Decision #{r.decision_no} ({r.minute}' {r.type}) rests on a single reputable source"})
for f in foreign:
    for u in f.get("uncertain") or []:
        unc.append({"final_id": "", "area": f"referee record: {f['referee']}", "item": u})
GLOBAL = [
    "Club Elo (clubelo.com) ratings could not be retrieved: api.clubelo.com returned HTTP 502 throughout the research window (and web.archive.org was unreachable). No ClubElo values are included.",
    "Bookmaker odds were found for only a minority of finals; many come from ESPN's data feed (US sportsbook lines with no timestamp) rather than newspaper-quoted pre-match prices.",
    "xG is almost entirely unavailable for these matches from a named provider; columns are null except where noted.",
    "BBC/Guardian/Telegraph archives and web.archive.org were often unreachable from the research environment; some items therefore rely on ESPN feeds, RSSSF, UEFA/FIFA PDFs, Sky, RTE and similar.",
    "Five Independent articles (1996-2000 Charity Shields) were retrieved by direct download after the fetch tool refused the site; they are cited but flagged.",
    "League positions are computed from football-data.co.uk results with standard tie-breaks (points, GD, GF); head-to-head tie-breakers (Spain/Italy) and most points deductions are not modelled (Portsmouth 2009-10 and Milan 2006-07 deductions are applied).",
    "Leagues not covered by football-data.co.uk (Brazil, Ecuador, Russia) have no league-position data.",
]
for g in GLOBAL:
    unc.append({"final_id": "(all)", "area": "dataset-wide", "item": g})
unc = pd.DataFrame(unc)

excluded = pd.DataFrame([
    {"match_or_category": "Play-off finals", "clubs": "none", "status": "None found", "reason": "None of the five clubs played a promotion/relegation play-off final in the period except Manchester City, who were in the second/third tier 1996-2002 and won the 1999 Second Division play-off final (next row); City's other promotions (2000, 2002) were automatic."},
    {"match_or_category": "1999 Football League Second Division play-off final: Manchester City 2-2 Gillingham (a.e.t.; City won 3-1 on penalties), Wembley, 30 May 1999; referee Mark Halsey; att. 76,935", "clubs": "Manchester City", "status": "listed separately, EXCLUDED from analysis", "reason": "Promotion play-off final, not a trophy final. Score/date/venue/shootout confirmed by mancity.com and The National; referee and attendance from Wikipedia only (not independently verified).", "sources": "https://www.mancity.com/news/first-team/first-team-news/2016/february/city-at-wembley-7-famous-wins-1999-play-off-final | https://www.thenationalnews.com/sport/football/how-manchester-city-staged-their-own-legendary-comeback-at-wembley-in-1999-1.867625 | https://en.wikipedia.org/wiki/1999_Football_League_Second_Division_play-off_final"},
    {"match_or_category": "FA Cup final replays", "clubs": "none", "status": "none in period", "reason": "Replays abolished for the final from 1999; no final involving the five clubs between 1996-1999 went to a replay."},
    {"match_or_category": "2000 FIFA Club World Championship (Brazil)", "clubs": "Manchester United", "status": "excluded", "reason": "United were eliminated in the group stage and played no final or placement match."},
    {"match_or_category": "Two-legged finals (UEFA Cup to 1997, Super Cup to 1997)", "clubs": "none", "status": "none in period", "reason": "No two-legged final involving the five clubs fell in the period."},
    {"match_or_category": "Pre-season / invitational tournaments (e.g. Premier League Asia Trophy, Emirates Cup, Audi Cup, International Champions Cup)", "clubs": "all", "status": "excluded, not enumerated", "reason": "Friendly competitions, outside the scope list."},
    {"match_or_category": "FIFA Intercontinental Cup 2024/2025 (new format)", "clubs": "none", "status": "n/a", "reason": "None of the five clubs took part (finals: Real Madrid v Pachuca 2024; PSG v Flamengo 2025)."},
])

# ---------- analysis tabs ----------
an = {}
for k in ["factor_tables", "expected_vs_actual_odds", "expected_vs_actual_ownelo", "shootouts", "decisions_by_club",
          "decisions_by_referee", "decisions_by_ref_nationality", "multiple_testing"]:
    p = W + f"analysis/{k}.csv"
    if os.path.exists(p):
        an[k] = pd.read_csv(p)
conf = open(W + "analysis/confounding.txt").read()
conf_df = pd.DataFrame({"confounding_crosstabs": conf.split("\n")})

readme = pd.DataFrame({"README": [
    "Finals of Arsenal, Chelsea, Liverpool, Manchester City, Manchester United (men), 1 Jan 1996 - 9 Nov 2026.",
    "See METHODOLOGY.md, FINDINGS.md and UNCERTAIN.md in the deliverables folder.",
    "Tabs: Finals (1 row per final) | Club_Appearances (1 row per club per final; finals between two of the five appear twice) |",
    "Contested_Decisions (1 row per disputed decision, with assessment + sources) | Referees (1 row per referee) |",
    "Referee_PL_Records (PL record of each English referee with each club, 2000-01+) | Excluded_OneOffs | Uncertain |",
    "A_* tabs: statistical analysis outputs (win rates by factor, observed vs expected, shootouts, decision direction, multiple testing, confounding).",
    "Sources: every row carries source URLs in *_sources columns. Wikipedia was used only as a starting point and is not counted as an independent source.",
    "core_verified = True means date, venue, teams, score and winner were confirmed by >=2 independent non-Wikipedia sources.",
    "Odds-implied probabilities remove the bookmaker margin; for 1X2 odds the draw is split between the teams in proportion to their win probabilities (assumption).",
    "own_elo_* columns are NOT ClubElo: they are Elo ratings computed by this project from English league results only (top two tiers), available only for finals between two English clubs.",
]})

tabs = [("README", readme), ("Finals", fin), ("Club_Appearances", app), ("Contested_Decisions", dec), ("Referees", refs),
        ("Referee_PL_Records", pl_tab), ("Excluded_OneOffs", excluded), ("Uncertain", unc)]
names = {"factor_tables": "A_WinRates_by_Factor", "expected_vs_actual_odds": "A_Obs_vs_Exp_Odds", "expected_vs_actual_ownelo": "A_Obs_vs_Exp_OwnElo",
         "shootouts": "A_Shootouts", "decisions_by_club": "A_Decisions_by_Club", "decisions_by_referee": "A_Decisions_by_Referee",
         "decisions_by_ref_nationality": "A_Decisions_by_RefNat", "multiple_testing": "A_Multiple_Testing"}
for k, v in an.items():
    tabs.append((names[k], v))
tabs.append(("A_Confounding", conf_df))

xl = OUT + "finals_dataset.xlsx"
with pd.ExcelWriter(xl, engine="openpyxl") as w:
    for name, df in tabs:
        df.to_excel(w, sheet_name=name[:31], index=False)
        df.to_csv(OUT + f"csv/{name}.csv", index=False)
wb = load_workbook(xl)
for ws in wb.worksheets:
    ws.freeze_panes = "A2" if ws.title not in ("README", "A_Confounding") else None
    for c in ws[1]:
        c.font = Font(bold=True)
        c.fill = PatternFill("solid", fgColor="DDE7F0")
    for i, col in enumerate(ws.columns, 1):
        width = min(60, max(10, max(min(len(str(c.value or "")), 60) for c in list(col)[:200]) + 2))
        ws.column_dimensions[get_column_letter(i)].width = width
    if ws.title in ("README", "A_Confounding"):
        ws.column_dimensions["A"].width = 140
        if ws.title == "A_Confounding":
            for row in ws.iter_rows(min_row=2):
                for c in row:
                    c.font = Font(name="Consolas")
wb.save(xl)
unc.to_csv(OUT + "uncertain_items.csv", index=False)
print("wrote", xl, [t[0] for t in tabs])
print("uncertain items:", len(unc), "| referees:", len(refs))

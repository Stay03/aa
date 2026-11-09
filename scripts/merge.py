"""Merge agent outputs + Wikipedia extraction + league standings + Elo + referee data
into tidy tables (finals, club_appearances, contested_decisions, referees)."""
import json, glob, os, re, csv
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/.."
W = ROOT + "/work/"
FIVE = ["Arsenal", "Chelsea", "Liverpool", "Manchester City", "Manchester United"]
ENGLISH_CLUBS = set(FIVE) | {"Aston Villa", "Birmingham City", "Cardiff City", "Crystal Palace", "Everton", "Hull City",
    "Leicester City", "Middlesbrough", "Millwall", "Newcastle United", "Portsmouth", "Southampton", "Stoke City",
    "Sunderland", "Tottenham Hotspur", "Watford", "West Ham United", "Wigan Athletic"}
# Cardiff City play in the English league system; classified "English (league system)" for opponent analysis.

DOMESTIC = {"FA Cup", "League Cup", "Charity/Community Shield"}
EUROPEAN = {"European Cup/Champions League", "UEFA Cup/Europa League", "Cup Winners' Cup", "UEFA Super Cup", "Conference League"}
WORLD = {"Intercontinental Cup", "FIFA Club World Championship/Cup"}


def comp_of(article):
    for k, v in [("UEFA Cup final", "UEFA Cup/Europa League"), ("FA Cup final", "FA Cup"), ("League Cup", "League Cup"), ("EFL Cup", "League Cup"),
                 ("Charity Shield", "Charity/Community Shield"), ("Community Shield", "Charity/Community Shield"),
                 ("Champions League", "European Cup/Champions League"), ("UEFA Cup final", "UEFA Cup/Europa League"),
                 ("Europa League", "UEFA Cup/Europa League"), ("Winners' Cup", "Cup Winners' Cup"), ("Super Cup", "UEFA Super Cup"),
                 ("Intercontinental", "Intercontinental Cup"), ("Club World", "FIFA Club World Championship/Cup"),
                 ("Conference", "Conference League")]:
        if k in article:
            return v


def comp_type(c):
    return "domestic" if c in DOMESTIC else "European" if c in EUROPEAN else "world"


def venue_cat(venue, city):
    v = (venue or "") + " " + (city or "")
    if "Wembley" in v:
        return "Wembley (London)"
    if "Millennium" in v or "Cardiff" in v:
        return "Millennium Stadium (Cardiff)"
    if any(x in v for x in ["Villa Park", "Old Trafford", "Birmingham", "Manchester", "Liverpool"]):
        return "Other venue in England"
    return "Neutral venue abroad"


def load_outputs():
    rows = {}
    files = sorted(glob.glob(W + "out_[A-H]*.json"))
    # gap-fill files (names containing "gapfill") override base entries for the same article
    files = [f for f in files if "gapfill" not in f] + [f for f in files if "gapfill" in f]
    for f in files:
        try:
            for r in json.load(open(f)):
                rows[r["article"]] = r
        except Exception as e:
            print("WARN cannot read", f, e)
    return list(rows.values())


def to_float(x):
    try:
        if x is None or x == "":
            return None
        if isinstance(x, str):
            x = x.replace("%", "").strip()
            if "/" in x:  # fractional odds
                a, b = x.split("/")
                return float(a) / float(b) + 1
        return float(x)
    except Exception:
        return None


def implied_probs(o):
    """Return (p_team1_lifts, method) from an odds dict, removing the overround."""
    if not o:
        return None, None
    l1, l2 = to_float(o.get("team1_to_lift")), to_float(o.get("team2_to_lift"))
    if l1 and l2:
        a, b = 1 / l1, 1 / l2
        return a / (a + b), "to-lift odds (normalised)"
    o1, od, o2 = to_float(o.get("team1")), to_float(o.get("draw")), to_float(o.get("team2"))
    if o1 and od and o2:
        a, d, b = 1 / o1, 1 / od, 1 / o2
        s = a + d + b
        a, d, b = a / s, d / s, b / s
        # draw after 90 min -> ET/penalties: split in proportion to the win probabilities (assumption)
        return a + d * a / (a + b), "1X2 odds (normalised; draw split pro rata)"
    return None, None


def elo_prob(e1, e2):
    if e1 is None or e2 is None:
        return None
    return 1 / (1 + 10 ** (-(e1 - e2) / 400))


def score_tuple(s):
    if not s:
        return None
    m = re.match(r"\s*(\d+)\s*[-–]\s*(\d+)", str(s))
    return (int(m.group(1)), int(m.group(2))) if m else None


def build():
    outs = load_outputs()
    wiki = {r["article"]: r for r in json.load(open(W + "wiki_extract.json"))}
    stand = json.load(open(W + "standings.json")) if os.path.exists(W + "standings.json") else {}
    elo = json.load(open(W + "elo.json")) if os.path.exists(W + "elo.json") else {}
    finals, apps, decs = [], [], []
    for r in outs:
        art = r["article"]
        comp = comp_of(art)
        t1, t2 = r.get("team1"), r.get("team2")
        st = stand.get(art, {})
        p1, pmethod = implied_probs(r.get("odds"))
        e = elo.get(art, {})
        e1, e2 = e.get("elo1"), e.get("elo2")
        pe = elo_prob(e1, e2)
        stats = r.get("stats") or {}
        o = r.get("odds") or {}
        ab = r.get("absences") or {}
        venue = r.get("venue")
        refnat = r.get("referee_nationality")
        row = {
            "final_id": art, "date": r.get("date"), "season": r.get("season"), "competition": comp,
            "competition_type": comp_type(comp), "venue": venue, "city": r.get("city"),
            "venue_category": venue_cat(venue, r.get("city")),
            "team1": t1, "team2": t2, "score_90": r.get("score_90"), "score_aet": r.get("score_aet"),
            "shootout": r.get("shootout"), "winner": r.get("winner"), "decided_by": r.get("decided_by"),
            "core_verified": r.get("core_verified"), "core_sources": " | ".join(r.get("core_sources") or []),
            "referee": r.get("referee"), "referee_nationality": refnat, "referee_association": r.get("referee_association"),
            "referee_sources": " | ".join(r.get("referee_sources") or []),
            "assistants": r.get("assistants"), "fourth_official": r.get("fourth_official"), "var_officials": r.get("var_officials"),
            "var_in_use": r.get("var_in_use"), "glt_in_use": r.get("glt_in_use"),
            "officials_sources": " | ".join(r.get("officials_sources") or []),
            "manager1": r.get("manager1"), "manager2": r.get("manager2"),
            "goals": "; ".join(f"{g.get('player')} {g.get('minute')}' ({g.get('team')}{', ' + g['type'] if g.get('type') not in (None, 'open play', 'unknown') else ''})" for g in r.get("goals") or []),
            "cards": "; ".join(f"{c.get('card')} {c.get('player')} {c.get('minute')}' ({c.get('team')})" for c in r.get("cards") or []),
            "yellow1": sum(1 for c in r.get("cards") or [] if c.get("team") == t1 and c.get("card") in ("Y", "2Y")),
            "yellow2": sum(1 for c in r.get("cards") or [] if c.get("team") == t2 and c.get("card") in ("Y", "2Y")),
            "red1": sum(1 for c in r.get("cards") or [] if c.get("team") == t1 and c.get("card") in ("R", "2Y")),
            "red2": sum(1 for c in r.get("cards") or [] if c.get("team") == t2 and c.get("card") in ("R", "2Y")),
            "cards_complete": r.get("cards_complete"), "cards_sources": " | ".join(r.get("cards_sources") or []),
            "shots1": stats.get("shots1"), "shots2": stats.get("shots2"), "sot1": stats.get("sot1"), "sot2": stats.get("sot2"),
            "poss1": stats.get("poss1"), "poss2": stats.get("poss2"), "fouls1": stats.get("fouls1"), "fouls2": stats.get("fouls2"),
            "xg1": stats.get("xg1"), "xg2": stats.get("xg2"), "stats_source": stats.get("source"), "xg_source": stats.get("xg_source"),
            "stats_note": stats.get("note"),
            "odds_team1": o.get("team1"), "odds_draw": o.get("draw"), "odds_team2": o.get("team2"),
            "odds_team1_to_lift": o.get("team1_to_lift"), "odds_team2_to_lift": o.get("team2_to_lift"),
            "odds_bookmaker": o.get("bookmaker_or_source"), "odds_source": o.get("source"), "odds_note": o.get("note"),
            "implied_p_team1_lifts": round(p1, 3) if p1 is not None else None, "implied_p_method": pmethod,
            "clubelo_team1": e1, "clubelo_team2": e2, "elo_p_team1": round(pe, 3) if pe is not None else None,
            "elo_source": e.get("source"),
            "absences_team1": "; ".join(ab.get("team1") or []), "absences_team2": "; ".join(ab.get("team2") or []),
            "absences_sources": " | ".join(ab.get("sources") or []),
            "n_contested_decisions": len(r.get("contested_decisions") or []),
            "contested_search_done": r.get("contested_search_done"),
            "uncertain": " || ".join(r.get("uncertain") or []),
            "wikipedia_article": "https://en.wikipedia.org/wiki/" + art.replace(" ", "_"),
        }
        for k, t in (("1", t1), ("2", t2)):
            s = st.get(t, {})
            row[f"league{k}"] = s.get("league")
            row[f"league_pos{k}"] = s.get("pos")
            row[f"league_played{k}"] = s.get("played")
            row[f"league_pts{k}"] = s.get("pts")
            row[f"prev_season_pos{k}"] = s.get("prev_season_pos")
            row[f"prev_season_league{k}"] = s.get("prev_season_league")
        row["league_source"] = "football-data.co.uk results CSVs; table computed from all league matches before the final date (3 pts/win; GD, GF tie-breaks; known points deductions applied)"
        finals.append(row)

        for i, d in enumerate(r.get("contested_decisions") or []):
            decs.append({"final_id": art, "date": r.get("date"), "competition": comp, "referee": r.get("referee"),
                         "referee_nationality": refnat, "decision_no": i + 1, **{k: d.get(k) for k in
                         ["minute", "score_at_time", "type", "description", "favoured_team", "against_team", "assessment",
                          "assessed_by", "impact", "impact_reasoning"]},
                         "sources": " | ".join(d.get("sources") or []), "n_sources": len(d.get("sources") or []),
                         "var_in_use": r.get("var_in_use")})

        # club-perspective rows
        for side, club, opp in ((1, t1, t2), (2, t2, t1)):
            if club not in FIVE:
                continue
            pc = None
            if p1 is not None:
                pc = p1 if side == 1 else 1 - p1
            pce = None
            if pe is not None:
                pce = pe if side == 1 else 1 - pe
            won = r.get("winner") == club
            s90 = score_tuple(r.get("score_90"))
            res90 = None
            if s90:
                gf, ga = (s90 if side == 1 else s90[::-1])
                res90 = "W" if gf > ga else "D" if gf == ga else "L"
            cd = r.get("contested_decisions") or []
            fav = sum(1 for d in cd if d.get("favoured_team") == club)
            agn = sum(1 for d in cd if d.get("against_team") == club or (d.get("favoured_team") == opp))
            err = [d for d in cd if d.get("assessment") in ("officially acknowledged error", "expert consensus incorrect")]
            fav_err = sum(1 for d in err if d.get("favoured_team") == club)
            agn_err = sum(1 for d in err if d.get("favoured_team") == opp or d.get("against_team") == club)
            apps.append({
                "final_id": art, "date": r.get("date"), "club": club, "opponent": opp,
                "opponent_type": "English" if opp in ENGLISH_CLUBS else "foreign",
                "opponent_is_big5": opp in FIVE,
                "competition": comp, "competition_type": comp_type(comp), "venue_category": venue_cat(venue, r.get("city")),
                "referee": r.get("referee"), "referee_nationality": refnat,
                "referee_english": (refnat or "").strip().lower() in ("english", "england"),
                "var_in_use": r.get("var_in_use"), "era": era(r.get("date")),
                "won": won, "result_90": res90, "decided_by": r.get("decided_by"),
                "shootout": r.get("decided_by") == "penalties",
                "p_lift_odds": round(pc, 3) if pc is not None else None, "p_lift_elo": round(pce, 3) if pce is not None else None,
                "league_pos": (st.get(club) or {}).get("pos"), "opp_league_pos": (st.get(opp) or {}).get("pos"),
                "decisions_favouring": fav, "decisions_against": agn,
                "error_decisions_favouring": fav_err, "error_decisions_against": agn_err,
                "core_verified": r.get("core_verified"),
            })
    return pd.DataFrame(finals), pd.DataFrame(apps), pd.DataFrame(decs)


def era(date):
    if not date:
        return None
    y = int(date[:4])
    return "1996-2005" if y <= 2005 else "2006-2015" if y <= 2015 else "2016-2026"


if __name__ == "__main__":
    f, a, d = build()
    f.to_csv(W + "m_finals.csv", index=False)
    a.to_csv(W + "m_appearances.csv", index=False)
    d.to_csv(W + "m_decisions.csv", index=False)
    print(len(f), "finals;", len(a), "club appearances;", len(d), "contested decisions")

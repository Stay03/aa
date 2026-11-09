"""Statistical analysis of finals dataset. Small-sample methods throughout:
Wilson CIs, Fisher exact (2x2), permutation chi-square (r x c), exact Poisson-binomial
for observed-vs-expected wins, exact binomial (sign) tests; Holm and BH corrections."""
import json, os, itertools
import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.proportion import proportion_confint
from statsmodels.stats.multitest import multipletests

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/.."
W = ROOT + "/work/"
CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Manchester City", "Manchester United"]
RNG = np.random.default_rng(20261109)
TESTS = []  # (family, label, p)


def wilson(k, n):
    if n == 0:
        return (None, None)
    lo, hi = proportion_confint(k, n, method="wilson")
    return round(lo * 100, 1), round(hi * 100, 1)


def perm_chi2(tab, n_perm=20000):
    """Monte-Carlo permutation p-value for r x c independence (exact-test substitute)."""
    tab = np.asarray(tab)
    if tab.shape[0] < 2 or tab.shape[1] < 2:
        return None
    rows = np.repeat(np.arange(tab.shape[0]), tab.sum(1))
    cols = np.concatenate([np.repeat(np.arange(tab.shape[1]), tab[i]) for i in range(tab.shape[0])])

    def chi(r, c):
        t = np.zeros(tab.shape)
        np.add.at(t, (r, c), 1)
        e = t.sum(1, keepdims=True) * t.sum(0, keepdims=True) / t.sum()
        with np.errstate(divide="ignore", invalid="ignore"):
            return np.nansum(np.where(e > 0, (t - e) ** 2 / e, 0))
    obs = chi(rows, cols)
    cnt = 0
    for _ in range(n_perm):
        cnt += chi(rows, RNG.permutation(cols)) >= obs - 1e-12
    return (cnt + 1) / (n_perm + 1)


def group_test(df, factor, outcome="won"):
    d = df.dropna(subset=[factor])
    g = d.groupby(factor)[outcome].agg(["sum", "count"])
    if len(g) < 2:
        return g, None, None
    tab = np.array([[int(s), int(c - s)] for s, c in g.values])
    if tab.shape == (2, 2):
        p = stats.fisher_exact(tab)[1]
        test = "Fisher exact (two-sided)"
    else:
        p = perm_chi2(tab)
        test = "permutation chi-square (20,000 perms)"
    return g, p, test


def poisson_binomial_p(probs, observed):
    """Exact two-sided p-value for observed successes given independent probs."""
    dist = np.array([1.0])
    for p in probs:
        dist = np.convolve(dist, [1 - p, p])
    pobs = dist[observed]
    return float(min(1.0, dist[dist <= pobs + 1e-12].sum()))


def factor_tables(app):
    out = []
    factors = {
        "referee_english": "Referee English (vs foreign)",
        "referee_nationality": "Referee nationality",
        "competition_type": "Competition type",
        "venue_category": "Venue",
        "var_in_use": "VAR in use",
        "era": "Era (decade blocks)",
        "opponent_type": "Opponent English vs foreign",
    }
    for club in CLUBS + ["ALL FIVE (pooled)"]:
        d = app if club.startswith("ALL") else app[app.club == club]
        for f, label in factors.items():
            g, p, test = group_test(d, f)
            for lvl, (s, c) in g.iterrows():
                lo, hi = wilson(int(s), int(c))
                out.append({"club": club, "factor": label, "level": str(lvl), "finals": int(c), "wins": int(s),
                            "win_pct": round(100 * s / c, 1), "ci95_lo": lo, "ci95_hi": hi,
                            "test": test, "p_value": None if p is None else round(p, 4)})
            if p is not None and f != "referee_nationality":
                TESTS.append(("win rate by factor", f"{club}: {label}", p))
    return pd.DataFrame(out)


def expected_vs_actual(app, pcol):
    out = []
    d0 = app.dropna(subset=[pcol])
    groups = [("club", c) for c in CLUBS] + [("all", "ALL FIVE (pooled)")]
    for kind, c in groups:
        d = d0 if kind == "all" else d0[d0.club == c]
        for f in [None, "referee_english", "competition_type", "var_in_use", "opponent_type", "venue_category"]:
            subsets = [("all finals with estimate", d)] if f is None else [(f"{f}={v}", d[d[f] == v]) for v in sorted(d[f].dropna().unique(), key=str)]
            for lab, s in subsets:
                if len(s) == 0:
                    continue
                pr = s[pcol].astype(float).values
                o = int(s.won.sum())
                e = float(pr.sum())
                p = poisson_binomial_p(pr, o)
                out.append({"club": c, "subset": lab, "n": len(s), "wins_observed": o, "wins_expected": round(e, 2),
                            "obs_minus_exp": round(o - e, 2), "sd_under_null": round(float(np.sqrt((pr * (1 - pr)).sum())), 2),
                            "exact_p_two_sided": round(p, 4)})
                if f is None:
                    TESTS.append((f"observed vs expected ({pcol})", f"{c}: {lab}", p))
            # difference in (O-E) between two levels of a binary factor: permutation test
            if f in ("referee_english", "var_in_use", "opponent_type", "competition_type") and d[f].nunique() == 2:
                s = d.dropna(subset=[f])
                resid = (s.won.astype(float) - s[pcol].astype(float)).values
                lv = s[f].values
                a = sorted(set(lv), key=str)
                obs = resid[lv == a[0]].mean() - resid[lv == a[1]].mean()
                cnt = 0
                for _ in range(20000):
                    pl = RNG.permutation(lv)
                    cnt += abs(resid[pl == a[0]].mean() - resid[pl == a[1]].mean()) >= abs(obs) - 1e-12
                p = (cnt + 1) / 20001
                out.append({"club": c, "subset": f"DIFF in mean(O-E): {f}={a[0]} minus {f}={a[1]}", "n": len(s),
                            "wins_observed": None, "wins_expected": None, "obs_minus_exp": round(obs, 3),
                            "sd_under_null": None, "exact_p_two_sided": round(p, 4)})
                TESTS.append((f"O-E difference by factor ({pcol})", f"{c}: {f}", p))
    return pd.DataFrame(out)


def shootouts(app):
    out = []
    for c in CLUBS + ["ALL FIVE (pooled)"]:
        d = app if c.startswith("ALL") else app[app.club == c]
        so = d[d.decided_by == "penalties"]
        ip = d[d.decided_by != "penalties"]
        k, n = int(so.won.sum()), len(so)
        p = stats.binomtest(k, n, 0.5).pvalue if n else None
        k2, n2 = int(ip.won.sum()), len(ip)
        out.append({"club": c, "shootouts": n, "shootout_wins": k, "shootout_win_pct": round(100 * k / n, 1) if n else None,
                    "shootout_ci95": wilson(k, n), "binomial_p_vs_50pct": None if p is None else round(p, 4),
                    "decided_in_play": n2, "in_play_wins": k2, "in_play_win_pct": round(100 * k2 / n2, 1) if n2 else None,
                    "in_play_ci95": wilson(k2, n2)})
        if p is not None and not c.startswith("ALL"):
            TESTS.append(("shootout win rate vs 50%", c, p))
    return pd.DataFrame(out)


def decision_direction(dec, app):
    """Net direction of contested decisions, per club and per referee, all-disputed and error-only."""
    out = []
    dec = dec.copy()
    dec["is_error"] = dec.assessment.isin(["officially acknowledged error", "expert consensus incorrect"])
    for scope, dd in (("all disputed decisions", dec), ("assessed errors only", dec[dec.is_error]),
                      ("disputed excl. 'expert consensus correct'", dec[dec.assessment != "expert consensus correct"])):
        for c in CLUBS:
            fav = int((dd.favoured_team == c).sum())
            agn = int((dd.against_team == c).sum())
            n = fav + agn
            p = stats.binomtest(fav, n, 0.5).pvalue if n else None
            out.append({"scope": scope, "club": c, "favouring_club": fav, "against_club": agn, "net": fav - agn,
                        "sign_test_p": None if p is None else round(p, 4),
                        "finals_with_any": int(dd[(dd.favoured_team == c) | (dd.against_team == c)].final_id.nunique())})
            if p is not None and scope == "all disputed decisions":
                TESTS.append(("net direction of contested decisions (sign test)", f"{c}", p))
        # pooled: five clubs vs non-five opponents (decisions in finals vs outsiders only)
        five = set(CLUBS)
        m = dd[(dd.favoured_team.isin(five)) ^ (dd.against_team.isin(five))]
        fav = int(m.favoured_team.isin(five).sum()); agn = int(m.against_team.isin(five).sum())
        n = fav + agn
        p = stats.binomtest(fav, n, 0.5).pvalue if n else None
        out.append({"scope": scope, "club": "ALL FIVE vs non-five opponents", "favouring_club": fav, "against_club": agn,
                    "net": fav - agn, "sign_test_p": None if p is None else round(p, 4), "finals_with_any": int(m.final_id.nunique())})
        if p is not None and scope == "all disputed decisions":
            TESTS.append(("net direction of contested decisions (sign test)", "ALL FIVE vs non-five", p))
    by_club = pd.DataFrame(out)
    # per referee per club
    rows = []
    for (ref, nat), g in dec.groupby(["referee", "referee_nationality"], dropna=False):
        for c in CLUBS:
            fav = int((g.favoured_team == c).sum()); agn = int((g.against_team == c).sum())
            if fav + agn:
                rows.append({"referee": ref, "nationality": nat, "club": c, "favouring": fav, "against": agn, "net": fav - agn,
                             "of_which_errors_favouring": int(((g.favoured_team == c) & g.is_error).sum()),
                             "of_which_errors_against": int(((g.against_team == c) & g.is_error).sum()),
                             "finals": "; ".join(sorted(g.final_id.unique()))})
    by_ref = pd.DataFrame(rows)
    # by referee nationality group (English vs foreign) per club
    rows = []
    dec["ref_english"] = dec.referee_nationality.str.lower().isin(["english", "england"])
    for c in CLUBS + ["ALL FIVE"]:
        for e, g in dec.groupby("ref_english"):
            if c == "ALL FIVE":
                fav = int(g.favoured_team.isin(CLUBS).sum() - (g.favoured_team.isin(CLUBS) & g.against_team.isin(CLUBS)).sum())
                agn = int(g.against_team.isin(CLUBS).sum() - (g.favoured_team.isin(CLUBS) & g.against_team.isin(CLUBS)).sum())
            else:
                fav = int((g.favoured_team == c).sum()); agn = int((g.against_team == c).sum())
            rows.append({"club": c, "referee_english": bool(e), "favouring": fav, "against": agn, "net": fav - agn})
    by_nat = pd.DataFrame(rows)
    return by_club, by_ref, by_nat


def confounding(app, fin):
    tabs = {}
    f = fin.copy()
    f["referee_english"] = f.referee_nationality.str.lower().isin(["english", "england"])
    f["has_foreign_opponent"] = ~(f.team1.isin(ENG) & f.team2.isin(ENG))
    tabs["referee_english x competition_type"] = pd.crosstab(f.referee_english, f.competition_type)
    tabs["referee_english x venue_category"] = pd.crosstab(f.referee_english, f.venue_category)
    tabs["referee_english x has_foreign_opponent"] = pd.crosstab(f.referee_english, f.has_foreign_opponent)
    tabs["var_in_use x era"] = pd.crosstab(f.var_in_use.astype(str), f.date.str[:4].astype(int).apply(lambda y: "1996-2005" if y <= 2005 else "2006-2015" if y <= 2015 else "2016-2026"))
    tabs["competition x var_in_use"] = pd.crosstab(f.competition, f.var_in_use.astype(str))
    return tabs


ENG = None

if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from merge import build, ENGLISH_CLUBS
    ENG = ENGLISH_CLUBS
    fin, app, dec = build()
    app["won"] = app.won.astype(bool)
    res = {}
    res["factor_tables"] = factor_tables(app)
    pcol = "p_lift_odds"
    app["p_best"] = app.p_lift_odds.where(app.p_lift_odds.notna(), app.p_lift_elo)
    app["p_source"] = np.where(app.p_lift_odds.notna(), "odds", np.where(app.p_lift_elo.notna(), "Elo", None))
    res["expected_vs_actual_odds"] = expected_vs_actual(app, "p_lift_odds")
    res["expected_vs_actual_ownelo"] = expected_vs_actual(app, "p_lift_ownelo")
    if app.p_lift_elo.notna().any():
        res["expected_vs_actual_elo"] = expected_vs_actual(app, "p_lift_elo")
    res["shootouts"] = shootouts(app)
    res["decisions_by_club"], res["decisions_by_referee"], res["decisions_by_ref_nationality"] = decision_direction(dec, app)
    tabs = confounding(app, fin)
    # multiple-comparison correction
    t = pd.DataFrame(TESTS, columns=["family", "test", "p_raw"])
    t["p_holm_all"] = multipletests(t.p_raw, method="holm")[1]
    t["q_bh_all"] = multipletests(t.p_raw, method="fdr_bh")[1]
    t = t.round(4).sort_values("p_raw")
    res["multiple_testing"] = t
    os.makedirs(W + "analysis", exist_ok=True)
    for k, v in res.items():
        v.to_csv(W + f"analysis/{k}.csv", index=False)
    with open(W + "analysis/confounding.txt", "w") as fh:
        for k, v in tabs.items():
            fh.write(f"== {k}\n{v.to_string()}\n\n")
    app.to_csv(W + "analysis/appearances_used.csv", index=False)
    print("tests run:", len(t), "| min raw p:", t.p_raw.min() if len(t) else None,
          "| min Holm p:", t.p_holm_all.min() if len(t) else None)
    print(t.head(15).to_string())

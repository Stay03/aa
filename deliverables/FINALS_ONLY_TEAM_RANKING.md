# Cup finals only: English teams in finals refereed by English officials

**Scope.** 83 finals, 1996–2026: FA Cup, League Cup and Charity/Community Shield. No league data is used.

**Tests.** Each team is tested 8 ways:

| Test | What it compares |
|---|---|
| All disputed decisions | Calls for vs against the team |
| Match-level | Finals where disputes netted for vs against the team |
| High-impact disputes | Disputes rated "likely" to have changed the result, for vs against |
| Judged errors | Decisions experts or officials judged wrong, for vs against |
| Penalty calls | Disputed penalty calls, for vs against |
| Red cards | Red cards received vs opponents' |
| Yellow cards | Yellow cards received vs opponents' (finals with a complete card list only) |
| Results vs strength | Wins vs pre-match strength (own Elo) |

**Correction.** p-values come from exact tests. q corrects for running all 113 tests (Benjamini–Hochberg). **No q is below 0.05.** The smallest is 1.0, so nothing is significant after correction.

| Rank | Team | Finals (won) | Strongest test | p | Disputed for–against | High-impact for–against | Judged errors for–against | Penalty calls for–against | Reds received–opp | Wins / expected |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Crystal Palace | 3 (2) | yellow cards | 0.02 | 1–3 | 1–1 | 1–1 | 0–2 | 0–1 | 2 / 0.8 |
| 2 | Arsenal | 25 (18) | results vs strength | 0.05 | 19–11 | 6–3 | 1–0 | 4–2 | 4–4 | **18 / 13.2** |
| 3 | Aston Villa | 4 (0) | yellow cards | 0.11 | 0–2 | 0–1 | 0–0 | 0–0 | 0–0 | 0 / 0.9 |
| 4 | **Chelsea** | 32 (14) | penalty calls | 0.13 | **16–23** | 5–5 | 0–1 | **1–6** | 5–3 | 14 / 16.1 |
| 5 | Manchester City | 23 (14) | high-impact | 0.13 | 12–14 | **1–6** | 0–2 | 4–7 | 1–1 | 14 / 16.1 |
| 6 | Tottenham | 4 (1) | yellow cards | 0.23 | 4–2 | 1–0 | 0–0 | 2–0 | 0–0 | 1 / 0.9 |
| 7 | Manchester United | 29 (18) | judged errors | 0.25 | 16–16 | 6–4 | **3–0** | 5–4 | 2–2 | 18 / 17.6 |
| 8 | Everton | 1 (0) | disputed | 0.25 | 3–0 | 0–0 | 0–0 | 1–0 | 0–0 | 0 / 0.3 |
| 9 | Liverpool | 19 (11) | match-level | 0.29 | 11–7 | 6–4 | 1–0 | 6–2 | 0–0 | 11 / 10.8 |
| 10+ | Birmingham, Wigan, Southampton, Hull, Stoke, Middlesbrough, Leicester, Portsmouth, Newcastle, Cardiff, Millwall, Sunderland, Watford, West Ham | 1–5 each | — | ≥ 0.37 | | | | | | |

The other p-values for every team are in `csv/finals_only_team_ranking.csv`.

## What it shows

### Who is "against" most

- **Disputed decisions overall:** Chelsea has the largest count against (23) and the most negative balance (16–23). Not significant: p = 0.34, and at match level 8 finals net for vs 12 net against, p = 0.50.
- **High-impact disputes:** Manchester City is the most one-sided, 1–6 (p = 0.13).
- **Judged errors:** City has the most against (2). Chelsea has 1, Eboué's unpunished punch in the 2007 League Cup final, which Chelsea won.

### Chelsea's penalty calls (1 for, 6 against, p = 0.13)

| Final | Referee | Call | Favoured | Assessment | Final result |
|---|---|---|---|---|---|
| 2008 League Cup | Mark Halsey | Penalty given to Tottenham | Tottenham | debatable, single source, impact "likely" | Chelsea lost |
| 2009 FA Cup | Howard Webb | Lampard claim (Pienaar challenge) not given; Lampard booked for diving | Everton | debatable, no impact | Chelsea won |
| 2017 Shield | Bobby Madley | Willian penalty claim; Willian booked for diving | Arsenal | debatable | Chelsea lost on penalties |
| 2018 FA Cup | Michael Oliver | Young handball not given | Man Utd | experts: **correct** | Chelsea won |
| 2026 FA Cup | Darren England | Pedro claim not given | Man City | experts: **correct** | Chelsea lost |
| 2026 FA Cup | Darren England | Hato claim not given | Man City | debatable | Chelsea lost |

The one call in Chelsea's favour: a Gerrard claim turned down in the 2005 League Cup final (Steve Bennett).

**Verdict:** two of the six were judged correct by experts and none was judged wrong. Chelsea won two of those finals anyway. Only the 2008 Tottenham penalty is rated as likely to have changed a result, and it rests on a single source.

### Results against pre-match strength

- **Arsenal is the clear over-performer:** 18 wins against 13.2 expected (p = 0.053).
- **Chelsea and City each won about 2 fewer than expected:** 14 against 16.1. Well within chance (p = 0.45 and p = 0.34).

### Smaller clubs

Palace's top position comes from opponents being booked more than Palace (15 v 4). That points the other way from bias against them. Every smaller club has 1–5 finals, too few to test.

## Conclusion (finals only)

In cup finals with English referees, **Chelsea is the English team with the most disputed decisions and penalty calls against it, and City has the most high-impact calls and judged errors against it.** None of these imbalances is statistically significant, even before correction for running 113 tests. The disputed calls against Chelsea are overwhelmingly "debatable" (often with one source) or judged correct; only one was ever judged an error, in a final Chelsea won.

**On the finals evidence, there is no demonstrable bias by English referees against any English team.** The samples (19–32 finals per big club) can only detect very large effects. A modest bias could exist undetected, but nothing in the finals data shows one.

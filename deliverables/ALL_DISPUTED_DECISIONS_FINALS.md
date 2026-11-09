# Cup finals with English referees: every disputed decision and every cancelled goal

**Scope.** All 83 finals refereed by English officials, 1996–2026: FA Cup, League Cup and Charity/Community Shield.

**What counts:**
- Every goal cancelled for any reason, whether or not anyone disputed it: offside flag, foul, handball, whistle before the ball went in, goal-line call, ball out of play, VAR.
- Every decision a reputable match report or minute-by-minute described as disputed, controversial, harsh, lucky or complained about: penalty claims, fouls, offsides, cards.

**What is deliberately left out.** No verdicts from experts, PGMOL, pundits or governing bodies on whether a decision was right. Every disputed call counts equally.

**Sources.** Combined from:
- the census of all 83 finals, which read a full report or minute-by-minute for 71 of them;
- the earlier contested-decision research.

Duplicates were removed. That leaves 177 disputed decisions or cancelled goals, plus 22 undisputed penalties and red cards.

## The five big clubs

| | Chelsea | Man Utd | Man City | Liverpool | Arsenal |
|---|---|---|---|---|---|
| Finals (won) | 32 (14) | 29 (18) | 23 (14) | 19 (11) | 25 (18) |
| **All disputed decisions: for – against** | **35 – 45** | 27 – 31 | 19 – 22 | 25 – 19 | **33 – 18** |
| Net | **−10** | −4 | −3 | +6 | **+15** |
| Against per final | **1.41** | 1.07 | 0.96 | 1.00 | 0.72 |
| p (sign test) | 0.31 | 0.69 | 0.76 | 0.45 | 0.049 |
| Finals where disputes netted for / against | 9 / 13 | 10 / 11 | 6 / 8 | 8 / 5 | 12 / 4 |
| **Cancelled goals: opponents' (in the club's favour) – the club's own** | 9 – **8** | 3 – 4 | 3 – 5 | 6 – 7 | 4 – 2 |
| Other goal/offside disputes: for – against | 4 – 5 | 2 – 3 | 5 – 1 | 2 – 3 | 6 – 4 |
| **Penalty disputes: for – against** | **4 – 10** | 10 – 12 | 6 – 7 | 8 – 6 | 8 – 3 |
| Card disputes: for – against | 15 – 13 | 10 – 8 | 4 – 7 | 6 – 1 | 8 – 7 |
| Foul/other disputes: for – against | 3 – 9 | 2 – 4 | 1 – 2 | 3 – 2 | 7 – 2 |
| Penalties awarded: for – against | 2 – 3 | 2 – 4 | 1 – 3 | 2 – 2 | 2 – 0 |
| Red cards: received – opponents' | 5 – 3 | 2 – 2 | 1 – 1 | 0 – 0 | 4 – 4 |

**Multiple comparisons.** Correcting for all the tests run (Benjamini–Hochberg), every q is 1.0. Nothing is significant after correction.

The table for all 23 English clubs is in `csv/all_disputed_ranking_english_ref_finals.csv`. Every event, with its description and sources, is in `csv/all_disputed_events_english_ref_finals.csv`.

## What it shows

**1. Chelsea has the most disputed decisions against them** of any English club in these finals: 45 against and 35 for, net −10, which is 1.41 against per final.
- **Penalty disputes are the most one-sided category:** 10 against and 4 for (p = 0.18).
- **Fouls/other:** 9 against and 3 for.
- **But the overall imbalance is not statistically significant:** p = 0.31, and at match level 9 finals netted for Chelsea against 13 netted against (p = 0.52).

**2. Cancelled goals do not run against Chelsea.**
- 8 Chelsea goals were cancelled, the most of any team.
- 9 opponents' goals were cancelled in Chelsea's favour: Giggs in 2007, Carroll in 2012, Alexis Sánchez for United in 2018, Agüero in the 2019 League Cup, Pépé in 2020, Matip in 2022, Van Dijk in 2024, Haaland in 2026, and Festa in 1997.
- Three of Chelsea's eight came in a single match, the 2022 League Cup final (Havertz, Lukaku, and Havertz/Werner).

**3. Arsenal is the clear outlier in the other direction:** 33 for and 18 against, net +15, p = 0.049 before correction (q = 1.0 after). It is the only club with an uncorrected p below 0.05.

**4. Man United, Man City and Liverpool are roughly balanced.**

## Caveats that matter for a bias claim

- **A decision only counts if someone wrote about it.** 68% of disputed entries rest on a single source, and about 30% come from ESPN's live text commentary.
- **The losing side's complaints get more coverage.** Chelsea lost 18 of these 32 finals. Losing teams tend to produce more reported grievances whatever the refereeing was.
- **Each club's opponents differ.** Chelsea met another of the big five in 24 of their 32 English-refereed finals, usually in tight, high-stakes games where more decisions get scrutinised.
- **Coverage is uneven.** 12 of the 83 finals have no full report or minute-by-minute, mostly before 2000, and those are probably under-counted.

## Bottom line

Counting **every disputed decision and every cancelled goal, with no official or expert filtering**:
- **Chelsea has the most decisions against them.** The gap is driven by penalty claims and foul decisions, not cancelled goals, where Chelsea come out level (9 for, 8 against).
- **Arsenal has the most in their favour.**

**Neither imbalance is statistically significant once multiple tests are accounted for.** The Chelsea figure alone (45 v 35) is the kind of gap that arises by chance about one time in three.

**The data are consistent with no systematic bias, but they cannot rule it out.** With 30–80 disputed decisions per club, only a lopsided pattern of roughly 2:1 or more would be detectable.

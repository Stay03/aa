# Is there English-referee bias against an English team?

**Question.** Which English team has had the most refereeing decisions go against it, and does the evidence support bias by English referees?

**Data.**
- Finals in this dataset with English referees: 83 finals, 22 English teams.
- Premier League 2000-01 to 2026-27 (in progress): 19,954 team-matches, with pre-match bookmaker odds, referee, cards and fouls, from football-data.co.uk.

**Script:** `scripts/pl_bias.py`. Output CSVs are in `deliverables/csv/`.

## Step 1. Finals refereed by English officials: who had the most decisions against?

| Team | Finals | Won | Disputed against | Disputed for | Net | Debatable against | "Likely" impact against | Judged errors against | Red cards received / opponents' |
|---|---|---|---|---|---|---|---|---|---|
| **Chelsea** | 32 | 14 | **23** | 16 | **−7** | 18 | 5 | 1 | 5 / 3 |
| Man Utd | 29 | 18 | 16 | 16 | 0 | 15 | 4 | 0 (3 *for*) | 2 / 2 |
| Man City | 23 | 14 | 14 | 12 | −2 | 11 | **6** | **2** | 1 / 1 |
| Arsenal | 25 | 18 | 11 | 19 | +8 | 9 | 3 | 0 (1 *for*) | 4 / 4 |
| Liverpool | 19 | 11 | 7 | 11 | +4 | 4 | 4 | 0 (1 *for*) | 0 / 0 |

Smaller clubs played 1–5 finals each. Several have 2–3 decisions against and none for, which is too few to assess.

**Chelsea has the most decisions against.** But:
- **The 23-to-16 split is not significant** (sign test p = 0.34). Chelsea also played the most finals: 0.72 decisions against per final, against 0.55–0.61 for United and City.
- **Only 1 of the 23 was judged an actual error** by an expert or official. That was Eboué's unpunished punch in the 2007 League Cup final, a final Chelsea won. Four of the 23 were judged *correct*, and 18 are "genuinely debatable", most with a single source.
- **Manchester City has the most expert-judged errors against** (2) and the most "likely impact" calls against (6).

On finals alone, no English team's balance of decisions stands out beyond chance.

## Step 2. The Premier League test

Finals are too few to separate bias from luck, so I ran the same question on the Premier League. That gives about 1,000 matches per big club, all refereed by English officials (plus Jarred Gillett).

### 2a. Results against bookmaker expectation

The test: does any team's points total depend on *which* referee it gets? Bookmaker odds give the expected points for each match. For every team, I compared each referee with 10 or more of its games against those expected points. That is 36 teams and 33–35 referees per big club.

| Team | PL matches | Points | Expected | Difference | Do some referees cost it points? (p) |
|---|---|---|---|---|---|
| Chelsea | 998 | 1909 | 1912.2 | **−3.2** | p = 0.61 |
| Arsenal | 998 | 1962 | 1887.2 | +74.8 | p = 0.80 |
| Liverpool | 998 | 1902 | 1886.0 | +16.0 | p = 0.61 |
| Man City | 960 | 1790 | 1789.1 | +0.9 | p = 0.12 |
| Man Utd | 998 | 1954 | 1885.4 | +68.6 | p = 0.36 |

- **Chelsea's overall points are almost exactly what the odds predicted:** 3 points short in 998 games.
- **No team, big or small, shows significant variation between referees.** The smallest value after correcting for 36 teams is q = 0.90.
- **No pairing stands out either.** Across all 172 pairings of a big-five club with a referee (10+ games each), the smallest corrected q is 0.82.
- **Chelsea's worst and best pairings:**
  - Worst: Andy Madley (−8.6 points in 14 games) and Stuart Attwell (−11.8 in 25), both z ≈ −1.9.
  - Best: Alan Wiley (+13.2 in 25, z = 2.2).

  Spread like this is what chance alone produces across 35 referees.

### 2b. Cards per foul

The test: do English referees book a team more for the same number of fouls than they book its opponents? Bookings per 100 fouls:

| Team | Team | Its opponents | Ratio | q |
|---|---|---|---|---|
| Chelsea | 15.4 | 15.3 | **1.01** | 0.88 |
| Man Utd | 14.7 | 15.2 | 0.97 | 0.59 |
| Man City | 14.2 | 15.9 | 0.89 | 0.008 |
| Arsenal | 14.3 | 16.0 | 0.89 | 0.006 |
| Liverpool | 12.6 | 15.4 | **0.82** | <0.001 |
| Burnley / Bolton | 16.2 / 13.5 | 13.3 / 11.1 | 1.21 | <0.01 |

- **Chelsea's ratio is neutral.** They are booked for fouls at the same rate as their opponents.
- **The significant effects run the other way:** Liverpool, Arsenal and City are booked *less* per foul than their opponents. Physical sides such as Burnley, Bolton and Stoke are booked more.

  This fits differences in the *kind* of foul, such as tactical fouls by sides defending deep, at least as well as it fits referee leniency towards big clubs. Foul counts can't tell the two apart.

**The only referee–club pairing whose booking pattern holds up after correction** is Anthony Taylor and Manchester United:
- United receive about 0.8 more yellow cards per game than their opponents, compared with their usual gap (q = 0.009, 52 games).
- Yet United took 11.6 *more* points than the odds expected in his games.

So it does not show up as a results disadvantage.

## Conclusion

1. **Chelsea is the English team with the most disputed decisions against it** in finals with English referees: 23 against, 16 for. That gap is not significant (p = 0.34). Only one of the 23 was ever judged wrong by an expert or official, and Chelsea won that final.
2. **The large Premier League sample shows no sign of English referees disadvantaging Chelsea.** Results are exactly in line with bookmaker expectation, no referee–Chelsea pairing is unusual once the number of comparisons is accounted for, and Chelsea are booked at the same rate per foul as their opponents.
3. **None of the five clubs shows a referee-driven results bias.** The only robust card patterns are big clubs (especially Liverpool) being booked *less* per foul than opponents. That favours them rather than counting against an English team, and it may reflect playing style, not refereeing.

**Overall, the data do not support the claim of English-referee bias against an English team.** They cannot rule out small effects on individual decisions that never appear in results or cards. Those would need decision-level review data, such as PGMOL's Key Match Incidents panel since 2019-20, which isn't available in bulk.

## Limitations

- **Bookmaker odds already price in referee appointments.** Referees are announced before kick-off, so any widely known referee effect would be absorbed into the expected points. In practice, the referee is usually announced only 2–5 days ahead and is rarely priced in heavily.
- **Fouls are what referees call,** so referee bias could affect the foul counts themselves, not just the bookings.
- **Referee names in the source are abbreviated** (initial and surname). Two referees with the same initial and surname would be merged.
- **No penalty or VAR decision data** exists in the bulk Premier League source, so decision-level bias can only be tested in the finals data, and that sample is small.

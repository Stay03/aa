# Findings summary

**Data:** 128 finals and 179 club appearances, 1996 to November 2026. **Tests run:** 121, corrected together for multiple comparisons.

## Headline

**No pattern survives correction for multiple comparisons.** The smallest Holm-adjusted p-value across all 121 tests is 0.998. The smallest false-discovery-rate (Benjamini–Hochberg) value is 0.56.

A handful of comparisons reach nominal significance (p < 0.05). Each one rests on a very small sample, and the factors involved are tangled together in ways that make referee effects impossible to separate (§2). The data are consistent with **no referee-related effect** on these clubs' results in finals. They are also too thin to rule out modest effects.

## 1. Results by factor (win rate, Wilson 95% confidence interval)

| | Arsenal | Chelsea | Liverpool | Man City | Man Utd | All five |
|---|---|---|---|---|---|---|
| Finals (wins) | 29 (18) | 47 (24) | 32 (18) | 28 (18) | 43 (24) | 179 (102) |
| English referee | 18/25 (72%) | 14/32 (44%) | 11/19 (58%) | 14/23 (61%) | 18/29 (62%) | 75/128 (59%, 50–67) |
| Foreign referee | **0/4** (0%, 0–49) | 10/15 (67%) | 7/13 (54%) | 4/5 (80%) | 6/14 (43%) | 27/51 (53%, 40–66) |
| Fisher p (raw) | **0.014** | 0.21 | 1.00 | 0.63 | 0.33 | 0.51 |

**Arsenal.** The one nominally significant referee-nationality result is Arsenal's 0 wins from 4 finals with foreign referees. Those four are:
- 2000 UEFA Cup final: lost on penalties.
- 2006 Champions League final: lost 1–2.
- 2019 Europa League final: lost 1–4 to Chelsea.
- 2026 Champions League final: lost on penalties. Odds made Arsenal underdogs, with a 42.5% implied chance of lifting the trophy.

All four were also European finals at neutral venues abroad. So the same 0/4 appears identically as a "competition type" effect and a "venue" effect. Two of the four were shootouts. After correction for multiple comparisons, p = 1.0 (Holm) and q = 0.56 (false-discovery rate). **The sample is too small to support a conclusion**, and referees cannot be separated from competition, venue or opponent.

**Other factors** (competition type, venue, VAR era, decade, English versus foreign opponent):
- No significant differences for any club or for the five pooled (all raw p > 0.08).
- Largest raw differences:
  - Manchester United: 3/10 in European finals against 19/31 domestic (p = 0.09).
  - Chelsea: 8/10 in 1996–2005, falling to 7/18 in 2016–26 (p = 0.12).

## 2. Confounding: what the referee comparisons can and cannot show

Referee nationality is almost completely determined by competition and opponent:

| | Domestic | European/World | Foreign opponent | Played in England |
|---|---|---|---|---|
| English referee (83 finals) | 83 | 0 | 0 | 82 |
| Non-English referee (45 finals) | 2* | 43 | 37 | 3** |

\* Dermot Gallagher (Irish-born, FA list, 1996) and Jarred Gillett (Australian, English list, 2024 Shield).
\*\* Those two plus the 2011 Champions League final at Wembley.

Consequences:
- **Referee nationality cannot be separated from these factors.** A comparison of "English vs foreign referee" is in effect a comparison of domestic against European/world finals, English against mostly foreign opponents, and Wembley/Cardiff against venues abroad. Neither these data nor any larger sample of real finals could separate them.
- **VAR is tied to time.** VAR was used only from 2018, so a VAR comparison is also a comparison of eras. The squads, managers and relative strength of all five clubs changed over that time.
- **Competitions differ in format.** Community Shields and Super Cups have different stakes and no extra time in the Shield, so their mix also differs between groups.

## 3. Results against pre-match expectation (team strength controlled)

**Club Elo could not be obtained.** Two substitutes were used:

- **Own Elo**, from English league results only, covering 142 appearances in the 91 all-English finals:
  - All five: 82 wins observed, 80.9 expected (exact p = 0.86).
  - By club, observed minus expected: Arsenal +4.4 (p = 0.09), Manchester United +0.7, Liverpool +0.3, Chelsea −1.7, Manchester City −2.6. None is significant.
  - It cannot test English against foreign referees: only 14 of these appearances had a non-English referee.
- **Bookmaker odds**, available for only 40 appearances:
  - All five: 20 wins observed, 23.4 expected (p = 0.29).
  - The gap between finals with English and foreign referees is −0.03 wins per final (permutation p = 0.88).
  - The odds were a poor predictor in this sample: a Brier score of 0.27, worse than a coin flip (0.25). The own-Elo score was 0.22. So the odds-based comparisons carry little information.

**Conclusion:** once team strength is accounted for, no club does clearly better or worse than expected, and nothing differs by referee group. Strength data for European and world finals is the weakest part of the dataset.

## 4. Penalty shootouts against matches decided in play

| | Shootouts W/N | Binomial p vs 50% | Decided in play W/N |
|---|---|---|---|
| Arsenal | 4/7 | 1.00 | 14/22 (64%) |
| Chelsea | **3/12** (25%) | 0.15 | 21/35 (60%) |
| Liverpool | 7/11 | 0.55 | 11/21 (52%) |
| Man City | 5/6 | 0.22 | 13/22 (59%) |
| Man Utd | 6/10 | 0.75 | 18/33 (55%) |
| All five | 25/46 (54%) | 0.66 | 77/133 (58%) |

- 46 of 179 appearances (26%) went to penalties, mostly Shields and Super Cups.
- Chelsea's shootout record (3/12) is the most extreme, but it is not significant.
- Shootout outcomes do not depend on refereeing in the way decisions in play do. Shootouts are kept separate in the `A_Shootouts` tab.

## 5. Contested refereeing decisions

**124 decisions were documented in 74 of the 128 finals.**

**Quality of evidence:**
- 104 (84%) are "genuinely debatable", meaning no former referee or governing body gave a verdict.
- 13 were judged correct by experts.
- Only 7 were judged errors:
  - 3 officially acknowledged.
  - 4 by expert consensus.
- 47 rest on a single reputable source.

**Net direction for each club** (favouring minus against, all disputed decisions):

| Club | For | Against | Net | Sign test p |
|---|---|---|---|---|
| Arsenal | 24 | 15 | +9 | 0.20 |
| Chelsea | 19 | 26 | −7 | 0.37 |
| Liverpool | 15 | 20 | −5 | 0.50 |
| Man City | 12 | 15 | −3 | 0.70 |
| Man Utd | 18 | 19 | −1 | 1.00 |
| All five vs non-five opponents | 29 | 36 | −7 | 0.46 |

**Assessed errors only.** Seven decisions were judged errors.

Five came in finals against outside opponents: 4 in the five clubs' favour and 1 against.
- 2016 FA Cup, Manchester United: Clattenburg later admitted his error.
- 2017 League Cup, Manchester United: two decisions Dermot Gallagher judged wrong.
- 2019 Club World Cup, Liverpool: an on-field penalty for Liverpool, overturned by VAR, so no impact.
- 2025 FA Cup: the one error against a five club. Dean Henderson was not sent off, against Manchester City.

Two came in finals between two of the five clubs:
- 2016 League Cup: a penalty Liverpool were denied against Manchester City, judged wrong by Gallagher. Liverpool lost the shootout.
- 2007 League Cup: Eboué's punch on Bridge went unpunished and the FA acted afterwards. The error favoured Arsenal, against Chelsea.

Most decisions have no expert review at all, so these counts are not meaningful.

**Split by referee nationality:**
- Under foreign referees, decisions involving Liverpool went 4 for and 13 against (decision-level p = 0.049). Two finals produce most of this:
  - 2005 Club World Championship final (Benito Archundia): 5 against.
  - 2016 Europa League final (Jonas Eriksson): 3 against.
- Counting each final once, it is 3 finals net for and 5 net against (p = 0.73). After correction for multiple comparisons, p = 1.0.
- All five clubs together, under foreign referees: 12 for, 22 against (p = 0.12).
- Under English referees: 17 for, 14 against (p = 0.72).

**Possible reporting bias.** Nearly all sources are English-language. They are more likely to document and dispute decisions that go against English clubs, especially against foreign opponents. This bias alone could produce the slight negative tilt under foreign referees.

**Per referee.** No referee has more than 5 contested decisions involving one club. Both extremes come from very few finals:
- Benito Archundia with Liverpool: −5, from one final.
- Steve Bennett with Manchester United: −5, from two finals (2003 Shield and 2007 FA Cup).

These cells are far too small for inference.

## 6. Referees' wider records with the clubs

**English referees' Premier League records** from 2000-01, for those who refereed these finals. For every club, the total wins under these referees is within about 1–1.5 percentage points of the club's same-season baseline:

| Club | League games | Wins, actual | Wins, expected |
|---|---|---|---|
| Arsenal | 885 | 502 | 511 |
| Chelsea | 895 | 492 | 506 |
| Liverpool | 895 | 495 | 499 |
| Man City | 841 | 461 | 472 |
| Man Utd | 905 | 524 | 529 |

All five are slightly below their baseline. That fits referees good enough for finals being given the hardest league games, rather than any bias. It is a description, not a test: referees are not assigned at random.

**Foreign referees:** complete records exist only with Liverpool, from LFChistory.net. Other clubs have partial lists (see the `Referees` tab).

## 7. How strong is the evidence?

- **Overall: weak, and it points to no effect.**
  - Each club has 28–47 finals; split into subgroups, most cells hold fewer than 15.
  - At these sizes, a test can reliably detect only very large differences (roughly 30–40 percentage points).
- **The two strongest nominal signals do not survive correction:**
  - Arsenal 0/4 with foreign referees: confounded with competition and venue.
  - Liverpool's contested decisions under foreign referees: concentrated in two matches, and sensitive to reporting bias.

## 8. Limitations

1. **No Club Elo.** The ClubElo server was down. Odds cover about 22% of appearances, and the own-Elo substitute covers only all-English finals.
2. **Contested decisions depend on media coverage.** Disputes are only "documented" if someone wrote about them. Coverage is far richer after 2010, in English-language media, and for domestic finals with Sky/ESPN review segments. Expert verdicts exist for very few decisions.
3. **Several archives were unreachable:** old BBC, Guardian and Telegraph pages, and the Wayback Machine. So 1996–2010 data on cards, assistant referees, stats and absences is incomplete.
4. **Small numbers and many comparisons.** 121 tests at α = 0.05 would produce about 6 false positives by chance; the dataset shows 5 nominal p < 0.05 results.
5. **Non-independence:**
   - A final between two of the five appears twice, once as a win and once as a loss.
   - Decisions within one final are clustered (handled by the match-level sign tests).
6. **Strength measures are limited to the match:** league position and own Elo ignore cup-specific factors such as rotation, injuries (partly recorded in the absences columns) and manager changes.

# Chelsea, Arsenal and Manchester United: finals under English and non-English referees

**Source:** `finals_dataset.xlsx`. Own Elo is an expected-wins estimate computed from English league results. It is available only for finals between English clubs.

## Summary table

| Club | Referee | Played | W–L | Win % | Excluding shootouts | Shootouts | Disputed for / against | Of which "likely impact" for / against | Judged errors for / against | Own Elo: won / expected |
|---|---|---|---|---|---|---|---|---|---|---|
| Arsenal | English | 25 | 18–7 | 72% | 14/20 | 4/5 | 19 / 11 | 6 / 3 | 1 / 0 | 18 / 13.2 (p = 0.05) |
| Arsenal | Non-English | 4 | 0–4 | 0% | 0/2 | 0/2 | 5 / 4 | 0 / 3 | 0 / 0 | n/a |
| Chelsea | English | 32 | 14–18 | 44% | 13/25 | 1/7 | 16 / 23 | 5 / 5 | 0 / 1 | 14 / 16.1 (p = 0.45) |
| Chelsea | Non-English | 15 | 10–5 | 67% | 8/10 | 2/5 | 3 / 3 | 1 / 1 | 0 / 0 | n/a |
| Man Utd | English | 29 | 18–11 | 62% | 13/22 | 5/7 | 16 / 16 | 6 / 4 | 3 / 0 | 18 / 17.6 (p = 1.0) |
| Man Utd | Non-English | 14 | 6–8 | 43% | 5/11 | 1/3 | 2 / 3 | 1 / 1 | 0 / 0 | n/a |

Fisher exact test, English against non-English win rate:
- Arsenal: p = 0.014
- Chelsea: p = 0.21
- Man Utd: p = 0.33

None survives correction for multiple comparisons; with Holm's adjustment all three are p = 1.0.

## What stands out

### 1. Arsenal and Chelsea are mirror images

| Club | Under English referees | Under non-English referees |
|---|---|---|
| Arsenal | Best record of the three (72%); 4.8 wins above own-Elo expectation (p = 0.05) | 0 from 4 |
| Chelsea | Worst record (44%) | Best record (67%) |

United fall in between, and above expectation under neither group.

The reason is which finals sit behind each referee group:
- **Arsenal:**
  - Their only finals with non-English referees were four European finals abroad: 2000, 2006, 2019 and 2026.
  - Odds were found only for 2026, where they made Arsenal underdogs (42.5% implied chance of lifting the trophy).
  - Two were lost on penalties.
  - One was the 1–4 Europa League defeat to Chelsea.
- **Chelsea:**
  - Most of their non-English-referee finals were against foreign clubs, and they won 8 of those 11. Against English sides under non-English referees they won 2 of 4.
  - Their English-referee finals are dominated by other big English clubs: 24 of 32, of which they won 8.

### 2. Arsenal v Chelsea head-to-head under English referees: Arsenal 5, Chelsea 2

| Final | Referee | Winner | Disputed decisions (who they favoured) |
|---|---|---|---|
| 2002 FA Cup | Mike Riley | Arsenal | 1 for Arsenal (offside, debatable) |
| 2005 Shield | Howard Webb | Chelsea | 1 for Chelsea |
| 2007 League Cup | Howard Webb | Chelsea | 2 for Chelsea, 1 for Arsenal (Eboué's punch went unpunished; the FA acted later) |
| 2015 Shield | Anthony Taylor | Arsenal | none |
| 2017 FA Cup | Anthony Taylor | Arsenal | 1 for Arsenal: Sánchez's goal allowed, debatable, single source |
| 2017 Shield | Bobby Madley | Arsenal (penalties) | 2 for Arsenal: Willian booked for a dive, Pedro sent off |
| 2020 FA Cup | Anthony Taylor | Arsenal | 1 for Arsenal: Kovačić's second yellow, debatable, single source |
| 2019 Europa League (Rocchi, Italy) | | Chelsea | 1 for Chelsea, judged correct |

- **Disputed decisions went Arsenal's way 6–3** in their English-referee finals against Chelsea.
- **Anthony Taylor has refereed three Arsenal–Chelsea finals,** and Arsenal won all three. Two of the disputed calls in them (2017, 2020) went to Arsenal. Both are "genuinely debatable", each backed by a single source, and neither has an expert verdict.
- **Taylor's Premier League record doesn't show a lean either way.** Arsenal win 50% of league games he referees, against 57% expected from the same seasons. Chelsea win 51%, against 53%. If anything, both clubs do slightly worse with him.
- **Three finals is far too few to conclude anything.**

### 3. Disputes follow the result

In all three clubs' finals, the documented disputes lean towards the winner. The average balance (decisions for minus against) in finals that had any disputes:

| Club | Finals won | Finals lost |
|---|---|---|
| Arsenal | +0.8 | −0.1 |
| Chelsea | +0.1 | −0.7 |
| Man Utd | +0.5 | −0.5 |

There are two possible explanations, and the data can't separate them:
- Refereeing calls help decide results.
- The losing side and its media complain more, so decisions against losers get documented more often.

Either way, the for/against counts partly mirror the results rather than independently explaining them.

### 4. Hardly any decision was judged an actual error

Across all three clubs and both referee groups, only five decisions were judged wrong by experts or acknowledged by officials:
- Four favoured these clubs: three for United, one for Arsenal.
- One went against them: against Chelsea.
- None involves a non-English referee.

## Bottom line

- **Win rates:** the club-by-club differences between English and non-English referees are large in percentage terms, but they track:
  - competition (domestic against European/world),
  - opponent (other big English clubs against weaker foreign sides),
  - shootouts.

  They do not track the referees themselves.
- **Disputed decisions:** the balances are small and not significant (all p ≥ 0.20). They mostly mirror who won.
- **Most notable item:** Arsenal 3–0 Chelsea in finals refereed by Anthony Taylor, with the debatable calls favouring Arsenal. That is three matches with no expert verdict, and his league record doesn't support a bias.

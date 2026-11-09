# Methodology note

**Scope.** This covers men's first-team finals of Arsenal, Chelsea, Liverpool, Manchester City and Manchester United from 1 January 1996 to 9 November 2026.

## 1. Definitions

- **Final.** A final is a single match that decides a trophy in one of these competitions:
  - FA Cup
  - League Cup (Football League Cup / EFL Cup)
  - FA Charity/Community Shield
  - European Cup/Champions League
  - UEFA Cup/Europa League
  - Conference League
  - Cup Winners' Cup
  - UEFA Super Cup
  - Intercontinental Cup
  - FIFA Club World Championship/Club World Cup
- **Final count.** The period contains **128 finals** and **179 club appearances**. A final between two of the five clubs counts once for each club:

  | Club | Appearances |
  |---|---|
  | Chelsea | 47 |
  | Manchester United | 43 |
  | Liverpool | 32 |
  | Arsenal | 29 |
  | Manchester City | 28 |

- **Excluded one-off matches.** These are listed in the `Excluded_OneOffs` tab and left out of the analysis.
  - The only qualifying match is the **1999 Second Division play-off final** (Manchester City v Gillingham).
  - No final replays, two-legged finals or relevant third-place matches fell in the period.
  - Manchester United played in the 2000 FIFA Club World Championship but went out in the group stage, so it has no final.
  - Pre-season and invitational tournaments are excluded and not listed individually.
- **Score fields.**
  - `score_90` includes stoppage time and excludes extra-time goals.
  - `decided_by` is "normal time", "extra time" or "penalties".
  - Community Shield draws go straight to penalties, with no extra time.
- **`core_verified`.** True only when **two or more independent sources other than Wikipedia** agree on date, venue, teams, score and winner. Wikipedia was used only to build the initial list and as hints. It is never counted as a source.
- **Contested decision.** A decision by the referee, assistants or VAR that at least one reputable outlet explicitly calls disputed, controversial, wrong or debatable. Decisions against either team are included.
  - **Assessment** is one of: officially acknowledged error, expert consensus correct, expert consensus incorrect, or genuinely debatable.
    - "Expert" means a former referee or a governing body, such as Dermot Gallagher on Sky Ref Watch, Dale Johnson's ESPN VAR reviews, PGMOL/KMI, UEFA or FIFA.
    - When only journalists or managers commented, the decision is "genuinely debatable", and `assessed_by` says so.
  - **Impact** is one of:
    - **none:** could not plausibly change the result.
    - **possible:** came at a close score.
    - **likely:** directly produced or denied a goal or a man advantage in a final decided by one goal or less.
- **Referee nationality** is the person's actual nationality, recorded separately from the federation they refereed for. Three cases matter:
  - **Dermot Gallagher (1996 FA Cup final):** born in Dublin, registered with The FA. Recorded as Irish.
  - **Jarred Gillett (2024 Community Shield):** Australian, on the English refereeing list.
  - **Alireza Faghani (2025 Club World Cup final):** Iranian-born, refereeing for Football Australia. Australian citizenship not verified.

  The analysis tests both groupings: English nationality versus not, and FA-registered versus a foreign federation. They differ only for Gallagher and Gillett, which is four club appearances.
- **Competition type.**
  - Domestic: FA Cup, League Cup, Shield.
  - European: UEFA competitions.
  - World: Intercontinental Cup and Club World Cup.
- **Venue category:**
  - Wembley
  - Millennium Stadium in Cardiff, used 2001–06 and for the 2026 Shield
  - Other venue in England: Villa Park (2012 Shield) and the King Power Stadium (2022 Shield)
  - Neutral venue abroad

  No final in scope was played at a finalist's home ground.
- **Era.** Two splits are used:
  - Whether VAR was in use, per match and per a source. English pre-2018 Shields are set to "not in use", because VAR's first competitive use in England was 8 January 2018.
  - Ten-year blocks: 1996–2005, 2006–2015, 2016–2026.

## 2. Sources and how they were gathered

- **Finals list.** Taken from Wikipedia's list pages for each competition, then each final's match article. These were cross-checked with RSSSF, UEFA/FIFA match data, TheFA, club sites and news outlets.
- **Match data.** Nine research passes, one per competition block, plus three gap-filling passes. Each final was checked against at least two non-Wikipedia sources. In practice these were mostly:
  - UEFA "Full Time Report" and "Team statistics" PDFs
  - FIFA match data
  - BBC, Sky Sports, ESPN (match pages and its public data feed)
  - TheFA, RSSSF
  - Irish Times, RTÉ, Reuters/AP/PA reprints
  - Soccerbase, club websites

  Every row carries its source URLs.
- **League position and points at the date of each final.**
  - Computed from football-data.co.uk results for these leagues:
    - England tiers 1–2
    - Spain, Italy, Germany, France, Portugal, Netherlands, Turkey
  - Every league match before the final's date is counted, with tie-breaks on points, goal difference, then goals scored.
  - Points deductions applied: Portsmouth 2009-10 and Milan 2006-07. Head-to-head tie-breaks are not modelled.
  - For finals in July or August, the previous season's final position is also given.
  - Leagues with no data: Brazil, Ecuador and Russia.
- **Pre-match strength.**
  - **Bookmaker odds:** converted to implied probability with the bookmaker's margin removed. Where only 90-minute win/draw/win odds exist, the draw probability is split between the teams in proportion to their win chances, to estimate the chance of lifting the trophy. This is an assumption.
  - **Club Elo:** could **not** be obtained. api.clubelo.com returned HTTP 502 for the whole research window, and the Wayback Machine could not be reached. No ClubElo figures appear anywhere.
  - **Fallback "own Elo":** computed in this project from English tier 1–2 league results since 1993 (K=20, home advantage 60, goal-difference multiplier). It is used only for the 91 finals between two English clubs and is clearly labelled as not being ClubElo.
- **Referee records with each club.**
  - **English referees:** Premier League records from football-data.co.uk's referee field, 2000-01 to 2026-27. Each is compared with the club's own win rate in the same seasons. Cup and European games, and anything before 2000, are not included.
  - **Foreign referees:** full career records exist only for Liverpool, from LFChistory.net referee pages. For the other clubs there are newspaper-quoted figures where found, and otherwise partial match lists.
- **Unreachable sources.**
  - WebFetch was refused by news.bbc.co.uk, independent.co.uk and transfermarkt.
  - worldfootball.net, FBref, 11v11 and the Guardian/Telegraph blocked automated fetching or showed bot checks.
  - web.archive.org could not be reached.
  - Five Independent articles from 1996–2000 were downloaded directly after WebFetch refused the site. They are cited and flagged. After that, refusals were not worked around.

## 3. Statistical methods

These suit small samples:

- **Win rates:** Wilson 95% confidence intervals.
- **Differences between groups:**
  - 2×2 tables: Fisher's exact test.
  - Larger tables: a permutation chi-square test with 20,000 permutations.
- **Actual against expected wins:** the number of wins expected from the pre-match probabilities, with an exact two-sided p-value. A permutation test compares the size of that gap between two subgroups, such as English versus foreign referees.
- **Shootouts:** analysed separately from matches decided in play, using an exact binomial test against 50%.
- **Direction of contested decisions:** exact sign tests at two levels:
  - Each decision counted separately.
  - Each final counted once, by whether its decisions on balance favoured or went against the club. This handles the fact that several decisions from one match are not independent.

  Each runs three ways: all disputed decisions; assessed errors only; and all except "expert consensus correct".
- **Multiple comparisons:** all 121 tests are corrected together using Holm (family-wise) and Benjamini–Hochberg (false discovery rate). The `A_Multiple_Testing` tab lists them all.

## 4. What is excluded and why

- **Matches.** Play-off finals and other one-off matches, women's and youth matches, friendlies and pre-season tournaments: outside the scope list.
- **Referee-record data.** Cup and European matches are excluded from the English referees' records because no reliable bulk source was reachable. Their pre-2000 Premier League matches are excluded because the source has no referee field before 2000-01.
- **Strength data.** Odds from unknown or low-reliability sites were excluded. ESPN-feed lines are kept but flagged, because they have no timestamp.
- **xG.** Only figures from a named provider are recorded. That leaves one value: Opta via The Analyst, for Manchester United in the 2025 Europa League final.

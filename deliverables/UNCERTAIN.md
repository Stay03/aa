# Unverified and uncertain data points

This file lists the uncertain items by category. The full itemised list has **820 rows**, each tied to a final where applicable. It is in `uncertain_items.csv` and in the `Uncertain` tab of `finals_dataset.xlsx`.

Each final's own `uncertain` field explains its specific conflicts. Typical examples are booking minutes that differ by 1–3 minutes between ESPN, UEFA and Wikipedia, or a fact backed by only one source.

## A. Dataset-wide gaps

1. **Club Elo ratings are missing for all finals.** api.clubelo.com returned HTTP 502 throughout, and the Wayback Machine could not be reached. A substitute "own Elo", built from English league results only, is provided for the 91 all-English finals and labelled as not being ClubElo.
2. **Bookmaker odds are missing for 99 of 128 finals.**
   - Where odds do exist, many are US sportsbook lines from ESPN's data feed with no timestamp. Treating them as pre-match is an assumption.
   - The odds that were found predicted results poorly in this sample (Brier 0.27).
3. **xG is missing for 127 of 128 finals.** The only value from a named provider is Manchester United's 0.97 in the 2025 Europa League final (Opta via The Analyst).
4. **Shots, possession and fouls are missing for 46 finals**, mostly 1996–2008 domestic finals. Some ESPN figures are flagged as implausible: 2013 FA Cup shots on target and 2020 FA Cup Arsenal fouls.
5. **Key absences** are not recorded for 72 finals.
6. **Assistant referees** are missing for 42 finals and **fourth officials** for 41, almost all from 1996–2012.
7. **Goal-line technology** use is unconfirmed for 55 finals; no source states it either way.
8. **Unreachable sources.** Old BBC, Guardian, Telegraph and Wayback Machine pages could not be reached. Many 1996–2010 items therefore rest on ESPN's data feed or live commentary, RSSSF, Soccerbase, RTÉ or the Irish Times.
9. **Five Independent articles** (1996–2000 Charity Shields) were retrieved by direct download after the fetch tool refused the site. They are cited but flagged.

## B. Core facts not confirmed by two independent sources (core_verified = False)

Seven finals are affected:

- **1998, 2002, 2003, 2004, 2005, 2009 and 2010 Charity/Community Shields.** Score and winner agree with RSSSF, but the exact date (and for 1998 the venue) came from only one independent source.
  - For 2003, ESPN wrongly gives Old Trafford as the venue; it was the Millennium Stadium.

## C. Referee identity confirmed by fewer than two independent non-Wikipedia sources

Twelve finals are affected:

- **League Cup finals:** 1998 (Peter Jones) and 2007 (Howard Webb) rest on Wikipedia only. 2008, 2010, 2011 and 2012 rest on one source (ESPN).
- **Charity/Community Shields:** 1998, 2003, 2004, 2005, 2009 and 2010.

## D. Referee nationality: points to note

- **Dermot Gallagher (1996 FA Cup final):** born in Dublin. Wikipedia and Irish media describe him as Irish, while data sites list him as "England" (his federation). Recorded as Irish, with federation The FA.
- **Alireza Faghani (2025 Club World Cup final):** Iranian-born, and refereed for Football Australia at the time. Australian citizenship is not verified.
- **Jarred Gillett (2024 Community Shield referee; 2025 FA Cup VAR):** Australian, on the English list. His nationality for the 2025 VAR role comes from the research agent's general knowledge, not a fetched source.

## E. Card lists not confirmed complete (28 finals)

- **FA Cup:** 1996, 1997, 1999, 2000, 2001, 2003.
- **UEFA Cup:** 2000, 2001.
- **League Cup:** 1998, 2001, 2003, 2008, 2010, 2011, 2012.
- **Charity/Community Shield:** 1996, 1999, 2000, 2001, 2003, 2004, 2005, 2006, 2010, 2012.
- **UEFA:** 1999 Champions League final (only Effenberg's booking is known), 1999 and 2001 Super Cups.

## F. Contested decisions

- **47 of 124 decisions rest on a single reputable source.** These are flagged by `n_sources` in the `Contested_Decisions` tab.
- **104 have no expert or official assessment** and are recorded as "genuinely debatable".
- **Some minutes are approximate.** Examples: "first half", or "c.25-30" for the 2018 Champions League final Ramos/Salah incident.
- **Some finals were not fully searched,** because of search limits during the research and blocked archives. Many 1996–2012 domestic finals rest on ESPN's live commentary alone. An empty decision list means none were *found*, not that none existed.
- **One curated recoding:** the 2019 Club World Cup Mané/Rafinha penalty was recoded as an error favouring Liverpool and corrected by VAR, with no impact. The source agent had coded it the other way round.

## G. Specific conflicts between sources (noted, not resolved)

- **2015 League Cup final:** the second goal is credited to Kyle Walker (own goal) by Sky and TheFA, but to Diego Costa by 11v11 and Sports Mole.
- **2024 League Cup final:** Sky lists the assistant VAR as Wade Smith; Wikipedia lists Marc Perry.
- **2025 FA Cup final:** Wikipedia had the assistant VAR and support VAR swapped. TheFA and BBC give Cann as assistant VAR and Salisbury as support VAR, and that is what is recorded.
- **2013 Europa League final:** saves are 5–10 on Wikipedia but 3–3 in UEFA's PDF. UEFA's figures are used.
- **2012 Champions League final:** Bayern had 35 shots per UEFA, not 43 as on Wikipedia. UEFA's figure is used.
- **2016 Community Shield:** a booking minute differs between TheFA and ESPN; ESPN's is kept.
- **2012 Community Shield:** the Irish Times reports a David Luiz booking that ESPN and Sports Mole don't show.

## H. Referee records with the clubs

- **English referees:** records are Premier League only, from 2000-01 onward. They exclude cup, European and pre-2000 matches, so the 1996–2000 finals' referees have only part of their careers covered. The source abbreviates names, and spelling variants were normalised.
- **Foreign referees:** complete records exist only with Liverpool (LFChistory.net).
  - Newspaper-quoted records: Siebert–Arsenal 4/4 and Skomina–Liverpool.
  - Rocchi–Arsenal (4 matches, 1 win) comes from a search snippet with no identifiable outlet. Treat it as unverified.
  - No records at all were found for Faghani, Beath, Peljto, Batta, Irmatov, Wójcik or Braschi.

## I. League positions

- **Tie-breaks:** computed with points, goal difference, then goals scored. Head-to-head tie-breaks (Spain, Italy) are not modelled.
- **Points deductions:** only Portsmouth 2009-10 and Milan 2006-07 are applied.
- **No league data:** Palmeiras, Corinthians, Flamengo, Fluminense, São Paulo, LDU Quito, CSKA Moscow and Zenit.

## J. Excluded one-off match

- **1999 Second Division play-off final (Manchester City v Gillingham):** score, date, venue and shootout are confirmed by mancity.com and The National. Referee (Mark Halsey) and attendance come from Wikipedia only.

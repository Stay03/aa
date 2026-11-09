# P-value ranking by team (English referees)

**Method.** Each team is tested four ways, and the table is sorted by its smallest p-value:

- **Results vs odds:** Premier League points compared with points expected from pre-match bookmaker odds.
- **Referee variation:** whether the team's results against odds differ depending on which referee it gets.
- **Bookings per foul:** yellow cards per foul compared with its opponents' rate.
- **Finals decisions:** disputed decisions for and against, in finals refereed by English officials (sign test).

q is the false-discovery-rate-adjusted p-value (Benjamini–Hochberg) across all 115 tests, the standard correction for running many tests at once.
**q < 0.05 is significant after correction.**

Premier League data covers 2000-01 to 2026-27 (in progress). Teams with fewer than 150 Premier League matches are excluded.

| Rank | Team | Strongest result | Direction | p | q | Results vs odds p (pts ± odds) | Referee variation p | Bookings/foul p (ratio) | Finals decisions p (for–against) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Liverpool | cards per foul | booked LESS per foul than opponents | <0.0001 | <0.0001 **✔** | 0.67 (+16.0) | 0.61 | <0.0001 (0.82) | 0.48 (11–7) |
| 2 | Arsenal | cards per foul | booked LESS per foul than opponents | 0.0007 | 0.03 **✔** | 0.05 (+74.8) | 0.80 | 0.0007 (0.89) | 0.20 (19–11) |
| 3 | Bolton | cards per foul | booked MORE per foul than opponents | 0.0007 | 0.03 **✔** | 0.65 (+11.0) | 0.74 | 0.0007 (1.21) |  |
| 4 | Burnley | cards per foul | booked MORE per foul than opponents | 0.0012 | 0.03 **✔** | 0.61 (+11.3) | 0.14 | 0.0012 (1.21) |  |
| 5 | Manchester City | cards per foul | booked LESS per foul than opponents | 0.0016 | 0.04 **✔** | 0.98 (+0.9) | 0.12 | 0.0016 (0.89) | 0.84 (12–14) |
| 6 | Fulham | cards per foul | booked MORE per foul than opponents | 0.0046 | 0.09 | 0.97 (-1.2) | 0.74 | 0.0046 (1.13) |  |
| 7 | West Ham United | cards per foul | booked MORE per foul than opponents | 0.01 | 0.19 | 0.54 (+21.7) | 0.60 | 0.01 (1.10) |  |
| 8 | Brighton | cards per foul | booked LESS per foul than opponents | 0.01 | 0.19 | 0.83 (-4.8) | 0.82 | 0.01 (0.87) |  |
| 9 | Stoke City | cards per foul | booked MORE per foul than opponents | 0.03 | 0.37 | 0.20 (+29.8) | 0.23 | 0.03 (1.14) | 1.00 (1–0) |
| 10 | West Brom | cards per foul | booked MORE per foul than opponents | 0.03 | 0.40 | 0.16 (-36.4) | 0.58 | 0.03 (1.12) |  |
| 11 | Blackburn | referee heterogeneity | results vary by referee | 0.05 | 0.46 | 0.58 (+13.5) | 0.05 | 0.63 (1.03) |  |
| 12 | Sunderland | cards per foul | booked MORE per foul than opponents | 0.06 | 0.49 | 0.07 (-50.7) | 0.25 | 0.06 (1.09) | 1.00 (1–0) |
| 13 | Tottenham Hotspur | cards per foul | booked LESS per foul than opponents | 0.07 | 0.49 | 0.81 (+9.3) | 0.63 | 0.07 (0.94) | 0.69 (4–2) |
| 14 | Manchester United | results vs odds | better than odds | 0.07 | 0.49 | 0.07 (+68.6) | 0.36 | 0.36 (0.97) | 1.00 (16–16) |
| 15 | Newcastle United | cards per foul | booked LESS per foul than opponents | 0.07 | 0.49 | 0.49 (+25.3) | 0.96 | 0.07 (0.94) | 1.00 (0–1) |
| 16 | Watford | referee heterogeneity | results vary by referee | 0.10 | 0.60 | 0.28 (-20.7) | 0.10 |  | 1.00 (0–1) |
| 17 | Southampton | results vs odds | worse than odds | 0.10 | 0.60 | 0.10 (-50.2) | 0.11 | 0.69 (1.02) | 1.00 (2–2) |
| 18 | Norwich | results vs odds | worse than odds | 0.13 | 0.70 | 0.13 (-28.2) | 0.36 |  |  |
| 19 | Sheffield United | referee heterogeneity | results vary by referee | 0.15 | 0.72 | 0.34 (-13.2) | 0.15 |  |  |
| 20 | Middlesbrough | results vs odds | worse than odds | 0.17 | 0.76 | 0.17 (-32.1) | 0.98 | 0.54 (1.04) |  |
| 21 | Wigan Athletic | referee heterogeneity | results vary by referee | 0.21 | 0.82 | 0.98 (+0.6) | 0.21 | 0.73 (1.02) |  |
| 22 | Everton | finals decisions | more decisions FOR | 0.25 | 0.86 | 0.26 (+43.6) | 0.33 | 0.67 (1.01) | 0.25 (3–0) |
| 23 | Wolves | cards per foul | booked LESS per foul than opponents | 0.27 | 0.86 | 0.62 (-12.5) | 0.70 | 0.27 (0.95) |  |
| 24 | Brentford | results vs odds | better than odds | 0.27 | 0.86 | 0.27 (+19.1) | 0.44 |  |  |
| 25 | Leeds | cards per foul | booked MORE per foul than opponents | 0.28 | 0.86 | 0.57 (-12.4) | 0.45 | 0.28 (1.07) |  |
| 26 | Hull City | results vs odds | worse than odds | 0.30 | 0.92 | 0.30 (-16.7) | 0.60 |  | 0.50 (0–2) |
| 27 | Nott'm Forest | referee heterogeneity | results vary by referee | 0.33 | 0.92 | 0.52 (+9.7) | 0.33 |  |  |
| 28 | Chelsea | finals decisions | more decisions AGAINST | 0.34 | 0.92 | 0.93 (-3.2) | 0.61 | 0.83 (1.01) | 0.34 (16–23) |
| 29 | Bournemouth | referee heterogeneity | results vary by referee | 0.37 | 0.92 | 0.56 (+13.1) | 0.37 | 0.85 (1.01) |  |
| 30 | Leicester City | referee heterogeneity | results vary by referee | 0.45 | 0.99 | 0.98 (-0.7) | 0.45 | 0.80 (0.99) | 1.00 (2–2) |
| 31 | Crystal Palace | results vs odds | better than odds | 0.45 | 0.99 | 0.45 (+20.8) | 0.77 | 0.80 (0.99) | 0.62 (1–3) |
| 32 | Charlton | results vs odds | better than odds | 0.48 | 0.99 | 0.48 (+13.8) | 0.88 |  |  |
| 33 | Aston Villa | finals decisions | more decisions AGAINST | 0.50 | 0.99 | 0.56 (+20.8) | 0.76 | 0.91 (1.00) | 0.50 (0–2) |
| 34 | Birmingham City | finals decisions | more decisions AGAINST | 0.50 | 0.99 | 0.81 (-4.7) | 0.71 |  | 0.50 (0–2) |
| 35 | Portsmouth | results vs odds | worse than odds | 0.76 | 0.99 | 0.76 (-6.0) | 0.92 |  |  |
| 36 | Swansea | referee heterogeneity | results vary by referee | 0.77 | 0.99 | 0.81 (+4.7) | 0.77 |  |  |

## Reading the table

**Five results survive correction for multiple comparisons. All five are about bookings per foul:**

- **Booked less than their opponents:** Liverpool, Arsenal and Manchester City.
- **Booked more than their opponents:** Bolton and Burnley.

This looks like a big-club vs physical-team pattern, and it may come from the type of fouls committed rather than from referees.

**Nothing else survives correction.** That includes every results-vs-odds test, every referee-variation test, and every finals-decisions test.

**Chelsea ranks 28th of 36.** Their smallest p is 0.34 (finals decisions, 16 for and 23 against; q = 0.92). Their results against odds are almost exact (p = 0.93), their bookings per foul are neutral (ratio 1.01, p = 0.83), and no referee stands out (p = 0.61).

**No English team shows a significant disadvantage from English referees** on any of the four tests.

# Research brief: finals verification (shared by all batch agents)

Project: a verified dataset of every trophy-deciding final played by Arsenal, Chelsea,
Liverpool, Manchester City and Manchester United (men's first teams), 1 Jan 1996 – today
(today = 9 Nov 2026). Accuracy matters far more than speed or completeness.
**If you are not sure of a fact, record it as null and explain in `uncertain` — never guess.**
Do not start from any hypothesis about referees favouring clubs; just record what sources say.

## Your input
`/home/user/aa/work/batch_<ID>.json` — one object per final, auto-extracted from the
English Wikipedia match article (score, goals, cards from lineup tables, managers,
officials, a statistics table when present). Wikipedia is a **starting point only**; it is
not one of the two independent sources. The card/goal extraction is automatic and may be
incomplete or wrong (e.g. second-yellow vs straight red, missing cards in older articles).

Raw Wikipedia wikitext for each article is cached at
`/home/user/aa/raw/wiki/<article title>.wikitext` (read it rather than re-fetching).

## Tools
WebSearch (mode "standard"; "extended" only if standard is thin) and WebFetch.
Good sources: BBC Sport match reports (news.bbc.co.uk/sport1/hi/football/... for old matches,
bbc.co.uk/sport/football/<id> for newer), UEFA.com match pages and UEFA PDF
"Full Time Report"/"Team statistics"/"Tactical lineups" (uefa.com/newsfiles/...),
FIFA.com / FIFA PDF match reports, TheFA.com, club official sites, The Guardian
(minute-by-minute reports are useful for cards and incidents), The Telegraph, The Independent,
The Times, ESPN (incl. Dale Johnson's VAR reviews), Sky Sports (Dermot Gallagher's "Ref Watch"),
PGMOL / Premier League Key Match Incidents panel statements (2019-20 onwards), Reuters, AP.
Web archive (web.archive.org) copies of these are fine. **Never** use fan forums, Reddit,
or social media as a source for anything; club fan blogs only as a pointer, not as a source.
Some hosts block fetches (fbref, worldfootball, 11v11, transfermarkt often do) — don't fight it,
use another source.

## What to produce, per final
Write ONE JSON file: `/home/user/aa/work/out_<ID>.json` containing a list of objects with
exactly these keys (use null where unknown). Save progress to the file regularly (e.g. after
every 2–3 finals) so work is not lost.

```json
{
  "article": "2005 FA Cup final",
  "date": "2005-05-21",
  "competition": "FA Cup",
  "season": "2004-05",
  "venue": "Millennium Stadium",
  "city": "Cardiff",
  "team1": "Arsenal", "team2": "Manchester United",
  "score_90": "0-0",               // team1-team2 after 90 min (incl. stoppage time)
  "score_aet": "0-0",              // after extra time, null if no ET
  "shootout": "5-4",               // team1-team2, null if none
  "winner": "Arsenal",
  "decided_by": "penalties",       // "normal time" | "extra time" | "penalties" | "replay"
  "core_sources": ["url1","url2"], // >=2 independent non-Wikipedia sources that confirm date/venue/teams/score/winner
  "core_verified": true,           // true only if >=2 independent sources agree on all core facts

  "referee": "Rob Styles",
  "referee_nationality": "English",       // actual nationality of the person
  "referee_association": "The FA (England)",  // association/federation they officiated for
  "referee_sources": ["url1","url2"],    // >=2 sources naming the referee; note nationality basis
  "assistants": "Name1; Name2",           // with nationality in brackets if foreign
  "fourth_official": "Name",
  "var_officials": "VAR: X; AVAR: Y, Z",  // null if no VAR
  "var_in_use": true,                     // true/false, or null if unverified
  "glt_in_use": true,                     // goal-line technology; true/false/null
  "officials_sources": ["url"],

  "manager1": "Arsène Wenger", "manager2": "Sir Alex Ferguson",

  "goals": [ {"team":"team1|team2 name","player":"","minute":"45+2","type":"open play|penalty|own goal|free kick|header|unknown"} ],
  "cards": [ {"team":"","player":"","minute":"","card":"Y|2Y|R","in_shootout_or_after_whistle":false} ],
  "cards_complete": true,          // false if you could not confirm the full card list
  "cards_sources": ["url"],

  "stats": {"shots1":null,"shots2":null,"sot1":null,"sot2":null,"poss1":null,"poss2":null,
            "fouls1":null,"fouls2":null,"xg1":null,"xg2":null,"source":"url","xg_source":"url",
            "note":"which provider; possession method if known"},

  "odds": {"team1":null,"draw":null,"team2":null,      // decimal 90-minute 1X2 odds
           "team1_to_lift":null,"team2_to_lift":null,  // decimal "to lift the trophy/qualify" odds if that's all you find
           "bookmaker_or_source":"", "source":"url", "note":""},  // null object if nothing reliable found

  "absences": {"team1": ["Player (injury/suspension)"], "team2": ["..."], "sources": ["url"]},
             // key absentees: regular starters/important players missing through injury or suspension

  "contested_decisions": [
    {"minute":"", "score_at_time":"team1-team2", "type":"penalty given|penalty not given|red card given|red card not given|goal allowed|goal disallowed|offside|other",
     "description":"", "favoured_team":"", "against_team":"",
     "assessment":"officially acknowledged error|expert consensus correct|expert consensus incorrect|genuinely debatable",
     "assessed_by":"who: e.g. 'PGMOL KMI panel', 'UEFA statement', 'Dermot Gallagher (Sky Sports Ref Watch)', 'Keith Hackett in Telegraph', 'match report journalist only'",
     "impact":"none|possible|likely", "impact_reasoning":"",
     "sources":["url1","url2"]}      // >=2 reputable sources; if only 1, still record it but say so in uncertain
  ],
  "contested_search_done": "brief note of what you searched (e.g. 'BBC report, Guardian MBM, Telegraph ref column; no disputes found')",

  "uncertain": ["free text list of anything unverified, conflicting between sources, or guessed-not-recorded"]
}
```

## Rules and definitions
- **Contested decision** = a refereeing decision (by referee, assistants or VAR) that at least
  one reputable source explicitly describes as disputed, controversial, wrong or debatable.
  Include decisions that went against EITHER team. A manager complaining counts as "disputed"
  only if a reputable outlet reports it; then record what neutral experts said, if anything.
  If no expert assessment exists, use "genuinely debatable" and set assessed_by to
  "no expert assessment found; journalist/manager comments only". Do not invent controversies:
  if nothing is documented, return an empty list and say what you searched.
- "Impact": none = could not plausibly have changed the result (e.g. at 4–0); possible = came at a
  close score and could have changed the outcome; likely = directly produced/denied a goal or
  a man advantage in a match decided by one goal or less. Give reasoning.
- Referee nationality: the person's actual nationality, not inferred from the competition.
  For English domestic finals, "English" vs Welsh etc. matters only if a source says so —
  e.g. a referee born and registered in Wales is "Welsh". Watch out for officials who changed
  federation (e.g. Alireza Faghani: Iranian-born, moved to Football Australia in 2024).
- VAR in use: say true only if a source says VAR was used/available for that match.
  GLT: true only if a source says goal-line technology was in operation for that match/competition.
- Odds: prefer pre-match 90-minute 1X2 odds quoted in a reputable newspaper preview, BBC, or
  an odds-comparison archive. Record exactly what is quoted (fractional → convert to decimal:
  5/4 = 2.25). If only "to lift the trophy" odds are available, put them in *_to_lift.
  If nothing reliable is found, set odds to null — do not estimate.
- Stats: BBC match reports (2000s onward) show shots/on target/possession/fouls; UEFA/FIFA PDFs
  give full stats. xG: only from a named provider (Opta via BBC/Premier League/UEFA, Understat,
  FBref/StatsBomb, FotMob); record the provider. Null otherwise.
- Use the Wikipedia data as hints and cross-check. Correct it where sources disagree, and note
  the disagreement in `uncertain`.
- Minutes: write as "45+2", "90+4", "105" etc. Score_90 must exclude extra-time goals.

## When done
Reply with a short summary: number of finals done, how many have core_verified=true, the count of
contested decisions found, and the main gaps/uncertainties. Keep the reply under 300 words;
the details go in the JSON file.

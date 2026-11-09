# Census brief: every disallowed goal and every VAR intervention in English-refereed finals

Goal: build a COMPLETE, judgement-free list of officiating interventions in each final in your input file. This is a CENSUS, not a list of controversies: record every event whether or not anyone disputed it. Do NOT record any expert/PGMOL/pundit verdict on whether it was right — only what happened and which team it went against.

For every final, record:
1. Every goal that was scored (ball in the net, or the team celebrated a goal) but NOT given — for any reason: offside flag, foul, handball, VAR review, ball out of play, whistle blown before the ball went in, ball crossing the line not given (goal-line), etc.
2. Every VAR intervention (from 2018 onward where VAR was used): on-field reviews and VAR-only overturns — goals ruled out, goals awarded after being flagged, penalties awarded/overturned, red cards given/rescinded, mistaken identity.
3. Every penalty awarded (by whom, minute, scored/missed) — on-field or via VAR.
4. Every red card (straight or second yellow), minute, player, team.

For each event: final_id, minute (string; null if unknown), score_at_time ("team1-team2"), event_type (one of: "goal disallowed", "goal awarded after review", "penalty awarded", "penalty overturned", "red card", "red card overturned", "other VAR intervention"), reason (offside / foul / handball / out of play / not over line / whistle before goal / other), decided_by ("referee", "assistant", "VAR", "referee after VAR review"), team_benefiting, team_against, player(s), short description, sources (>=2 reputable where possible: BBC, Sky, ESPN, TheFA, PA, Reuters, AP, Guardian, Telegraph, Independent, Irish Times, RTE, club official sites; no forums/social media). Also per final: "census_complete": true only if you found a full match report or minute-by-minute that would mention any disallowed goal; plus "census_sources" (what you read) and "notes".

Rules:
- If WebFetch refuses a domain, do NOT work around it with curl; use another outlet.
- If unsure whether a goal was disallowed or merely a near miss, record it with a note rather than guessing; never invent events.
- Use WebSearch sparingly (limited budget); prefer fetching match reports / minute-by-minutes directly. ESPN match pages, Sky Sports live/report pages, BBC (bbc.co.uk/sport), TheFA, RTE and Irish Times worked for earlier researchers. Cached Wikipedia wikitext for each final is in /home/user/aa/raw/wiki/<final_id>.wikitext (hints only, not a source).
- Save progress to your output file after every 3-4 finals.

Output: JSON list, one object per final:
{"final_id":"", "census_complete":true, "census_sources":["url"], "notes":"", "events":[{...}]}
Reply when done in under 200 words: finals done, how many census_complete, count of disallowed goals by team.

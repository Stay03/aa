"""Own Elo ratings from English league matches (tiers 1-2, football-data.co.uk).
NOT ClubElo. Used only to estimate pre-match strength for finals between two English clubs.
Parameters: K=20, home advantage 60 points, goal-difference multiplier (World Football Elo style),
all clubs start at 1500 in Aug 1993 (tier 2 at 1350); 3 seasons of burn-in before 1996."""
import os, json, glob, math, datetime as dt, warnings
warnings.filterwarnings("ignore")
import pandas as pd
from standings import load, MAP, final_date
W=os.path.dirname(os.path.abspath(__file__))+"/../work/"
games=[]
for s in range(1993,2027):
    for lg in ("E0","E1"):
        d=load(s,lg)
        if d is None: continue
        d=d.dropna(subset=["D","FTHG","FTAG"])
        for r in d.itertuples(): games.append((r.D,r.HomeTeam,r.AwayTeam,int(r.FTHG),int(r.FTAG),lg))
games.sort(key=lambda g:g[0])
R={}; hist={}
def get(t,lg): return R.setdefault(t,1500 if lg=="E0" else 1350)
for D,h,a,hg,ag,lg in games:
    rh,ra=get(h,lg),get(a,lg)
    e=1/(1+10**(-(rh+60-ra)/400)); res=1 if hg>ag else .5 if hg==ag else 0
    gd=abs(hg-ag); mult=1 if gd<=1 else 1.5 if gd==2 else (11+gd)/8
    dlt=20*mult*(res-e); R[h]=rh+dlt; R[a]=ra-dlt
    hist.setdefault(h,[]).append((D,R[h])); hist.setdefault(a,[]).append((D,R[a]))
def rating_before(t,date):
    hs=hist.get(t,[]); v=None
    for D,r in hs:
        if D<pd.Timestamp(date): v=r
        else: break
    return v
out={}
for f in glob.glob(W+"batch_*.json"):
    for r in json.load(open(f)):
        t1,t2=MAP.get(r["team1"]),MAP.get(r["team2"])
        date=final_date(r["article"])
        if t1 in hist and t2 in hist and date:
            e1,e2=rating_before(t1,date),rating_before(t2,date)
            if e1 and e2:
                out[r["article"]]={"own_elo1":round(e1),"own_elo2":round(e2),"own_elo_p_team1":round(1/(1+10**(-(e1-e2)/400)),3)}
json.dump(out,open(W+"own_elo.json","w"),indent=1)
print(len(out),"finals with own-Elo estimate")
for k,v in sorted(out.items())[:8]: print(k,v)

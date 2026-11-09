import pandas as pd, os, json, glob, re, datetime as dt
FD=os.path.dirname(os.path.abspath(__file__))+"/../raw/footballdata/"
MAP={'Arsenal':'Arsenal','Chelsea':'Chelsea','Liverpool':'Liverpool','Manchester City':'Man City','Manchester United':'Man United',
'Ajax':'Ajax','Alavés':'Alaves','Aston Villa':'Aston Villa','Atlético Madrid':'Ath Madrid','Barcelona':'Barcelona','Bayern Munich':'Bayern Munich',
'Benfica':'Benfica','Birmingham City':'Birmingham','Cardiff City':'Cardiff','Crystal Palace':'Crystal Palace','Everton':'Everton','Galatasaray':'Galatasaray',
'Hull City':'Hull','Inter Milan':'Inter','Lazio':'Lazio','Leicester City':'Leicester','Middlesbrough':'Middlesbrough','Milan':'Milan','Millwall':'Millwall',
'Newcastle United':'Newcastle','Paris Saint-Germain':'Paris SG','Portsmouth':'Portsmouth','Real Betis':'Betis','Real Madrid':'Real Madrid','Sevilla':'Sevilla',
'Southampton':'Southampton','Stoke City':'Stoke','Sunderland':'Sunderland','Tottenham Hotspur':'Tottenham','VfB Stuttgart':'Stuttgart','Villarreal':'Villarreal',
'Watford':'Watford','West Ham United':'West Ham','Wigan Athletic':'Wigan'}
LEAGUES=['E0','E1','SP1','I1','D1','F1','P1','N1','T1']
LNAME={'E0':'Premier League','E1':'Championship/First Division (tier 2)','SP1':'La Liga','I1':'Serie A','D1':'Bundesliga','F1':'Ligue 1','P1':'Primeira Liga','N1':'Eredivisie','T1':'Süper Lig'}
# known points deductions in force (season_start, fd_name): points
DEDUCT={(2009,'Portsmouth'):9,(2006,'Milan'):8}
_cache={}
def load(season,lg):
    k=(season,lg)
    if k in _cache: return _cache[k]
    f=FD+f"{season%100:02d}{(season+1)%100:02d}_{lg}.csv"
    if not os.path.exists(f): _cache[k]=None; return None
    import csv
    rows=list(csv.reader(open(f,encoding='latin1')))
    hdr=[h.replace('\ufeff','').replace('ï»¿','') for h in rows[0]]
    idx={h:i for i,h in enumerate(hdr) if h}
    keep=['Div','Date','HomeTeam','AwayTeam','FTHG','FTAG','Referee','HY','AY','HR','AR','HF','AF']
    recs=[]
    for r in rows[1:]:
        if len(r)<5 or not r[idx['HomeTeam']]: continue
        recs.append({k:(r[idx[k]] if k in idx and idx[k]<len(r) else None) for k in keep})
    d=pd.DataFrame(recs)
    d['FTHG']=pd.to_numeric(d.FTHG,errors='coerce'); d['FTAG']=pd.to_numeric(d.FTAG,errors='coerce')
    d=d.dropna(subset=['HomeTeam','AwayTeam','FTHG','FTAG'])
    d['D']=pd.to_datetime(d['Date'],format='mixed',dayfirst=True,errors='coerce')
    _cache[k]=d; return d
def table(d,season,before=None):
    if before is not None: d=d[d.D<before]
    t={}
    for _,r in d.iterrows():
        for tm,gf,ga in((r.HomeTeam,r.FTHG,r.FTAG),(r.AwayTeam,r.FTAG,r.FTHG)):
            x=t.setdefault(tm,[0,0,0,0]); x[0]+=1; x[2]+=gf; x[3]+=ga
            x[1]+=3 if gf>ga else 1 if gf==ga else 0
    for tm in t:
        t[tm][1]-=DEDUCT.get((season,tm),0)
    rows=sorted(t.items(),key=lambda kv:(-kv[1][1],-(kv[1][2]-kv[1][3]),-kv[1][2]))
    return {tm:dict(pos=i+1,played=v[0],pts=v[1],gd=int(v[2]-v[3]),teams=len(rows)) for i,(tm,v) in enumerate(rows)}
def season_of(date): return date.year if date.month>=7 else date.year-1
def find_league(team,season):
    for lg in LEAGUES:
        d=load(season,lg)
        if d is not None and team in set(d.HomeTeam): return lg
    return None
def standing(wiki_team,date):
    fd=MAP.get(wiki_team)
    if not fd: return {"status":"no league data source (league not covered by football-data.co.uk)"}
    s=season_of(date)
    res={}
    lg=find_league(fd,s)
    if lg:
        d=load(s,lg); tb=table(d,s,pd.Timestamp(date))
        if fd in tb:
            x=tb[fd]; res.update(league=LNAME[lg],season=f"{s}-{(s+1)%100:02d}",pos=x['pos'],played=x['played'],pts=x['pts'],gd=x['gd'],teams=x['teams'])
        else: res.update(league=LNAME[lg],season=f"{s}-{(s+1)%100:02d}",played=0,pos=None)
        # was the league season finished before the final?
        last=d.D.max(); res['league_season_complete_before_final']=bool(last<pd.Timestamp(date))
    plg=find_league(fd,s-1)
    if plg:
        tb=table(load(s-1,plg),s-1); x=tb.get(fd)
        if x: res.update(prev_season_league=LNAME[plg],prev_season_pos=x['pos'],prev_season_pts=x['pts'])
    res['status']='ok' if res.get('pos') or res.get('prev_season_pos') else 'not found'
    return res
def final_date(article):
    import re
    from parse_infobox import D
    w=open(D+article.replace("/","_")+".wikitext").read()
    i=max(w.find("{{Football box"),w.find("{{#invoke:football box"),w.find("{{#invoke:Football box"),w.find("{{Footballbox"))
    seg=w[i:i+3000] if i>=0 else w
    m=re.search(r"\{\{[Ss]tart date\|(\d{4})\|(\d{1,2})\|(\d{1,2})",seg) or re.search(r"\{\{[Ss]tart date\|(\d{4})\|(\d{1,2})\|(\d{1,2})",w)
    if m: return dt.date(int(m.group(1)),int(m.group(2)),int(m.group(3)))
    m=re.search(r"date\s*=\s*(\d{1,2}) (\w+) (\d{4})",seg)
    months={m:i for i,m in enumerate(["January","February","March","April","May","June","July","August","September","October","November","December"],1)}
    if m: return dt.date(int(m.group(3)),months[m.group(2)],int(m.group(1)))
    return None
if __name__=="__main__":
    import re
    out={}
    allf=[]
    for f in sorted(glob.glob(os.path.dirname(os.path.abspath(__file__))+"/../work/batch_*.json")): allf+=json.load(open(f))
    months={m:i for i,m in enumerate(["January","February","March","April","May","June","July","August","September","October","November","December"],1)}
    for r in allf:
        date=final_date(r["article"])
        if not date: print("NODATE",r["article"]); continue
        out[r["article"]]={"date":str(date),r["team1"]:standing(r["team1"],date),r["team2"]:standing(r["team2"],date)}
        a=out[r["article"]]; t1=a[r["team1"]]; t2=a[r["team2"]]
        print(f'{r["article"][:36]:36} {date} {r["team1"][:14]:14} {t1.get("pos")}/{t1.get("played")} {t1.get("pts")} prev{t1.get("prev_season_pos")} | {r["team2"][:14]:14} {t2.get("pos")}/{t2.get("played")} {t2.get("pts")} prev{t2.get("prev_season_pos")} {t2.get("status")}')
    json.dump(out,open(os.path.dirname(os.path.abspath(__file__))+"/../work/standings.json","w"),indent=1)

import re, json, os, collections, warnings
warnings.filterwarnings("ignore")
import pandas as pd
from standings import load
FIVE={'Arsenal':'Arsenal','Chelsea':'Chelsea','Liverpool':'Liverpool','Man City':'Manchester City','Man United':'Manchester United'}
FULL={"David Ellaray":"D Elleray","Mn Atkinson":"M Atkinson","l Mason":"L Mason","D Gallagh":"D Gallagher","D Gallaghe":"D Gallagher","St Bennett":"S Bennett","O Oliver":None,"D Webb":None}
def canon(n):
    n=n.strip()
    if n in FULL: return FULL[n]
    if "," in n:
        sur,ini=[x.strip() for x in n.split(",",1)]; return f"{ini[0]} {sur}"
    parts=n.replace(".", ". ").split()
    if len(parts)>=2:
        sur=parts[-1]; first=parts[0].strip(".")
        if sur in("Gallagher",) and first.startswith("D"): return "D Gallagher"
        return f"{first[0]} {sur}"
    return n
rows=[]
for s in range(2000,2027):
    d=load(s,'E0')
    if d is None: continue
    d=d.copy(); d['season']=s
    rows.append(d)
D=pd.concat(rows)
D=D[D.Referee.notna()&(D.Referee.str.strip()!="")]
D['ref']=D.Referee.map(canon)
for c in['HY','AY','HR','AR','HF','AF']: D[c]=pd.to_numeric(D[c],errors='coerce')
recs=[]
# baseline per club-season
for fd,club in FIVE.items():
    cm=D[(D.HomeTeam==fd)|(D.AwayTeam==fd)].copy()
    home=cm.HomeTeam==fd
    cm['gf']=cm.FTHG.where(home,cm.FTAG); cm['ga']=cm.FTAG.where(home,cm.FTHG)
    cm['res']=(cm.gf>cm.ga).map({True:'W',False:''})+((cm.gf==cm.ga).map({True:'D',False:''}))
    cm.loc[cm.gf<cm.ga,'res']='L'
    cm['pts']=cm.res.map({'W':3,'D':1,'L':0})
    cm['yel_for']=cm.HY.where(home,cm.AY); cm['yel_opp']=cm.AY.where(home,cm.HY)
    cm['red_for']=cm.HR.where(home,cm.AR); cm['red_opp']=cm.AR.where(home,cm.HR)
    cm['fouls_for']=cm.HF.where(home,cm.AF); cm['fouls_opp']=cm.AF.where(home,cm.HF)
    base=cm.groupby('season').agg(bw=('res',lambda x:(x=='W').mean()),bppg=('pts','mean'),byel=('yel_for','mean'),byelo=('yel_opp','mean'))
    cm=cm.join(base,on='season')
    for ref,g in cm.groupby('ref'):
        if ref is None: continue
        recs.append(dict(referee_fd=ref,club=club,P=len(g),W=int((g.res=='W').sum()),D=int((g.res=='D').sum()),L=int((g.res=='L').sum()),
            ppg=round(g.pts.mean(),3),expected_ppg_same_seasons=round(g.bppg.mean(),3),
            win_pct=round((g.res=='W').mean()*100,1),expected_win_pct=round(g.bw.mean()*100,1),
            yellows_club_pg=round(g.yel_for.mean(),2),yellows_opp_pg=round(g.yel_opp.mean(),2),
            club_season_avg_yellows_pg=round(g.byel.mean(),2),reds_club=int(g.red_for.sum()),reds_opp=int(g.red_opp.sum()),
            seasons=f"{g.season.min()}-{(g.season.max()+1)%100:02d}"))
out=pd.DataFrame(recs)
out.to_csv(os.path.dirname(os.path.abspath(__file__))+"/../work/pl_referee_club_records.csv",index=False)
print(out[out.referee_fd.isin(["M Dean","A Taylor","M Oliver","H Webb","S Bennett","P Dowd","C Foy"])].to_string())

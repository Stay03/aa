"""Large-sample test of English referee bias against specific clubs, Premier League 2000-01..2026-27.
Outcome controls: bookmaker odds (pre-match, margin removed) -> expected points per match.
Discipline controls: club's own season-average cards; opponent cards in same match."""
import csv, glob, os, numpy as np, pandas as pd, warnings
from scipy import stats
from statsmodels.stats.multitest import multipletests
from refrecords import canon
warnings.filterwarnings("ignore")
FD=os.path.dirname(os.path.abspath(__file__))+"/../raw/footballdata/"
W=os.path.dirname(os.path.abspath(__file__))+"/../work/analysis/"
ODDS=[("AvgH","AvgD","AvgA"),("BbAvH","BbAvD","BbAvA"),("PSH","PSD","PSA"),("B365H","B365D","B365A"),("WHH","WHD","WHA"),("IWH","IWD","IWA"),("LBH","LBD","LBA"),("GBH","GBD","GBA"),("SBH","SBD","SBA")]
recs=[]
for s in range(2000,2027):
    f=FD+f"{s%100:02d}{(s+1)%100:02d}_E0.csv"
    if not os.path.exists(f): continue
    rows=list(csv.reader(open(f,encoding='latin1'))); h=[x.replace('﻿','').replace('ï»¿','') for x in rows[0]]; ix={k:i for i,k in enumerate(h) if k}
    for r in rows[1:]:
        if len(r)<6 or not r[ix['HomeTeam']]: continue
        g=lambda k: r[ix[k]] if k in ix and ix[k]<len(r) and r[ix[k]]!='' else None
        o=None
        for a,b,c in ODDS:
            try:
                o=(float(g(a)),float(g(b)),float(g(c))); break
            except: pass
        try: hg,ag=int(g('FTHG')),int(g('FTAG'))
        except: continue
        recs.append(dict(season=s,date=g('Date'),home=g('HomeTeam'),away=g('AwayTeam'),hg=hg,ag=ag,ref=canon(g('Referee')) if g('Referee') else None,
            odds=o,HY=g('HY'),AY=g('AY'),HR=g('HR'),AR=g('AR'),HF=g('HF'),AF=g('AF')))
D=pd.DataFrame(recs)
D=D[D.ref.notna()&D.odds.notna()]
for c in ['HY','AY','HR','AR','HF','AF']: D[c]=pd.to_numeric(D[c],errors='coerce')
p=np.array([[1/x for x in o] for o in D.odds]); p=p/p.sum(1,keepdims=True)
D['pH'],D['pD'],D['pA']=p[:,0],p[:,1],p[:,2]
# team-match long format
L=[]
for side in ('home','away'):
    o='away' if side=='home' else 'home'
    t=pd.DataFrame({'season':D.season,'ref':D.ref,'team':D[side],'opp':D[o],'home':side=='home',
        'gf':D.hg if side=='home' else D.ag,'ga':D.ag if side=='home' else D.hg,
        'pw':D.pH if side=='home' else D.pA,'pd':D.pD,
        'y':D.HY if side=='home' else D.AY,'yo':D.AY if side=='home' else D.HY,
        'r':D.HR if side=='home' else D.AR,'ro':D.AR if side=='home' else D.HR,
        'f':D.HF if side=='home' else D.AF,'fo':D.AF if side=='home' else D.HF})
    L.append(t)
T=pd.concat(L,ignore_index=True)
T['pts']=np.where(T.gf>T.ga,3,np.where(T.gf==T.ga,1,0))
T['xpts']=3*T.pw+T.pd
T['var']=9*T.pw+T.pd-T.xpts**2
T['res']=T.pts-T.xpts
# card expectation: team-season mean of (own yellows - opp yellows) -> residual vs that
T['ydiff']=T.y-T.yo
T['ydiff_season']=T.groupby(['team','season']).ydiff.transform('mean')
T['yres']=T.ydiff-T.ydiff_season
print("PL team-matches with odds & ref:",len(T),"seasons",T.season.min(),"-",T.season.max())
# 1) per club overall vs all refs: is residual zero? (odds calibration check)
big=['Arsenal','Chelsea','Liverpool','Man City','Man United']
out=[]
for team,g in T.groupby('team'):
    if len(g)<150: continue
    # per-ref heterogeneity: chi-square-like statistic sum over refs of (sum res)^2/sum var
    refs=g.groupby('ref').agg(n=('res','size'),obs=('pts','sum'),exp=('xpts','sum'),v=('var','sum'),yres=('yres','mean'))
    refs=refs[refs.n>=10]
    z=(refs.obs-refs.exp)/np.sqrt(refs.v)
    chi=(z**2).sum(); dfree=len(refs)
    out.append(dict(team=team,matches=len(g),pts=int(g.pts.sum()),xpts=round(g.xpts.sum(),1),pts_minus_xpts=round(g.res.sum(),1),
        refs_10plus=dfree,heterogeneity_chi2=round(chi,1),heterogeneity_p=round(1-stats.chi2.cdf(chi,dfree),4),
        worst_ref=z.idxmin(),worst_z=round(z.min(),2),best_ref=z.idxmax(),best_z=round(z.max(),2)))
H=pd.DataFrame(out).sort_values('heterogeneity_p')
H['q_bh']=multipletests(H.heterogeneity_p,method='fdr_bh')[1].round(3)
H.to_csv(W+"pl_referee_heterogeneity_by_team.csv",index=False)
print("\n== Does any team's result vs odds depend on WHICH English referee? (heterogeneity across refs with >=10 games)")
print(H[H.team.isin(big)|(H.q_bh<0.2)].to_string(index=False))
# 2) referee x club pairs for the big five
P=[]
for (team,ref),g in T[T.team.isin(big)].groupby(['team','ref']):
    if len(g)<10: continue
    z=g.res.sum()/np.sqrt(g['var'].sum())
    yz=g.yres.mean()/ (g.yres.std(ddof=1)/np.sqrt(len(g))) if g.yres.std()>0 else 0
    P.append(dict(team=team,ref=ref,matches=len(g),pts=int(g.pts.sum()),xpts=round(g.xpts.sum(),1),diff=round(g.res.sum(),1),
        ppg_diff=round(g.res.mean(),3),z=round(z,2),p=2*(1-stats.norm.cdf(abs(z))),
        yellow_diff_vs_opp_minus_season_norm=round(g.yres.mean(),2),yellow_t=round(yz,2),reds=int(g.r.sum()),reds_opp=int(g.ro.sum())))
P=pd.DataFrame(P)
P['q_bh_points']=multipletests(P.p,method='fdr_bh')[1]
P['p_cards']=2*(1-stats.t.cdf(P.yellow_t.abs(),P.matches-1))
P['q_bh_cards']=multipletests(P.p_cards,method='fdr_bh')[1]
P=P.round(4).sort_values('z')
P.to_csv(W+"pl_referee_club_pairs_vs_odds.csv",index=False)
print("\n== Big-five x referee pairs (>=10 PL games):",len(P),"| smallest q (points):",P.q_bh_points.min(),"| smallest q (cards):",P.q_bh_cards.min())
print(P[P.team=='Chelsea'].to_string(index=False))
print("\nmost negative pairs overall:"); print(P.head(8).to_string(index=False))
# 3) Chelsea overall: under refs who did finals vs others

# 4) cards per foul: does an English referee book a club more per foul than its opponents? (league-wide comparison)
C=T.dropna(subset=['y','yo','f','fo'])
C=C[(C.f>0)&(C.fo>0)]
rows=[]
lg_rate=(C.y.sum()/C.f.sum())
for team,g in C.groupby('team'):
    if len(g)<300: continue
    own=g.y.sum()/g.f.sum(); opp=g.yo.sum()/g.fo.sum()
    # Poisson comparison of yellow counts given fouls (rate ratio test)
    res=stats.binomtest(int(g.y.sum()), int(g.y.sum()+g.yo.sum()), g.f.sum()/(g.f.sum()+g.fo.sum()))
    rows.append(dict(team=team,matches=len(g),fouls=int(g.f.sum()),yellows=int(g.y.sum()),yellows_per_100_fouls=round(100*own,1),
        opp_fouls=int(g.fo.sum()),opp_yellows=int(g.yo.sum()),opp_yellows_per_100_fouls=round(100*opp,1),
        ratio=round(own/opp,3),p=res.pvalue,reds=int(g.r.sum()),opp_reds=int(g.ro.sum())))
R=pd.DataFrame(rows); R['q_bh']=multipletests(R.p,method='fdr_bh')[1]; R=R.round(4).sort_values('ratio',ascending=False)
R.to_csv(W+"pl_yellows_per_foul_by_team.csv",index=False)
print("\n== Yellows per 100 fouls, team vs its opponents (PL, English referees, matches with foul data)")
print(R.to_string(index=False))

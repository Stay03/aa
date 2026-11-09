import pandas as pd, numpy as np, warnings, io, contextlib
from scipy import stats
from statsmodels.stats.multitest import multipletests
warnings.filterwarnings("ignore")
with contextlib.redirect_stdout(io.StringIO()):
    import pl_bias as B
W=B.W
T=B.T
fdname={'Man United':'Manchester United','Man City':'Manchester City','Tottenham':'Tottenham Hotspur','Newcastle':'Newcastle United','West Ham':'West Ham United','Leicester':'Leicester City','Wigan':'Wigan Athletic','Hull':'Hull City','Stoke':'Stoke City','Birmingham':'Birmingham City','Cardiff':'Cardiff City'}
rows=[]
H=pd.read_csv(W+"pl_referee_heterogeneity_by_team.csv").set_index('team')
Y=pd.read_csv(W+"pl_yellows_per_foul_by_team.csv").set_index('team')
F=pd.read_csv(W+"english_ref_finals_by_team.csv").set_index('team')
for team,g in T.groupby('team'):
    if len(g)<150: continue
    z=g.res.sum()/np.sqrt(g['var'].sum())
    name=fdname.get(team,team)
    r=dict(team=name,pl_matches=len(g),pl_pts_minus_odds=round(g.res.sum(),1),p_results_vs_odds=2*(1-stats.norm.cdf(abs(z))),
           p_referee_heterogeneity=H.loc[team,'heterogeneity_p'] if team in H.index else np.nan,
           cards_ratio_vs_opp=Y.loc[team,'ratio'] if team in Y.index else np.nan,p_cards_per_foul=Y.loc[team,'p'] if team in Y.index else np.nan)
    if name in F.index:
        fa,fv=F.loc[name,'against'],F.loc[name,'favour']
        r.update(finals=F.loc[name,'finals'],finals_disputed_for=fv,finals_disputed_against=fa,
                 p_finals_decisions=stats.binomtest(int(fv),int(fa+fv)).pvalue if fa+fv else np.nan)
    rows.append(r)
R=pd.DataFrame(rows)
pcols=['p_results_vs_odds','p_referee_heterogeneity','p_cards_per_foul','p_finals_decisions']
allp=R[pcols].astype(float).stack().dropna()
q=pd.Series(multipletests(allp.values,method='fdr_bh')[1],index=allp.index).unstack()
for c in pcols: R[c.replace('p_','q_')]=q[c]
R['smallest_p']=R[pcols].min(1); R['smallest_q']=R[[c.replace('p_','q_') for c in pcols]].min(1)
def which(r):
    c=r[pcols].astype(float).idxmin(); return c.replace('p_','')
R['strongest_test']=R.apply(which,axis=1)
def direction(r):
    t=r.strongest_test
    if t=='results_vs_odds': return 'better than odds' if r.pl_pts_minus_odds>0 else 'worse than odds'
    if t=='cards_per_foul': return 'booked MORE per foul than opponents' if r.cards_ratio_vs_opp>1 else 'booked LESS per foul than opponents'
    if t=='finals_decisions': return 'more decisions FOR' if r.finals_disputed_for>r.finals_disputed_against else 'more decisions AGAINST'
    return 'results vary by referee' 
R['direction']=R.apply(direction,axis=1)
R=R.sort_values('smallest_p').round(4)
R.to_csv(W+"team_p_value_ranking.csv",index=False)
print(R[['team','pl_matches','strongest_test','direction','smallest_p','smallest_q','p_results_vs_odds','p_referee_heterogeneity','p_cards_per_foul','p_finals_decisions','pl_pts_minus_odds','cards_ratio_vs_opp','finals_disputed_for','finals_disputed_against']].to_string(index=False))
print("tests:",allp.size)

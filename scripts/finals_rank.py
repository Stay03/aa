"""Finals-only ranking: English teams in finals refereed by English officials."""
import pandas as pd, numpy as np, os, warnings
from scipy import stats
from statsmodels.stats.multitest import multipletests
warnings.filterwarnings("ignore")
W=os.path.dirname(os.path.abspath(__file__))+"/../work/"
f=pd.read_csv(W+"m_finals.csv"); d=pd.read_csv(W+"m_decisions.csv")
own=pd.read_json(W+"own_elo.json").T if os.path.exists(W+"own_elo.json") else None
import json; own=json.load(open(W+"own_elo.json"))
fe=f[f.referee_nationality.eq('English')].copy()
de=d[d.final_id.isin(fe.final_id)]
ERR=['officially acknowledged error','expert consensus incorrect']
def cards(s,team,kinds):
    return sum(1 for c in str(s).split('; ') if c and c.split(' ')[0] in kinds and c.endswith(f'({team})'))
def pb(pr,o):
    x=np.array([1.])
    for p in pr: x=np.convolve(x,[1-p,p])
    return float(x[x<=x[o]+1e-12].sum())
def sign(a,b): return stats.binomtest(a,a+b).pvalue if a+b else np.nan
rows=[]
for t in sorted(set(fe.team1)|set(fe.team2)):
    ff=fe[(fe.team1==t)|(fe.team2==t)]
    fav=de[de.favoured_team==t]; ag=de[de.against_team==t]
    # match level
    net=[]
    for fid,g in de[(de.favoured_team==t)|(de.against_team==t)].groupby('final_id'):
        net.append((g.favoured_team==t).sum()-(g.against_team==t).sum())
    net=np.array(net)
    lf,la=int((fav.impact=='likely').sum()),int((ag.impact=='likely').sum())
    ef,ea=int(fav.assessment.isin(ERR).sum()),int(ag.assessment.isin(ERR).sum())
    pf=int(fav.type.str.contains('penalty',na=False).sum()); pa=int(ag.type.str.contains('penalty',na=False).sum())
    rf=sum(cards(r.cards,t,['R','2Y']) for r in ff.itertuples()); ro=sum(cards(r.cards, r.team2 if r.team1==t else r.team1,['R','2Y']) for r in ff.itertuples())
    cc=ff[ff.cards_complete==True]
    yf=sum(cards(r.cards,t,['Y','2Y']) for r in cc.itertuples()); yo=sum(cards(r.cards, r.team2 if r.team1==t else r.team1,['Y','2Y']) for r in cc.itertuples())
    pr=[]; won=0
    for r in ff.itertuples():
        if r.final_id in own:
            p=own[r.final_id]['own_elo_p_team1']; pr.append(p if r.team1==t else 1-p); won+= r.winner==t
    rows.append(dict(team=t,finals=len(ff),won=int((ff.winner==t).sum()),
        disputed_for=len(fav),disputed_against=len(ag),p_disputed=sign(len(fav),len(ag)),
        finals_net_for=int((net>0).sum()),finals_net_against=int((net<0).sum()),p_match_level=sign(int((net>0).sum()),int((net<0).sum())),
        likely_impact_for=lf,likely_impact_against=la,p_likely_impact=sign(lf,la),
        judged_errors_for=ef,judged_errors_against=ea,p_judged_errors=sign(ef,ea),
        penalty_calls_for=pf,penalty_calls_against=pa,p_penalty_calls=sign(pf,pa),
        reds_received=rf,reds_opponents=ro,p_reds=sign(ro,rf),
        yellows_received=yf,yellows_opponents=yo,p_yellows=sign(yo,yf),
        elo_finals=len(pr),wins_vs_elo=f"{won}/{sum(pr):.1f}" if pr else "",p_results_vs_elo=pb(pr,won) if pr else np.nan))
R=pd.DataFrame(rows)
pc=[c for c in R.columns if c.startswith('p_')]
s=R[pc].astype(float).stack().dropna()
q=pd.Series(multipletests(s.values,method='fdr_bh')[1],index=s.index).unstack()
R['smallest_p']=R[pc].min(1); R['strongest_test']=R[pc].astype(float).idxmin(1).str[2:]
R['smallest_q']=q.min(1)
R=R.sort_values(['smallest_p','finals'],ascending=[True,False]).round(4)
R.to_csv(W+"analysis/finals_only_team_ranking.csv",index=False)
pd.set_option('display.width',300)
print(R[['team','finals','won','strongest_test','smallest_p','smallest_q','disputed_for','disputed_against','p_disputed','finals_net_for','finals_net_against','p_match_level','likely_impact_for','likely_impact_against','judged_errors_for','judged_errors_against','penalty_calls_for','penalty_calls_against','reds_received','reds_opponents','yellows_received','yellows_opponents','p_yellows','wins_vs_elo','p_results_vs_elo']].to_string(index=False))
print("tests",len(s))

"""Finals-only, English referees, NO expert/official assessments used: every disputed call counts equally."""
import pandas as pd, numpy as np, os
from scipy import stats
from statsmodels.stats.multitest import multipletests
W=os.path.dirname(os.path.abspath(__file__))+"/../work/"
f=pd.read_csv(W+"m_finals.csv"); d=pd.read_csv(W+"m_decisions.csv")
fe=f[f.referee_nationality.eq('English')]
de=d[d.final_id.isin(fe.final_id)].copy()
GROUPS={'goals (allowed/disallowed/offside)':r'goal|offside','penalties':r'penalty','red cards':r'red card','other':r'^other$'}
def sign(a,b): return stats.binomtest(a,a+b).pvalue if a+b else np.nan
rows=[]
for t in sorted(set(fe.team1)|set(fe.team2)):
    ff=fe[(fe.team1==t)|(fe.team2==t)]
    fav=de[de.favoured_team==t]; ag=de[de.against_team==t]
    r=dict(team=t,finals=len(ff),won=int((ff.winner==t).sum()),for_=len(fav),against=len(ag),net=len(fav)-len(ag),
           against_per_final=round(len(ag)/len(ff),2),p_all=sign(len(fav),len(ag)))
    net=[ (g.favoured_team==t).sum()-(g.against_team==t).sum() for _,g in de[(de.favoured_team==t)|(de.against_team==t)].groupby('final_id')]
    net=np.array(net); r.update(finals_net_for=int((net>0).sum()),finals_net_against=int((net<0).sum()),p_match=sign(int((net>0).sum()),int((net<0).sum())))
    # close-game only: disputes when score within one goal (or level) - affects result most
    def close(x):
        try:
            a,b=str(x).replace('–','-').split('-')[:2]; return abs(int(a)-int(b))<=1
        except: return True
    cf,ca=int(sum(close(x) for x in fav.score_at_time)),int(sum(close(x) for x in ag.score_at_time))
    r.update(close_game_for=cf,close_game_against=ca,p_close=sign(cf,ca))
    for k,pat in GROUPS.items():
        a1=int(fav.type.str.contains(pat,na=False).sum()); a2=int(ag.type.str.contains(pat,na=False).sum())
        r[f'{k}: for-against']=f"{a1}-{a2}"
    rows.append(r)
R=pd.DataFrame(rows).rename(columns={'for_':'for'})
pc=['p_all','p_match','p_close']
s=R[pc].astype(float).stack().dropna(); q=pd.Series(multipletests(s.values,method='fdr_bh')[1],index=s.index).unstack()
R['q_all']=q['p_all']
R=R.sort_values(['net','finals'],ascending=[True,False])
R.round(4).to_csv(W+"analysis/finals_disputed_no_expert.csv",index=False)
pd.set_option('display.width',300)
print(R.round(3).to_string(index=False))

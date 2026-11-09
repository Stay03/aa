"""All disputed decisions + every cancelled goal, finals with English referees.
Combines the census (census_out_*.json) with the earlier contested-decision research (m_decisions.csv),
de-duplicated. No expert/official verdicts are used anywhere."""
import json, glob, os, re, numpy as np, pandas as pd
from scipy import stats
from statsmodels.stats.multitest import multipletests
W=os.path.dirname(os.path.abspath(__file__))+"/../work/"
fin=pd.read_csv(W+"m_finals.csv"); fe=fin[fin.referee_nationality.eq('English')]
def mnum(m):
    m=re.findall(r"\d+",str(m)); return int(m[0]) if m else None
def cat(text):
    t=str(text).lower()
    if re.search(r"goal|offside|over the line|not over line",t): return "goal / offside"
    if "penalt" in t: return "penalty"
    if re.search(r"red|second yellow|sent off|card|booking|yellow",t): return "cards"
    return "fouls / other"
ev=[]; comp={}
for f in sorted(glob.glob(W+"census_out_*.json")):
    for x in json.load(open(f)):
        comp[x['final_id']]=x.get('census_complete')
        for e in x.get('events') or []:
            et=e.get('event_type'); disputed = et in ('disputed decision',) or e.get('disputed') or et=='goal disallowed' or et in ('goal awarded after review','penalty overturned','red card overturned','other VAR intervention')
            if not disputed and et in ('penalty awarded','red card'):
                kind='neutral event'
            else: kind='disputed/cancelled'
            c = "goal cancelled" if et=='goal disallowed' else cat((e.get('decision') or '')+' '+(et or '')+' '+(e.get('reason') or ''))
            ev.append(dict(final_id=x['final_id'],minute=e.get('minute'),m=mnum(e.get('minute')),score=e.get('score_at_time'),
                event_type=et,decision=e.get('decision') or et,category=c,kind=kind,benefiting=e.get('team_benefiting'),against=e.get('team_against'),
                decided_by=e.get('decided_by'),reason=e.get('reason'),description=e.get('description'),
                disputed_by=e.get('disputed_by') or e.get('dispute_note'),sources=" | ".join(e.get('sources') or []),origin='census'))
C=pd.DataFrame(ev)
# add earlier contested decisions not already in census
d=pd.read_csv(W+"m_decisions.csv"); d=d[d.final_id.isin(fe.final_id)]
add=0
for r in d.itertuples():
    m=mnum(r.minute)
    same=C[(C.final_id==r.final_id)&(C.against==r.against_team)&(C.kind=='disputed/cancelled')]
    dup=False
    for s in same.itertuples():
        if (m is not None and s.m is not None and abs(m-s.m)<=3) or (m is None and cat(r.type)==s.category): dup=True;break
    if dup: continue
    add+=1
    ev.append(dict(final_id=r.final_id,minute=r.minute,m=m,score=r.score_at_time,event_type='disputed decision (earlier research)',decision=r.type,
        category="goal cancelled" if r.type=='goal disallowed' else cat(r.type),kind='disputed/cancelled',benefiting=r.favoured_team,against=r.against_team,
        decided_by=None,reason=None,description=r.description,disputed_by=None,sources=r.sources,origin='earlier research'))
A=pd.DataFrame(ev)
A=A[A.final_id.isin(fe.final_id)]
A.to_csv(W+"analysis/all_disputed_events_english_ref_finals.csv",index=False)
D=A[A.kind=='disputed/cancelled']; N=A[A.kind=='neutral event']
def sign(a,b): return stats.binomtest(a,a+b).pvalue if a+b else np.nan
rows=[]
cats=["goal cancelled","goal / offside","penalty","cards","fouls / other"]
for t in sorted(set(fe.team1)|set(fe.team2)):
    ff=fe[(fe.team1==t)|(fe.team2==t)]
    fv=D[D.benefiting==t]; ag=D[D.against==t]
    r=dict(team=t,finals=len(ff),won=int((ff.winner==t).sum()),
           finals_with_full_report=int(sum(bool(comp.get(x)) for x in ff.final_id)),
           disputed_for=len(fv),disputed_against=len(ag),net=len(fv)-len(ag),against_per_final=round(len(ag)/len(ff),2),p=sign(len(fv),len(ag)))
    net=np.array([(g.benefiting==t).sum()-(g.against==t).sum() for _,g in D[(D.benefiting==t)|(D.against==t)].groupby('final_id')])
    r.update(finals_net_for=int((net>0).sum()),finals_net_against=int((net<0).sum()),p_match=sign(int((net>0).sum()),int((net<0).sum())))
    for c in cats: r[f"{c} (for-against)"]=f"{int((fv.category==c).sum())}-{int((ag.category==c).sum())}"
    r["goals cancelled against"]=int((ag.category=='goal cancelled').sum())
    r["penalties awarded for-against (all)"]=f"{int(((A.benefiting==t)&A.event_type.eq('penalty awarded')).sum())}-{int(((A.against==t)&A.event_type.eq('penalty awarded')).sum())}"
    r["red cards received-opp (all)"]=f"{int(((A.against==t)&A.event_type.eq('red card')).sum())}-{int(((A.benefiting==t)&A.event_type.eq('red card')).sum())}"
    rows.append(r)
R=pd.DataFrame(rows)
s=R[['p','p_match']].astype(float).stack().dropna(); q=pd.Series(multipletests(s.values,method='fdr_bh')[1],index=s.index).unstack()
R['q']=q['p']; R=R.sort_values(['net','finals'],ascending=[True,False]).round(4)
R.to_csv(W+"analysis/all_disputed_ranking_english_ref_finals.csv",index=False)
pd.set_option('display.width',320)
print("events:",len(A),"disputed/cancelled:",len(D),"added from earlier research:",add)
print(R.to_string(index=False))

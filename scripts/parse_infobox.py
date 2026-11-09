import mwparserfromhell as mw, os, re, json, sys
D=os.path.dirname(os.path.abspath(__file__))+"/../raw/wiki/"
FIVE=["Arsenal","Chelsea","Liverpool","Manchester City","Manchester United"]
def clean(v):
    if v is None: return ""
    c=mw.parse(str(v))
    for t in c.filter_templates(recursive=False):
        n=str(t.name).strip().lower()
        if n in("efn","refn","ref","citation needed"): 
            try:c.remove(t)
            except:pass
    s=c.strip_code().strip()
    s=re.sub(r"<ref.*?</ref>|<ref[^>]*/>","",s,flags=re.S)
    return re.sub(r"\s+"," ",s).strip()
def box(title):
    fn=D+title.replace("/","_")+".wikitext"
    if not os.path.exists(fn): return None
    w=mw.parse(open(fn).read())
    out=[]
    for t in w.filter_templates():
        if str(t.name).strip().lower().startswith("infobox football match"):
            d={}
            for p in t.params: d[str(p.name).strip()]=p.value
            out.append(d)
    return out
if __name__=="__main__":
    rows=[]
    for f in sorted(os.listdir(D)):
        title=f[:-9]
        if title.startswith("List") or not re.match(r"(19|20)\d\d ",title): continue
        b=box(title) or []
        for d in b:
            t1=clean(d.get("team1")); t2=clean(d.get("team2"))
            if any(c==t1 or c==t2 or t1.startswith(c+" ") and False for c in FIVE) or any(c in (t1,t2) for c in FIVE):
                rows.append(dict(article=title,team1=t1,team2=t2,s1=clean(d.get("team1score")),s2=clean(d.get("team2score")),
                    date=clean(d.get("date")),venue=clean(d.get("stadium")),city=clean(d.get("city")),referee=clean(d.get("referee")),
                    details=clean(d.get("details")),att=clean(d.get("attendance")),motm=clean(d.get("man_of_the_match") or d.get("man_of_the_match1"))))
    json.dump(rows,open("/tmp/finals_wiki.json","w"),indent=1)
    for r in rows: print(f"{r['article'][:42]:42}|{r['team1'][:18]:18}|{r['s1'][:12]:12}|{r['s2'][:12]:12}|{r['team2'][:20]:20}|{r['date'][:20]:20}|{r['referee'][:30]}")
    print(len(rows))

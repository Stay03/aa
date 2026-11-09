import mwparserfromhell as mw, re, json, os
from parse_infobox import clean, box, D
FIVE=["Arsenal","Chelsea","Liverpool","Manchester City","Manchester United"]
def link_text(s):
    return clean(s)
def find_fbox(text):
    w=mw.parse(text)
    for t in w.filter_templates():
        n=str(t.name).strip().lower()
        if n in ("football box","footballbox","football box collapsible","footballbox collapsible") or n.startswith("#invoke:football box") or n.startswith("#invoke:footballbox"):
            return t
    return None
def parse_goals(val):
    out=[]
    if val is None: return out
    for line in re.split(r"\n\*|\n|<br\s*/?>",str(val)):
        if "{{goal" not in line.lower() and "{{pengoal" not in line.lower(): continue
        p=mw.parse(line)
        name=""
        for l in p.filter_wikilinks():
            name=str(l.text or l.title).strip(); break
        if not name: name=re.sub(r"\{\{.*","",p.strip_code()).strip("* ")
        for t in p.filter_templates():
            if str(t.name).strip().lower()=="goal":
                args=[str(a.value).strip() for a in t.params if not str(a.name).strip().isalpha()]
                i=0
                while i<len(args):
                    m=args[i]; note=args[i+1] if i+1<len(args) else ""
                    if m: out.append({"player":name,"minute":m,"note":note})
                    i+=2
    return out
def minute_val(m):
    m=m.replace("'","").strip()
    if "+" in m:
        a,b=m.split("+",1); return int(re.sub(r"\D","",a) or 0), int(re.sub(r"\D","",b) or 0)
    return int(re.sub(r"\D","",m) or 0),0
def cleanm(r):
    r=re.sub(r'colspan="?\d"?\s*\|','',r)
    r=r.split('\n|}')[0]
    return clean(r).strip('|} ').strip()
def lineup_tables(text, start):
    # tables after football box containing Manager
    seg=text[start:start+40000]
    tables=re.findall(r"\{\|.*?\n\|\}",seg,flags=re.S)
    res=[]
    for tb in tables:
        if "Manager" in tb or "Head coach" in tb or "Coach:" in tb:
            res.append(tb)
        if len(res)==2: break
    return res
def parse_lineup(tb):
    players=[];cards=[];manager=""
    rows=re.split(r"\n\|-",tb)
    mgr_next=False
    for r in rows:
        if re.search(r"Manager|Head coach|Coach:",r):
            mgr_next=True
            # manager may be in same row
            after=re.split(r"Manager:?'*|Head coach:?'*|Coach:?'*",r)[-1]
            if "[[" in after: manager=cleanm(after); mgr_next=False
            continue
        if mgr_next and "[[" in r:
            manager=cleanm(r); mgr_next=False; continue
        p=mw.parse(r)
        links=[l for l in p.filter_wikilinks() if not str(l.title).startswith(("File:","Image:"))]
        if not links: continue
        name=str(links[0].text or links[0].title).split("(")[0].strip() if links[0].text is None else str(links[0].text).strip()
        for t in p.filter_templates():
            n=str(t.name).strip().lower()
            if n in("yel","yellow card","yc"):
                for a in t.params:
                    if str(a.value).strip(): cards.append({"player":name,"type":"Y","minute":str(a.value).strip()})
            if n in("sent off","sentoff","red card","rc","second yellow"):
                vals=[str(a.value).strip() for a in t.params]
                kind="R"
                if n=="second yellow": kind="2Y"
                elif n in("sent off","sentoff") and vals and vals[0]!="0": kind="2Y"
                mins=vals[1:] if n in("sent off","sentoff") else vals
                cards.append({"player":name,"type":kind,"minute":",".join(m for m in mins if m)})
    return manager,cards
def officials(text):
    o={}
    pats={"assistants":r"Assistant referees?","fourth":r"Fourth official","fifth":r"(?:Fifth official|Reserve assistant referee)","var":r"Video assistant referees?\]?\]?'*:?'*(?!.*Assistant)","avar":r"Assistant video assistant referees?","aar":r"Additional assistant referees?"}
    m=re.search(r"'''\[\[Assistant referee.*?(?:\n\|style|\n\|\}|Match rules)",text,flags=re.S)
    if not m: m=re.search(r"Assistant referees?:.*?(?:\n\|style|\n\|\}|Match rules)",text,flags=re.S)
    if not m: return o
    blk=m.group(0)
    parts=re.split(r"'''",blk)
    cur=None
    for p in parts:
        pc=clean(p)
        low=pc.lower()
        if low.endswith(":") or (len(low)<80 and any(k in low for k in["assistant referee","fourth official","video assistant","fifth official","additional assistant","reserve","offside video"])) and ":" in pc[-2:]:
            cur=pc.rstrip(":"); continue
        if cur and pc.strip():
            names=[clean(x) for x in re.split(r"<br\s*/?>",p) if clean(x)]
            o[cur]="; ".join(names)
            cur=None
    return o
def stats(text):
    m=re.search(r"===\s*Statistics\s*===(.*?)(?:\n==[^=]|\Z)",text,flags=re.S)
    if not m: return {}
    blk=m.group(1)
    tables=re.findall(r"\{\|.*?\n\|\}",blk,flags=re.S)
    tb=None
    for t in tables:
        cap=re.search(r"\|\+(.*)",t)
        if cap and re.search(r"Overall|Full|Total|Match",cap.group(1),re.I): tb=t
    if tb is None and tables: tb=tables[-1] if len(tables)!=3 else tables[2]
    if tb is None: return {}
    out={}
    for r in re.split(r"\n\|-",tb):
        mm=re.search(r"!\s*(?:scope=\"?row\"?\s*\|)?\s*([^\n|]+)\n\|\s*([^\n]+)\n\|\s*([^\n]+)",r)
        if mm: out[clean(mm.group(1))]=(clean(mm.group(2)),clean(mm.group(3)))
    return out
def extract(title):
    text=open(D+title.replace("/","_")+".wikitext").read()
    fb=find_fbox(text)
    rec={"article":title}
    if fb is None: rec["error"]="no football box"; return rec
    g=lambda k: fb.get(k).value if fb.has(k) else None
    rec["fb_date"]=clean(g("date")); rec["team1"]=clean(g("team1")); rec["team2"]=clean(g("team2"))
    rec["score_raw"]=clean(g("score")); rec["aet"]=clean(g("aet")) if fb.has("aet") else ""
    rec["penaltyscore"]=clean(g("penaltyscore")) if fb.has("penaltyscore") else ""
    rec["goals1"]=parse_goals(g("goals1")); rec["goals2"]=parse_goals(g("goals2"))
    rec["stadium"]=clean(g("stadium")); rec["attendance"]=clean(g("attendance")); rec["referee"]=clean(g("referee"))
    rec["penalties1"]=clean(g("penalties1")) if fb.has("penalties1") else ""; rec["penalties2"]=clean(g("penalties2")) if fb.has("penalties2") else ""
    rec["report"]=str(g("report") or "").strip()
    pos=text.find(str(fb))+len(str(fb))
    lts=lineup_tables(text,pos)
    if len(lts)==2:
        rec["manager1"],rec["cards1"]=parse_lineup(lts[0]); rec["manager2"],rec["cards2"]=parse_lineup(lts[1])
    else: rec["lineup_error"]=f"found {len(lts)} tables"
    rec["officials"]=officials(text[pos:])
    rec["stats"]=stats(text)
    rec["var_mentioned"]=bool(re.search(r"[Vv]ideo assistant referee",text[pos:pos+60000]))
    rec["glt_mentioned"]=bool(re.search(r"[Gg]oal[- ]line technology",text))
    return rec
if __name__=="__main__":
    import sys
    titles=[r["article"] for r in json.load(open("/tmp/finals_wiki.json"))]+["2005 FIFA Club World Championship final"]
    allr=[extract(t) for t in titles]
    json.dump(allr,open(os.path.dirname(os.path.abspath(__file__))+"/../work/wiki_extract.json","w"),indent=1,ensure_ascii=False)
    for r in allr:
        print(r["article"][:38].ljust(38), r.get("score_raw","")[:14].ljust(14), len(r.get("goals1",[])),len(r.get("goals2",[])), "|",r.get("manager1","?")[:18],"|",r.get("manager2","?")[:18],"| cards",len(r.get("cards1",[]))+len(r.get("cards2",[])) if "cards1" in r else r.get("lineup_error"), "| off",len(r.get("officials",{})),"| st",len(r.get("stats",{})))

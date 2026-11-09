import sys, json, time, urllib.request, urllib.parse, os
UA = "FinalsDatasetResearch/1.0 (sports research; python urllib)"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "raw", "wiki")
def fn(t): return os.path.join(OUT, t.replace("/", "_") + ".wikitext")
def fetch(titles):
    titles=[t for t in titles if not os.path.exists(fn(t))]
    res={}
    for i in range(0,len(titles),20):
        chunk=titles[i:i+20]
        q=urllib.parse.urlencode({"action":"query","prop":"revisions","rvprop":"content","rvslots":"main","titles":"|".join(chunk),"format":"json","redirects":1,"formatversion":2})
        for attempt in range(8):
            try:
                req=urllib.request.Request("https://en.wikipedia.org/w/api.php?"+q,headers={"User-Agent":UA})
                d=json.load(urllib.request.urlopen(req,timeout=90)); break
            except Exception as e:
                print("retry",e,file=sys.stderr); time.sleep(10*(attempt+1))
        else: print("FAILED chunk",chunk); continue
        rmap={}
        for r in d["query"].get("redirects",[])+d["query"].get("normalized",[]): rmap[r["to"]]=r["from"]
        for p in d["query"]["pages"]:
            t=p["title"]; orig=t
            while orig in rmap: orig=rmap[orig]
            if p.get("missing"): print("MISSING",orig); continue
            txt=p["revisions"][0]["slots"]["main"]["content"]
            open(fn(orig),"w").write(txt)
            if orig!=t: open(fn(t),"w").write(txt)
            print("OK",orig,len(txt))
        time.sleep(3)
if __name__=="__main__":
    fetch([l.strip() for l in open(sys.argv[1]) if l.strip()] if len(sys.argv)==2 and os.path.exists(sys.argv[1]) else sys.argv[1:])

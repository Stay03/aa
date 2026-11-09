import sys, json, time, urllib.request, urllib.parse, os
UA = "FinalsDatasetResearch/1.0 (sports research; python urllib)"
OUT = os.path.join(os.path.dirname(__file__), "..", "raw", "wiki")
def get(title, force=False):
    fn = os.path.join(OUT, title.replace("/", "_") + ".wikitext")
    if os.path.exists(fn) and not force:
        return open(fn).read()
    q = urllib.parse.urlencode({"action":"parse","page":title,"prop":"wikitext","format":"json","redirects":1})
    for attempt in range(6):
        try:
            req = urllib.request.Request("https://en.wikipedia.org/w/api.php?"+q, headers={"User-Agent":UA})
            d = json.load(urllib.request.urlopen(req, timeout=60))
            if "error" in d:
                print("ERR", title, d["error"].get("info"), file=sys.stderr); return None
            t = d["parse"]["wikitext"]["*"]
            open(fn,"w").write(t); time.sleep(1.0); return t
        except Exception as e:
            print("retry", title, e, file=sys.stderr); time.sleep(5*(attempt+1))
    return None
if __name__ == "__main__":
    for t in sys.argv[1:]:
        r = get(t); print(t, "OK" if r else "FAIL", len(r or ""))

import re,glob,os
D=os.path.dirname(os.path.abspath(__file__))+"/../raw/wiki/"
clubs={"Arsenal":r"Arsenal F\.C\.","Chelsea":r"Chelsea F\.C\.","Liverpool":r"Liverpool F\.C\.","Manchester City":r"Manchester City F\.C\.","Manchester United":r"Manchester United F\.C\."}
files=["List of FA Cup finals","List of EFL Cup finals","List of FA Community Shield matches","List of European Cup and UEFA Champions League finals","List of UEFA Cup and Europa League finals","List of UEFA Cup Winners' Cup finals","List of UEFA Super Cup matches","List of FIFA Club World Cup finals","UEFA Conference League"]
seen=set()
for f in files:
    t=open(D+f+".wikitext").read()
    for row in re.split(r"\n\|-",t):
        cs=[c for c,p in clubs.items() if re.search(r"\[\["+p,row)]
        if not cs: continue
        links=re.findall(r"\[\[((?:19|20)\d\d[^\]|]*?(?:[Ff]inal|Shield|Super Cup|Club World (?:Championship|Cup)))",row)
        yrs=[l for l in links if 1996<=int(l[:4])<=2026]
        if not yrs: continue
        key=(f,yrs[0])
        if key in seen: continue
        seen.add(key)
        print(f"{f[:30]:30} | {yrs[0]:45} | {', '.join(cs)}")

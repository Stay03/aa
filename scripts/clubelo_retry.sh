#!/bin/bash
cd /home/user/aa/raw/clubelo
for i in $(seq 1 40); do
  ok=1
  for c in Arsenal Chelsea Liverpool ManCity ManUnited; do
    [ -s $c.csv ] && grep -q "^Rank" $c.csv && continue
    curl -sS -m 60 "http://api.clubelo.com/$c" -o $c.csv.tmp && grep -q "^Rank" $c.csv.tmp && mv $c.csv.tmp $c.csv || ok=0
  done
  [ $ok = 1 ] && echo "all ok" && exit 0
  sleep 60
done
echo "gave up"

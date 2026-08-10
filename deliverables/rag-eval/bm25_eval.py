#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""BM25(어휘 랭킹) 채점 + 키워드 베이스라인 비교. 순수 파이썬, 외부 의존성 없음.
한국어 토크나이저: 단어 + 문자 바이그램(형태소 분석기 없이 부분매칭까지 커버)."""
import json, csv, math, re
from collections import Counter, defaultdict

LAT, LNG = 33.2124518, 126.2598287
def hav(la, ln):
    r=6371000; p1,p2=math.radians(LAT),math.radians(la); dp=math.radians(la-LAT); dl=math.radians(ln-LNG)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return round(r*2*math.atan2(math.sqrt(a),math.sqrt(1-a)))

STOP=set("나 너 지금 근처 여기 있어 있나 있을까 어디 어디야 뭐 좀 거 데 뭔가 하고 하려고 해줘 알려줘 볼 만한 같은 걸 게 왔는데 왔어 밤 아직 문 열두 시 넘었는데".split())
def tok(s):
    s=s.lower()
    words=[w for w in re.split(r"[\s,?!.~·&()/]+", s) if w and w not in STOP]
    grams=[]
    for w in words:
        w2=re.sub(r"[^0-9a-z가-힣]","",w)
        if len(w2)>=2:
            grams+=[w2[i:i+2] for i in range(len(w2)-1)]
        elif w2:
            grams.append(w2)
    return words+grams

class BM25:
    def __init__(self, docs, k1=1.5, b=0.75):
        self.docs=[tok(d) for d in docs]; self.N=len(self.docs)
        self.k1=k1; self.b=b
        self.len=[len(d) for d in self.docs]; self.avg=sum(self.len)/max(self.N,1)
        df=Counter()
        for d in self.docs:
            for t in set(d): df[t]+=1
        self.idf={t: math.log(1+(self.N-n+0.5)/(n+0.5)) for t,n in df.items()}
        self.tf=[Counter(d) for d in self.docs]
    def score(self, q, i):
        qs=tok(q); s=0.0; dl=self.len[i]
        for t in qs:
            if t not in self.idf: continue
            f=self.tf[i][t]
            if not f: continue
            s+=self.idf[t]*(f*(self.k1+1))/(f+self.k1*(1-self.b+self.b*dl/self.avg))
        return s
    def topk(self, q, k=3):
        sc=[(self.score(q,i),i) for i in range(self.N)]
        sc=[x for x in sc if x[0]>0]; sc.sort(key=lambda x:-x[0]); return sc[:k]

pois=list(csv.DictReader(open("data/guesthouse_pois.csv",encoding="utf-8")))
for p in pois: p["dist"]=hav(float(p["lat"]),float(p["lng"]))
faqs=list(csv.DictReader(open("data/bucket_jeju_guesthouse_faq.csv",encoding="utf-8")))
poi_docs=[f"{p['name']} {p.get('description','')} {p.get('category_norm','')} {p.get('category_raw','')}" for p in pois]
faq_docs=[f"{f.get('question','')} {f.get('answer','')} {f.get('keywords','')}" for f in faqs]
poi_bm=BM25(poi_docs); faq_bm=BM25(faq_docs)
ev=json.load(open("bucket-jeju-rag-eval.json",encoding="utf-8"))["eval_set"]

def eval_bm25():
    tot=defaultdict(int); hit=defaultdict(int); t1n=t1h=0; bad=[]
    for e in ev:
        typ=e["type"]; q=e["question"]; exp=e["expected"]; tot[typ]+=1
        if typ=="poi":
            res=poi_bm.topk(q,10)
            # 재랭킹: BM25 상위후보 → 거리 가까운 순(혼밥 all True)
            cand=[pois[i] for _,i in res][:6]
            cand=sorted(cand, key=lambda p:p["dist"])[:3]
            names=[p["name"] for p in cand]
            ok=any(s in names for s in exp["sources"]); hit[typ]+= ok
            if exp.get("top1"): 
                t1n+=1; t1h+= (exp["top1"] in names[:1])
            if not ok: bad.append((e["id"],typ,q,names))
        elif typ=="faq":
            res=faq_bm.topk(q,3); ids=[faqs[i]["id"] for _,i in res]
            ok=any(s in ids for s in exp["sources"]); hit[typ]+= ok
            if not ok: bad.append((e["id"],typ,q,ids))
        else:
            pmax=(poi_bm.topk(q,1) or [(0,0)])[0][0]; fmax=(faq_bm.topk(q,1) or [(0,0)])[0][0]
            fell=(pmax<2.0 and fmax<2.0); hit[typ]+= fell
            if not fell: bad.append((e["id"],typ,q,[f"poi={pmax:.1f}",f"faq={fmax:.1f}"]))
    return tot,hit,t1n,t1h,bad

tot,hit,t1n,t1h,bad=eval_bm25()
print("="*64); print(" BM25(어휘 랭킹) 채점 결과"); print("="*64)
lab={"poi":"근처 장소(POI) Recall@3","faq":"게스트하우스 FAQ Recall@3","out_of_scope":"범위밖 폴백 정확도"}
allh=alln=0
for t in ["poi","faq","out_of_scope"]:
    if tot[t]: allh+=hit[t]; alln+=tot[t]; print(f"  {lab[t]:26s}: {hit[t]:2d}/{tot[t]:2d} ({100*hit[t]/tot[t]:5.1f}%)")
print(f"  {'POI Top-1 재랭킹 정확도':26s}: {t1h:2d}/{t1n:2d} ({100*t1h/max(t1n,1):5.1f}%)")
print("-"*64); print(f"  {'전체 평균':26s}: {allh:2d}/{alln:2d} ({100*allh/max(alln,1):5.1f}%)")
print("="*64)
print(" 오답 상세:")
if bad:
    for _id,typ,q,got in bad: print(f"  [{_id}·{typ}] \"{q}\" → {got}")
else: print("  (없음)")

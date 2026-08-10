#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
버킷 제주 RAG 평가셋 채점기.
- mode=offline : 임베딩 없이 키워드 매칭 + (혼밥/거리) 재랭킹 베이스라인. API키 불필요, 어디서나 실행.
- mode=rag     : backend/services/rag_service.py 의 실제 임베딩 파이프라인 사용(OPENAI_API_KEY + ChromaDB 필요).
사용:  python rag_eval_runner.py --eval bucket-jeju-rag-eval.json --mode offline
"""
import json, csv, argparse, math, re

LAT, LNG = 33.2124518, 126.2598287
def hav(la, ln):
    r=6371000; p1,p2=math.radians(LAT),math.radians(la); dp=math.radians(la-LAT); dl=math.radians(ln-LNG)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return round(r*2*math.atan2(math.sqrt(a),math.sqrt(1-a)))

CAT_KEYS = {  # 질문 의도 → POI category_norm 힌트
 "음식점": ["밥","밥집","맛집","먹","식당","해장국","곱창","회","해산물","짜장","중국","곰탕","국물","가정식","백반","배고","곰창","양곱창","수산"],
 "편의시설": ["편의점","편의","사게","사려","낚시","간식","생필품"],
 "관광/문화": ["해변","바다","구경","관광","거리","볼","산책","풍경"],
 "주차장": ["주차","차 대","주차장","차를"],
 "기타": ["역사","전시","기념관","자료"],
}
def toks(s): return [t for t in re.split(r"[\s,?!.~·]+", s) if t]

def load_pois(p):
    out=[]
    for r in csv.DictReader(open(p, encoding="utf-8")):
        r["dist"]=hav(float(r["lat"]),float(r["lng"]))
        r["solo"]= (r.get("solo_friendly","").strip().lower()=="true")
        out.append(r)
    return out
def load_faq(p): return list(csv.DictReader(open(p, encoding="utf-8")))

def score_poi(q, poi):
    text = f"{poi['name']} {poi.get('description','')} {poi.get('category_norm','')}"
    s = 0
    for t in toks(q):
        if len(t)>=2 and t in text: s += 2
    for cat, kws in CAT_KEYS.items():
        if poi.get("category_norm")==cat and any(k in q for k in kws): s += 3
    # 이름/메뉴 고유 키워드 직접 매칭 가산
    for kw in ["해장국","곱창","곰탕","중국","낚시","해변"]:
        if kw in q and kw in text: s += 4
    return s

def retrieve_poi(q, pois, k=3):
    cand=[(score_poi(q,p),p) for p in pois]
    cand=[c for c in cand if c[0]>0]
    # 파이프라인 재랭킹: 점수 desc → solo(True 우선) → 거리 asc
    cand.sort(key=lambda c:(-c[0], not c[1]["solo"], c[1]["dist"]))
    return cand[:k]

def score_faq(q, f):
    hay = f"{f.get('question','')} {f.get('answer','')} {f.get('keywords','')}"
    s=0
    for t in toks(q):
        if len(t)>=2 and t in hay: s+=2
    for kw in ["와이파이","비번","자전거","수건","술","음주","세탁","담배","흡연","과자","드라이기","쓰레기","약","코워킹","주방","정수기","냉장고"]:
        if kw in q and kw in hay: s+=4
    return s
def retrieve_faq(q, faqs, k=3):
    cand=[(score_faq(q,f),f) for f in faqs]
    cand=[c for c in cand if c[0]>0]
    cand.sort(key=lambda c:-c[0])
    return cand[:k]

def run_offline(eval_set, pois, faqs, fallback_thr=3):
    rows=[]
    for e in eval_set:
        typ=e["type"]; q=e["question"]; exp=e["expected"]
        if typ=="poi":
            res=retrieve_poi(q,pois); names=[p["name"] for _,p in res]
            hit=any(s in names for s in exp["sources"])
            top1_ok = (exp.get("top1") in (names[:1])) if exp.get("top1") else None
            rows.append((e["id"],typ,q,hit,top1_ok,names))
        elif typ=="faq":
            res=retrieve_faq(q,faqs); ids=[f["id"] for _,f in res]
            hit=any(s in ids for s in exp["sources"])
            rows.append((e["id"],typ,q,hit,None,ids))
        else: # out_of_scope → 폴백이 정답: 인/FAQ 모두 임계 미만이면 correct
            pmax=max([score_poi(q,p) for p in pois]+[0]); fmax=max([score_faq(q,f) for f in faqs]+[0])
            fell_back = (pmax<fallback_thr+2 and fmax<fallback_thr+2)
            rows.append((e["id"],typ,q,fell_back,None,[f"poi_max={pmax}",f"faq_max={fmax}"]))
    return rows

def report(rows):
    from collections import defaultdict
    tot=defaultdict(int); hit=defaultdict(int); t1n=0; t1h=0
    for _id,typ,q,ok,t1,_ in rows:
        tot[typ]+=1; hit[typ]+= (1 if ok else 0)
        if t1 is not None: t1n+=1; t1h+= (1 if t1 else 0)
    print("="*68); print(" 버킷 제주 RAG 평가 — 오프라인 베이스라인(키워드+거리·재랭킹)"); print("="*68)
    label={"poi":"근처 장소(POI) Recall@3","faq":"게스트하우스 FAQ Recall@3","out_of_scope":"범위밖 폴백 정확도"}
    allh=alln=0
    for typ in ["poi","faq","out_of_scope"]:
        if tot[typ]:
            allh+=hit[typ]; alln+=tot[typ]
            print(f"  {label[typ]:28s}: {hit[typ]:2d}/{tot[typ]:2d}  ({100*hit[typ]/tot[typ]:5.1f}%)")
    print(f"  {'POI Top-1 재랭킹 정확도':28s}: {t1h:2d}/{t1n:2d}  ({100*t1h/max(t1n,1):5.1f}%)")
    print("-"*68)
    print(f"  {'전체 평균':28s}: {allh:2d}/{alln:2d}  ({100*allh/max(alln,1):5.1f}%)")
    print("="*68)
    print(" 오답/폴백실패 상세:")
    any_bad=False
    for _id,typ,q,ok,t1,got in rows:
        if not ok:
            any_bad=True; print(f"  [{_id}·{typ}] \"{q}\"  → 검색:{got}")
    if not any_bad: print("  (없음 — 전 문항 통과)")

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--eval",default="bucket-jeju-rag-eval.json")
    ap.add_argument("--pois",default="data/guesthouse_pois.csv")
    ap.add_argument("--faq",default="data/bucket_jeju_guesthouse_faq.csv")
    ap.add_argument("--mode",default="offline",choices=["offline","rag"])
    a=ap.parse_args()
    ev=json.load(open(a.eval,encoding="utf-8"))["eval_set"]
    if a.mode=="offline":
        rows=run_offline(ev, load_pois(a.pois), load_faq(a.faq))
        report(rows)
    else:
        print("mode=rag: backend/services/rag_service.py 의 RAGService.search()를 import해 동일 채점하세요. (OPENAI_API_KEY+ChromaDB 필요)")

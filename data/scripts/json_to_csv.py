import json
import pandas as pd

# JSON 읽기
with open('data/processed/guesthouse_pois.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# DataFrame으로 변환
df = pd.DataFrame(data)

# 컬럼명 매핑 + 카테고리 정규화
df = df.rename(columns={
    'id': 'poi_id',
    'latitude': 'lat',
    'longitude': 'lng',
    'category': 'category_raw'
})

# category_norm 추가 (카테고리 통합)
def normalize_category(raw_cat):
    if raw_cat == 'restaurant':
        return '음식점'
    elif raw_cat in ['attraction', 'culture']:     
        return '관광/문화'
    elif raw_cat in ['convenience_store', 'pharmacy']:
        return '편의시설'
    elif raw_cat == 'parking':
        return '주차장' 
    else:
        return '기타'

df['category_norm'] = df['category_raw'].apply(normalize_category)

# 컬럼 순서 정렬 (build_index.py 기대 순서)
df = df[['poi_id', 'name', 'category_raw', 'category_norm', 'lat', 'lng', 
         'nearest_stop_name', 'stop_lat', 'stop_lng', 'source', 'description']]

# CSV 저장
df.to_csv('data/processed/guesthouse_pois.csv', index=False, encoding='utf-8')
print(f'변환 완료: {len(df)}건')
print(df.head())
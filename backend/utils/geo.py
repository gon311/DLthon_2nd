"""
공용 지리 계산 모듈.
동일한 거리 계산 결과를 보장하기 위해 이 함수 하나를 공유한다. 각자 하버사인 공식을 복제하지 말 것.

숙소 좌표(LODGING_LAT/LODGING_LNG)도 여기서 단일 정의하여 동일 값을 참조하도록 한다.
"""

import math
import os

# 카카오맵 기준 "제주 버킷" 경도 및 위도 
LODGING_LAT = float(os.environ["LODGING_LAT"])
LODGING_LNG = float(os.environ["LODGING_LNG"])



def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """두 좌표 간 거리(m)를 계산한다."""
    r = 6371000  # 지구 반지름(m)
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def distance_from_lodging_m(lat: float, lng: float) -> int:
    """숙소(1곳 고정) 기준 거리를 반환한다."""
    return haversine_m(LODGING_LAT, LODGING_LNG, lat, lng)

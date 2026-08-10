"""Bucket Jeju M3 Streamlit frontend.

Kakao Maps JavaScript SDK is used only for map rendering and nearby-place
discovery. Never put Kakao REST API keys or Admin keys in this file.
"""

from __future__ import annotations

import html
import json
import os

import streamlit as st
import streamlit.components.v1 as components

from api_client import fetch_joins


BUCKET_JEJU = {
    "name": "버킷 제주",
    "address": "제주특별자치도 서귀포시 대정읍 하모백사로14번길 1",
    "lat": 33.2124518,
    "lng": 126.2598287,
}
SEARCH_RADIUS_METERS = 2_000


st.set_page_config(page_title="버킷 제주", page_icon="🍊", layout="wide")

page = st.sidebar.radio("메뉴", ("주변 2km 지도", "투숙객 Join"))
if page == "투숙객 Join":
    st.title("🍊 버킷 제주 투숙객 Join")
    st.caption("가상 투숙객 30명과 Join 30건으로 구성된 합성 테스트 데이터입니다.")
    filter_col, status_col = st.columns(2)
    with filter_col:
        keyword_filter = st.text_input("키워드", placeholder="식사, 산책, 사진…")
    with status_col:
        status_filter = st.selectbox("모집 상태", ("전체", "모집중", "모집완료", "일정완료"))
    join_items, data_source = fetch_joins(
        keyword=keyword_filter or None,
        status=None if status_filter == "전체" else status_filter,
    )
    source_label = "FastAPI" if data_source == "api" else "로컬 합성 시드"
    st.info(f"{source_label}에서 {len(join_items)}건을 불러왔습니다.")
    for item in join_items:
        with st.container(border=True):
            st.subheader(item["title"])
            st.write(item["description"])
            st.caption(
                f"#{' #'.join(item['keywords'])} · {item['scheduledDate']} "
                f"{item['scheduledTime']} · {item['location']}"
            )
            st.write(
                f"**{item['status']}** · "
                f"{item['currentParticipants']}/{item['maxParticipants']}명 · "
                f"by {item['hostNickname']}"
            )
    st.stop()

st.title("🍊 버킷 제주 근처 둘러보기")
st.caption(
    f"{BUCKET_JEJU['name']}의 고정 위치를 중심으로 "
    f"반경 {SEARCH_RADIUS_METERS // 1_000}km 안의 장소만 보여드려요."
)

kakao_js_key = os.getenv("KAKAO_JS_KEY", "").strip()

if not kakao_js_key:
    st.warning(
        "카카오맵 JavaScript 키가 설정되지 않았어요. "
        "실행 환경에 KAKAO_JS_KEY를 추가하고 현재 웹 도메인을 "
        "카카오 디벨로퍼스의 JavaScript SDK 도메인에 등록해 주세요."
    )
    st.code("KAKAO_JS_KEY=your_javascript_key", language="bash")
    st.stop()

safe_key = html.escape(kakao_js_key, quote=True)
center_json = json.dumps(BUCKET_JEJU, ensure_ascii=False)

components.html(
    f"""
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      color: #173f36;
      font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #fffaf0;
    }}
    .map-shell {{
      overflow: hidden;
      border: 1px solid #d8e7df;
      border-radius: 24px;
      background: white;
      box-shadow: 0 10px 28px rgba(35, 91, 76, .12);
    }}
    .map-head {{
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: #1f695a;
      color: white;
    }}
    .map-head strong {{ font-size: 16px; }}
    .radius-badge {{
      padding: 7px 11px;
      border-radius: 999px;
      color: #7a381d;
      background: #ffd39f;
      font-weight: 800;
      font-size: 12px;
    }}
    .filters {{
      display: flex;
      gap: 8px;
      padding: 12px 14px;
      overflow-x: auto;
      border-bottom: 1px solid #e8efe9;
    }}
    .filters button {{
      flex: 0 0 auto;
      border: 1px solid #cfe0d8;
      border-radius: 999px;
      padding: 8px 13px;
      background: white;
      color: #315e52;
      cursor: pointer;
      font-weight: 700;
    }}
    .filters button.active {{ color: white; background: #ff704d; border-color: #ff704d; }}
    .content {{ display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(260px, .8fr); }}
    #map {{ width: 100%; min-height: 540px; }}
    #places {{
      max-height: 540px;
      overflow-y: auto;
      padding: 12px;
      background: #fbfdfb;
    }}
    .place {{
      margin-bottom: 9px;
      padding: 12px;
      border: 1px solid #e1ebe5;
      border-radius: 15px;
      background: white;
      cursor: pointer;
    }}
    .place:hover {{ border-color: #ff704d; }}
    .place strong {{ display: block; margin-bottom: 5px; }}
    .place small {{ display: block; color: #70827c; line-height: 1.5; }}
    .empty {{ padding: 24px 12px; color: #71827d; text-align: center; }}
    @media (max-width: 720px) {{
      .content {{ grid-template-columns: 1fr; }}
      #map {{ min-height: 390px; }}
      #places {{ max-height: 280px; }}
      .map-head {{ align-items: flex-start; flex-direction: column; }}
    }}
  </style>
</head>
<body>
  <section class="map-shell">
    <header class="map-head">
      <div>
        <strong>📍 버킷 제주 중심 지도</strong><br />
        <small>{html.escape(BUCKET_JEJU["address"])}</small>
      </div>
      <span class="radius-badge">버킷 제주 기준 반경 2km</span>
    </header>
    <nav class="filters" aria-label="장소 카테고리">
      <button class="active" data-category="ALL">전체</button>
      <button data-category="FD6">음식점</button>
      <button data-category="CE7">카페</button>
      <button data-category="AT4">관광명소</button>
      <button data-category="CS2">편의점</button>
    </nav>
    <div class="content">
      <div id="map" aria-label="버킷 제주 중심 반경 2km 카카오 지도"></div>
      <aside id="places" aria-live="polite"></aside>
    </div>
  </section>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey={safe_key}&libraries=services&autoload=false"></script>
  <script>
    const BUCKET = {center_json};
    const RADIUS = {SEARCH_RADIUS_METERS};
    const categoryCodes = ["FD6", "CE7", "AT4", "CS2"];
    let map;
    let placesService;
    let markers = [];
    let currentInfoWindow;

    function haversineMeters(lat1, lng1, lat2, lng2) {{
      const toRad = value => value * Math.PI / 180;
      const earthRadius = 6371000;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }}

    function clearMarkers() {{
      markers.forEach(marker => marker.setMap(null));
      markers = [];
      if (currentInfoWindow) currentInfoWindow.close();
    }}

    function displayPlaces(rawPlaces) {{
      clearMarkers();
      const withinRadius = rawPlaces
        .map(place => ({{
          ...place,
          distanceMeters: Math.round(haversineMeters(
            BUCKET.lat, BUCKET.lng, Number(place.y), Number(place.x)
          ))
        }}))
        .filter(place => place.distanceMeters <= RADIUS)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      const list = document.getElementById("places");
      if (!withinRadius.length) {{
        list.innerHTML = '<div class="empty">반경 2km 안에서 해당 장소를 찾지 못했어요.</div>';
        return;
      }}
      list.innerHTML = "";

      withinRadius.forEach(place => {{
        const position = new kakao.maps.LatLng(Number(place.y), Number(place.x));
        const marker = new kakao.maps.Marker({{ map, position }});
        markers.push(marker);

        const card = document.createElement("article");
        card.className = "place";
        const title = document.createElement("strong");
        title.textContent = place.place_name;
        const details = document.createElement("small");
        details.textContent = `${{place.distanceMeters.toLocaleString()}}m · ${{place.category_name || "장소"}}`;
        const address = document.createElement("small");
        address.textContent = place.road_address_name || place.address_name || "";
        card.append(title, details, address);
        list.appendChild(card);

        const openInfo = () => {{
          if (currentInfoWindow) currentInfoWindow.close();
          currentInfoWindow = new kakao.maps.InfoWindow({{
            content: `<div style="padding:8px 10px;white-space:nowrap;font-size:12px;">${{place.place_name}}</div>`
          }});
          currentInfoWindow.open(map, marker);
          map.panTo(position);
        }};
        card.addEventListener("click", openInfo);
        kakao.maps.event.addListener(marker, "click", openInfo);
      }});
    }}

    function searchCategory(category) {{
      document.getElementById("places").innerHTML = '<div class="empty">2km 안의 장소를 찾는 중이에요…</div>';
      const codes = category === "ALL" ? categoryCodes : [category];
      Promise.all(codes.map(code => new Promise(resolve => {{
        placesService.categorySearch(code, (data, status) => {{
          resolve(status === kakao.maps.services.Status.OK ? data : []);
        }}, {{
          location: new kakao.maps.LatLng(BUCKET.lat, BUCKET.lng),
          radius: RADIUS,
          sort: kakao.maps.services.SortBy.DISTANCE
        }});
      }}))).then(results => {{
        const unique = new Map();
        results.flat().forEach(place => unique.set(place.id, place));
        displayPlaces([...unique.values()]);
      }});
    }}

    kakao.maps.load(() => {{
      const center = new kakao.maps.LatLng(BUCKET.lat, BUCKET.lng);
      map = new kakao.maps.Map(document.getElementById("map"), {{ center, level: 5 }});
      placesService = new kakao.maps.services.Places();

      new kakao.maps.Circle({{
        center,
        radius: RADIUS,
        strokeWeight: 3,
        strokeColor: "#ff704d",
        strokeOpacity: .9,
        strokeStyle: "solid",
        fillColor: "#ffb391",
        fillOpacity: .12
      }}).setMap(map);

      const homeMarker = new kakao.maps.Marker({{ map, position: center }});
      const homeInfo = new kakao.maps.InfoWindow({{
        content: '<div style="padding:9px 12px;white-space:nowrap;font-weight:800;color:#1f695a;">🍊 버킷 제주</div>'
      }});
      homeInfo.open(map, homeMarker);

      document.querySelectorAll(".filters button").forEach(button => {{
        button.addEventListener("click", () => {{
          document.querySelectorAll(".filters button").forEach(item => item.classList.remove("active"));
          button.classList.add("active");
          searchCategory(button.dataset.category);
        }});
      }});
      searchCategory("ALL");
    }});
  </script>
</body>
</html>
""",
    height=720,
    scrolling=False,
)

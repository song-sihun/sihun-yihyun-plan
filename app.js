// CONFIG 설정 (본인의 키로 교체)
const CONFIG = {
  JSONBIN_BIN_ID: "6abcb54effd5d160533e136e",
  JSONBIN_API_KEY:
    "$2a$10$u/7g2gIKKR213sq1WQRiDuTelVs3u4WKSPyfBuTx5ZzjSHwSUvvm.",
  IMGBB_API_KEY: "3676991782559515914e65b8d1a8df6b",
};

// 통합 앱 데이터
let appData = {
  settings: {
    title: "시훈 & 이현 함께해용",
    targetAmount: 1000000,
  },
  history: [],
  diaries: [],
};

// 스크롤 시 보여줄 일기 수 제어 (기본 5개)
let visibleDiaryCount = 5;

// 초기화
document.addEventListener("DOMContentLoaded", () => {
  fetchStore();
  initDateInputs();
  startDragonRambling();
});

function initDateInputs() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("savingDate").value = today;
  document.getElementById("diaryDate").value = today;
}

// 탭 전환 제어
function switchTab(tabName) {
  const diaryTab = document.getElementById("tabDiary");
  const savingTab = document.getElementById("tabSaving");
  const mapTab = document.getElementById("tabMap");

  const diaryBtn = document.getElementById("navDiaryBtn");
  const savingBtn = document.getElementById("navSavingBtn");
  const mapBtn = document.getElementById("navMapBtn");

  // 1. 모든 탭 및 버튼 비활성화
  diaryTab.classList.remove("active");
  savingTab.classList.remove("active");
  mapTab.classList.remove("active");

  diaryBtn.classList.remove("active");
  savingBtn.classList.remove("active");
  mapBtn.classList.remove("active");

  // 2. 선택된 탭 활성화 및 로직 처리
  if (tabName === "diary") {
    diaryTab.classList.add("active");
    diaryBtn.classList.add("active");
    visibleDiaryCount = 5; // 일기장 탭 복귀 시 5개로 초기화
    renderUI();
  } else if (tabName === "saving") {
    savingTab.classList.add("active");
    savingBtn.classList.add("active");
  } else if (tabName === "map") {
    mapTab.classList.add("active");
    mapBtn.classList.add("active");

    // 지도가 비활성화 상태(display: none)였다가 켜질 때 깨짐 방지용 리사이즈 처리
    if (typeof map !== "undefined" && map !== null) {
      setTimeout(() => {
        google.maps.event.trigger(map, "resize");
        // 이전에 마커나 중심 좌표가 설정되어 있다면 재정렬 가능
      }, 100);
    }
  }
}

// JSONBin API 연동
async function fetchStore() {
  try {
    const res = await fetch(
      `https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}/latest`,
      {
        headers: { "X-Master-Key": CONFIG.JSONBIN_API_KEY },
      },
    );
    const data = await res.json();
    if (data.record) {
      appData.settings = data.record.settings || {
        title: data.record.targetTitle || "시훈 & 이현 여행",
        targetAmount: data.record.targetAmount || 1500000,
      };
      appData.history = data.record.history || [];
      appData.diaries = data.record.diaries || [];
      renderUI();
    }
  } catch (err) {
    console.error("데이터 로드 실패:", err);
  }
}

async function saveStore() {
  try {
    await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": CONFIG.JSONBIN_API_KEY,
      },
      body: JSON.stringify(appData),
    });
    renderUI();
  } catch (err) {
    alert("데이터 저장 중 오류가 발생했습니다.");
  }
}

// 1. ImgBB 업로드 시 display_url (최적화본) 활용
async function uploadImage(file) {
  if (!file) return { url: null, deleteUrl: null };
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_API_KEY}`,
    {
      method: "POST",
      body: formData,
    },
  );
  const data = await res.json();
  if (data.success) {
    return {
      // display_url이 없으면 원본 url 사용
      url: data.data.display_url || data.data.url,
      deleteUrl: data.data.delete_url,
    };
  }
  return { url: null, deleteUrl: null };
}

// UI 렌더링
function renderUI() {
  // 1. 대시보드 업데이트
  document.getElementById("appTitleDisplay").innerText = appData.settings.title;
  document.getElementById("pageTitle").innerText = appData.settings.title;
  document.getElementById("targetAmountDisplay").innerText =
    `${appData.settings.targetAmount.toLocaleString()}원`;

  const totalSaved = appData.history.reduce(
    (sum, h) => sum + Number(h.amount),
    0,
  );
  document.getElementById("currentAmountDisplay").innerText =
    `${totalSaved.toLocaleString()}원`;

  const remaining = Math.max(0, appData.settings.targetAmount - totalSaved);
  document.getElementById("remainingAmountDisplay").innerText =
    `목표까지 ${remaining.toLocaleString()}원 남음`;

  const percent =
    Math.min(
      100,
      Math.round((totalSaved / appData.settings.targetAmount) * 100),
    ) || 0;
  document.getElementById("progressBarFill").style.width = `${percent}%`;
  document.getElementById("progressText").innerText = `달성률 ${percent}%`;

  // 2. 저축 로그 목록 (ID 역순)
  const savingBody = document.getElementById("savingHistoryList");
  savingBody.innerHTML = "";
  [...appData.history].reverse().forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong style="color:#60a5fa;">#${item.id}</strong></td>
      <td style="color: var(--text-sub);">${item.date}</td>
      <td>${item.note}</td>
      <td class="amount-cell">+${Number(item.amount).toLocaleString()}원</td>
      <td style="text-align: center;">
        <div class="btn-action-group">
          <button class="btn-action edit" onclick="openEditSavingModal(${item.id})">수정</button>
          <button class="btn-action delete" onclick="deleteHistory(${item.id})">삭제</button>
        </div>
      </td>
    `;
    savingBody.appendChild(tr);
  });

  // 3. 일기장 피드 (날짜 기준 최신순 정렬 및 5개씩 무한 스크롤)
  const diaryFeed = document.getElementById("diaryFeedList");
  diaryFeed.innerHTML = "";

  const sortedDiaries = [...appData.diaries].sort(
    (a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id,
  );
  const visibleDiaries = sortedDiaries.slice(0, visibleDiaryCount);

  // 2. renderUI() 의 <img> 태그에 loading="lazy" 및 decoding="async" 추가
  visibleDiaries.forEach((item) => {
    const div = document.createElement("div");
    div.className = "diary-item";
    div.innerHTML = `
    <div class="diary-header">
      <span class="diary-date">${item.date}</span>
      <button class="btn-action delete" onclick="deleteDiary(${item.id})">삭제</button>
    </div>
    ${item.imageUrl ? `<img src="${item.imageUrl}" class="diary-img" alt="일기 사진" loading="lazy" decoding="async" onclick="openImageViewer('${item.imageUrl}')">` : ""}
    <div class="diary-content">${item.content}</div>
  `;
    diaryFeed.appendChild(div);
  });
}

// 하단 무한 스크롤 감지 이벤트
window.addEventListener("scroll", () => {
  const diaryTab = document.getElementById("tabDiary");
  if (!diaryTab || !diaryTab.classList.contains("active")) return;

  const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    if (visibleDiaryCount < appData.diaries.length) {
      visibleDiaryCount += 5;
      renderUI();
    }
  }
});

// 모달 제어
function openModal(id) {
  document.getElementById(id).style.display = "flex";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}
function closeModalOnOverlay(e, id) {
  if (e.target.id === id) closeModal(id);
}

function openSettingsModal() {
  document.getElementById("inputAppTitle").value = appData.settings.title;
  document.getElementById("inputTargetAmount").value =
    appData.settings.targetAmount;
  openModal("settingsModal");
}
function openSavingModal() {
  openModal("savingModal");
}
function openDiaryModal() {
  openModal("diaryModal");
}

function openEditSavingModal(id) {
  const item = appData.history.find((h) => h.id === id);
  if (!item) return;
  document.getElementById("editSavingId").value = item.id;
  document.getElementById("editSavingAmount").value = item.amount;
  document.getElementById("editSavingDate").value = item.date;
  document.getElementById("editSavingNote").value = item.note;
  openModal("editSavingModal");
}

// 폼 서브밋 핸들러
document
  .getElementById("settingsForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("settingsSubmitBtn");
    btn.disabled = true;
    btn.innerText = "저장 중...";

    appData.settings.title = document.getElementById("inputAppTitle").value;
    appData.settings.targetAmount = Number(
      document.getElementById("inputTargetAmount").value,
    );

    await saveStore();
    btn.disabled = false;
    btn.innerText = "저장하기";
    closeModal("settingsModal");
  });

document.getElementById("savingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("savingSubmitBtn");
  btn.disabled = true;
  btn.innerText = "저장 중...";

  const amount = Number(document.getElementById("savingAmount").value);
  const date = document.getElementById("savingDate").value;
  const note = document.getElementById("savingNote").value;
  const nextId =
    appData.history.length > 0
      ? Math.max(...appData.history.map((h) => h.id)) + 1
      : 1;

  appData.history.push({ id: nextId, amount, date, note });
  await saveStore();

  document.getElementById("savingAmount").value = "";
  document.getElementById("savingNote").value = "";
  btn.disabled = false;
  btn.innerText = "기록하기";
  closeModal("savingModal");
});

document
  .getElementById("editSavingForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("editSavingSubmitBtn");
    btn.disabled = true;
    btn.innerText = "수정 중...";

    const id = Number(document.getElementById("editSavingId").value);
    const item = appData.history.find((h) => h.id === id);
    if (item) {
      item.amount = Number(document.getElementById("editSavingAmount").value);
      item.date = document.getElementById("editSavingDate").value;
      item.note = document.getElementById("editSavingNote").value;
      await saveStore();
    }

    btn.disabled = false;
    btn.innerText = "수정 완료";
    closeModal("editSavingModal");
  });

async function deleteHistory(id) {
  if (!confirm("해당 저축 기록을 삭제하시겠습니까?")) return;
  appData.history = appData.history.filter((h) => h.id !== id);
  await saveStore();
}

document.getElementById("diaryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("diarySubmitBtn");
  btn.disabled = true;
  btn.innerText = "일기 등록 중... ❄️";

  try {
    const fileInput = document.getElementById("diaryImage");
    let imageData = { url: null, deleteUrl: null };
    if (fileInput.files.length > 0) {
      imageData = await uploadImage(fileInput.files[0]);
    }

    const date = document.getElementById("diaryDate").value;
    const content = document.getElementById("diaryText").value;
    const nextId =
      appData.diaries.length > 0
        ? Math.max(...appData.diaries.map((d) => d.id)) + 1
        : 1;

    appData.diaries.push({
      id: nextId,
      date,
      content,
      imageUrl: imageData.url,
      deleteUrl: imageData.deleteUrl,
    });

    await saveStore();
    document.getElementById("diaryText").value = "";
    document.getElementById("diaryImage").value = "";
    closeModal("diaryModal");
  } catch (err) {
    alert("일기 저장 실패");
  } finally {
    btn.disabled = false;
    btn.innerText = "일기 등록하기 ❄️";
  }
});

// 일기 삭제 (ImgBB 원본 삭제 안내창 연동)
async function deleteDiary(id) {
  if (!confirm("일기를 삭제하시겠습니까?")) return;
  const target = appData.diaries.find((d) => d.id === id);

  if (target && target.deleteUrl) {
    window.open(target.deleteUrl, "_blank");
  }

  appData.diaries = appData.diaries.filter((d) => d.id !== id);
  await saveStore();
}

// 마스코트 걸어다니기
function startDragonRambling() {
  const dragon = document.getElementById("dragonMascot");
  if (!dragon) return;
  let currentLeft = 20;

  setInterval(() => {
    const maxLeft = window.innerWidth - 100;
    const newLeft = Math.floor(Math.random() * Math.max(maxLeft, 50)) + 20;
    const newBottom = Math.floor(Math.random() * 60) + 70;

    dragon.style.transform = newLeft < currentLeft ? "scaleX(-1)" : "scaleX(1)";
    dragon.style.left = `${newLeft}px`;
    dragon.style.bottom = `${newBottom}px`;

    currentLeft = newLeft;
  }, 4000);
}

// 이미지 전체화면 열기
function openImageViewer(url) {
  const modal = document.getElementById("imageViewerModal");
  const img = document.getElementById("imageViewerImg");
  img.src = url;
  modal.style.display = "flex";
}

// 이미지 전체화면 닫기
function closeImageViewer() {
  const modal = document.getElementById("imageViewerModal");
  const img = document.getElementById("imageViewerImg");
  modal.style.display = "none";
  img.src = "";
}

// Google Maps & Gemini 추천 로직
const GEMINI_API_KEY = "AQ.Ab8RN6JpgwYmo6ZZ5rQKW4sIAQiJlUcmRegPImwomn9fjmLvlA";

let map;
let placesService;
let currentMarkers = [];

// 구글 지도 초기화
function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  const defaultCenter = { lat: 35.6895, lng: 139.6917 }; // 도쿄 기본값
  map = new google.maps.Map(mapEl, {
    zoom: 12,
    center: defaultCenter,
    disableDefaultUI: true,
    zoomControl: true,
  });
  placesService = new google.maps.places.PlacesService(map);
}

// 페이지 로드 후 지도 초기화
window.addEventListener("DOMContentLoaded", () => {
  if (typeof google !== "undefined" && google.maps) {
    initMap();
  }
});

function clearMarkers() {
  currentMarkers.forEach((m) => m.setMap(null));
  currentMarkers = [];
}

function cleanQuery(str) {
  if (!str) return "";
  return str.replace(/^[0-9]+[\.\s\-]+/, "").replace(/["'']/g, "").trim();
}

function searchSingleQuery(queryText) {
  return new Promise((resolve) => {
    const cleaned = cleanQuery(queryText);
    if (!cleaned) return resolve({ result: null, status: "EMPTY_QUERY" });

    placesService.textSearch({ query: cleaned }, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        resolve({ result: results[0], status: status });
      } else {
        resolve({ result: null, status: status });
      }
    });
  });
}

async function findGooglePlaceWithFallback(place) {
  let res = await searchSingleQuery(place.query_primary);
  if (res.result) return res;

  res = await searchSingleQuery(place.query_secondary);
  if (res.result) return res;

  res = await searchSingleQuery(place.title);
  return res;
}

async function getRecommendations() {
  const input = document.getElementById("promptInput").value;
  const resultsDiv = document.getElementById("results");
  const searchBtn = document.getElementById("searchBtn");

  if (!input.trim()) {
    alert("원하시는 여행지나 키워드를 입력해주세요!");
    return;
  }

  searchBtn.disabled = true;
  searchBtn.innerText = "⏳ 탐색 및 지도 매칭 중...";

  resultsDiv.innerHTML = `
    <div class="card shadow" style="text-align: center; padding: 20px;">
      <div class="card-value highlight" style="font-size: 16px;">AI가 장소를 분석 중입니다...</div>
      <div class="progress-bar-bg" style="margin-top: 10px;"><div class="progress-bar-fill" style="width: 60%;"></div></div>
    </div>
  `;
  clearMarkers();

  const prompt = `사용자 요청: "${input}"\n
위 요청에 맞는 실제 존재하는 추천 장소 3곳을 선정하세요.

[검색 키워드 생성 규칙]
1. query_primary: 구글 지도에서 검색할 공식 영문 또는 현지 원어 상호명과 도시명
2. query_secondary: 한글 상호명과 도시명
3. 수식어나 특수문자는 query에 절대 포함하지 마세요.

반드시 아래 형식의 JSON 배열로만 응답하세요:
[
  {
    "title": "한글 장소명",
    "query_primary": "영문/원어 상호명 도시명",
    "query_secondary": "한글 상호명 도시명",
    "description": "추천 이유 1-2문장"
  }
]`;

  try {
    const MODEL_NAME = "gemini-3.5-flash-lite";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Gemini 호출 실패");

    const rawText = data.candidates[0].content.parts[0].text;
    const places = JSON.parse(rawText);

    resultsDiv.innerHTML = "";
    const bounds = new google.maps.LatLngBounds();
    const infoWindow = new google.maps.InfoWindow();

    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      const searchRes = await findGooglePlaceWithFallback(place);
      const googlePlace = searchRes.result;

      const itemEl = document.createElement("article");
      itemEl.className = "card shadow";
      itemEl.style.marginBottom = "12px";

      if (googlePlace && googlePlace.geometry) {
        const loc = googlePlace.geometry.location;
        bounds.extend(loc);

        const addr = googlePlace.formatted_address || "주소 확인 완료";
        const gmapsUrl = `https://www.google.com/maps/place/?q=place_id:${googlePlace.place_id}`;

        itemEl.innerHTML = `
          <div class="card-header-flex">
            <span class="card-label">RECOMMEND 0${i + 1}</span>
            <button class="btn-text-edit" onclick="window.open('${gmapsUrl}', '_blank')">지도 앱 열기 ↗</button>
          </div>
          <h3 style="font-size: 18px; font-weight: 800; margin: 6px 0;">${place.title}</h3>
          <p style="font-size: 12px; color: var(--text-sub, #64748b); margin-bottom: 10px;">📍 ${addr}</p>
          <p style="font-size: 14px; margin-bottom: 12px; line-height: 1.5;">${place.description}</p>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; color: #16a34a; font-weight: 600;">✓ 구글 지도 위치 매칭 성공</span>
            <button class="btn-primary btn-snow" onclick="focusMarker(${i})">위치 보기</button>
          </div>
        `;

        const marker = new google.maps.Marker({
          position: loc,
          map: map,
          label: `${i + 1}`,
        });

        currentMarkers.push(marker);

        marker.addListener("click", () => {
          infoWindow.setContent(`
            <div style="padding:6px; color: #1e293b;">
              <b style="font-size: 14px; color:#2563eb;">${place.title}</b><br>
              <span style="font-size:12px; color:#64748b;">${addr}</span>
            </div>
          `);
          infoWindow.open(map, marker);
        });
      } else {
        itemEl.innerHTML = `
          <div class="card-header-flex">
            <span class="card-label" style="color: var(--danger, #ef4444);">LOCATION NOT FOUND</span>
          </div>
          <h3 style="font-size: 18px; font-weight: 800; margin: 6px 0;">${place.title}</h3>
          <p style="font-size: 14px;">${place.description}</p>
        `;
      }

      resultsDiv.appendChild(itemEl);
    }

    if (currentMarkers.length > 0) {
      map.fitBounds(bounds);
    }
  } catch (err) {
    console.error(err);
    resultsDiv.innerHTML = `<div class="card shadow" style="color: red; text-align:center;">오류: ${err.message}</div>`;
  } finally {
    searchBtn.disabled = false;
    searchBtn.innerText = "🔍 AI 추천 및 위치 찾기";
  }
}

function focusMarker(index) {
  if (currentMarkers[index]) {
    const marker = currentMarkers[index];
    map.setCenter(marker.getPosition());
    map.setZoom(16);
    google.maps.event.trigger(marker, "click");
  }
}

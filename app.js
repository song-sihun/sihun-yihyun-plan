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
  const diaryBtn = document.getElementById("navDiaryBtn");
  const savingBtn = document.getElementById("navSavingBtn");

  if (tabName === "diary") {
    diaryTab.classList.add("active");
    savingTab.classList.remove("active");
    diaryBtn.classList.add("active");
    savingBtn.classList.remove("active");
    visibleDiaryCount = 5; // 일기장 탭 복귀 시 5개로 초기화
    renderUI();
  } else {
    savingTab.classList.add("active");
    diaryTab.classList.remove("active");
    savingBtn.classList.add("active");
    diaryBtn.classList.remove("active");
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
    ${item.imageUrl ? `<img src="${item.imageUrl}" class="diary-img" alt="일기 사진" loading="lazy" decoding="async">` : ""}
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

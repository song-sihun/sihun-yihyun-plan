const API_URL = `https://api.jsonbin.io/v3/b/${CONFIG.BIN_ID}`;

let appData = {
  target: { title: "오사카 설원 여행 🏯", targetAmount: 2000000 },
  history: [],
  diaries: [],
};

// 탭 전환
function switchTab(tabName) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((el) => el.classList.remove("active"));

  if (tabName === "diary") {
    document.getElementById("tab-diary").classList.add("active");
    event.currentTarget.classList.add("active");
  } else {
    document.getElementById("tab-saving").classList.add("active");
    event.currentTarget.classList.add("active");
  }
}

// 모달 제어
function openDiaryModal() {
  document.getElementById("diaryModal").style.display = "flex";
}
function closeDiaryModal() {
  document.getElementById("diaryModal").style.display = "none";
}
function closeDiaryModalOnOverlay(e) {
  if (e.target.id === "diaryModal") closeDiaryModal();
}

// ImgBB 사진 업로드
async function uploadImage(file) {
  if (!file) return null;
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
  return data.success ? data.data.url : null;
}

// JSONBin 데이터 불러오기
async function fetchStore() {
  try {
    const res = await fetch(API_URL, {
      headers: { "X-Master-Key": CONFIG.API_KEY },
    });
    const result = await res.json();
    appData = result.record;
    if (!appData.diaries) appData.diaries = [];
    renderUI();
  } catch (err) {
    alert("데이터를 불러오는데 실패했습니다.");
  }
}

// JSONBin 데이터 저장하기
async function saveStore() {
  await fetch(API_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": CONFIG.API_KEY,
    },
    body: JSON.stringify(appData),
  });
  renderUI();
}

// UI 렌더링
function renderUI() {
  // 1. 저축 데이터 계산
  const targetAmt = Number(appData.target.targetAmount) || 0;
  document.getElementById("targetAmount").innerText =
    targetAmt.toLocaleString();

  const totalSaved = appData.history.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  const remaining = Math.max(targetAmt - totalSaved, 0);
  const percent =
    targetAmt > 0
      ? Math.min(((totalSaved / targetAmt) * 100).toFixed(1), 100)
      : 0;

  document.getElementById("totalSaved").innerText = totalSaved.toLocaleString();
  document.getElementById("remainingAmount").innerText =
    remaining.toLocaleString();
  document.getElementById("progressPercent").innerText = `${percent}%`;
  document.getElementById("progressFill").style.width = `${percent}%`;
  document.getElementById("historyCount").innerText =
    `${appData.history.length}회`;

  // 저축 내역 표
  const savingBody = document.getElementById("savingHistoryList");
  savingBody.innerHTML = "";
  [...appData.history].reverse().forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong style="color:#60a5fa;">#${item.id}</strong></td>
      <td style="color: var(--text-sub);">${item.date}</td>
      <td>${item.note}</td>
      <td class="amount-cell">+${Number(item.amount).toLocaleString()}원</td>
      <td style="text-align: center;"><button class="btn-delete" onclick="deleteHistory(${item.id})">✕</button></td>
    `;
    savingBody.appendChild(tr);
  });

  // 2. 일기장 피드
  const diaryContainer = document.getElementById("diaryList");
  diaryContainer.innerHTML = "";

  if (appData.diaries.length === 0) {
    diaryContainer.innerHTML =
      '<div style="text-align:center; padding:30px 10px; color:#64748b; font-size:13px;">아직 적은 일기가 없어요.<br>위 버튼을 눌러 첫 번째 추억을 적어보세요! ❄️</div>';
  } else {
    [...appData.diaries].reverse().forEach((diary) => {
      const div = document.createElement("div");
      div.className = "diary-item";
      const imgHtml = diary.imageUrl
        ? `<img src="${diary.imageUrl}" class="diary-img" onclick="openModal('${diary.imageUrl}')">`
        : "";

      div.innerHTML = `
        <div class="diary-header">
          <span class="diary-date">📅 ${diary.date}</span>
          <button class="btn-delete" onclick="deleteDiary(${diary.id})">✕ 삭제</button>
        </div>
        ${imgHtml}
        <div class="diary-content">${diary.content}</div>
      `;
      diaryContainer.appendChild(div);
    });
  }
}

// 저축 서브밋
document.getElementById("savingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("savingSubmitBtn");
  btn.disabled = true;
  btn.innerText = "저장 중...";

  const amount = document.getElementById("savingAmount").value;
  const date = document.getElementById("savingDate").value;
  const note = document.getElementById("savingNote").value;
  const nextId =
    appData.history.length > 0
      ? Math.max(...appData.history.map((h) => h.id)) + 1
      : 1;

  appData.history.push({ id: nextId, amount: Number(amount), date, note });
  await saveStore();

  document.getElementById("savingAmount").value = "";
  document.getElementById("savingNote").value = "";
  btn.disabled = false;
  btn.innerText = "저축 기록 저금통에 넣기 🪙";
});

// 일기 서브밋
document.getElementById("diaryForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("diarySubmitBtn");
  btn.disabled = true;
  btn.innerText = "일기 등록 중... ❄️";

  try {
    const fileInput = document.getElementById("diaryImage");
    let imageUrl = null;
    if (fileInput.files.length > 0) {
      imageUrl = await uploadImage(fileInput.files[0]);
    }

    const date = document.getElementById("diaryDate").value;
    const content = document.getElementById("diaryText").value;
    const nextId =
      appData.diaries.length > 0
        ? Math.max(...appData.diaries.map((d) => d.id)) + 1
        : 1;

    appData.diaries.push({ id: nextId, date, content, imageUrl });
    await saveStore();

    document.getElementById("diaryText").value = "";
    document.getElementById("diaryImage").value = "";
    closeDiaryModal();
  } catch (err) {
    alert("일기 저장 실패");
  } finally {
    btn.disabled = false;
    btn.innerText = "일기 저장하기 ❄️";
  }
});

async function updateTargetAmount() {
  const newTarget = prompt(
    "새로운 목표 금액을 입력하세요 (숫자만):",
    appData.target.targetAmount,
  );
  if (newTarget && !isNaN(newTarget)) {
    appData.target.targetAmount = Number(newTarget);
    await saveStore();
  }
}

async function deleteHistory(id) {
  if (!confirm("삭제하시겠습니까?")) return;
  appData.history = appData.history.filter((item) => item.id !== id);
  await saveStore();
}

async function deleteDiary(id) {
  if (!confirm("일기를 삭제하시겠습니까?")) return;
  appData.diaries = appData.diaries.filter((item) => item.id !== id);
  await saveStore();
}

function openModal(url) {
  document.getElementById("modalImg").src = url;
  document.getElementById("imageModal").style.display = "flex";
}

// 초기화
const today = new Date().toISOString().substring(0, 10);
document.getElementById("savingDate").value = today;
document.getElementById("diaryDate").value = today;
fetchStore();

// ==========================================
// 캐릭터 랜덤 이동 로직
// ==========================================
function startDragonRambling() {
  const dragon = document.getElementById("dragonMascot");
  if (!dragon) return;

  let currentLeft = 20;

  setInterval(() => {
    // 화면 너비 범위 내에서 이동 가능한 X 좌표 산출
    const maxLeft = window.innerWidth - 100;
    const newLeft = Math.floor(Math.random() * Math.max(maxLeft, 50)) + 20;

    // Y축(bottom)도 살짝 위아래로 찰랑거리게 산출 (60px ~ 120px 사이)
    const newBottom = Math.floor(Math.random() * 60) + 60;

    // 이동 방향에 맞춰 좌우 반전 (왼쪽 이동 시 scaleX(-1))
    if (newLeft < currentLeft) {
      dragon.style.transform = "scaleX(-1)";
    } else {
      dragon.style.transform = "scaleX(1)";
    }

    dragon.style.left = `${newLeft}px`;
    dragon.style.bottom = `${newBottom}px`;

    currentLeft = newLeft;
  }, 4000); // 4초마다 새로운 위치로 이동
}

// 페이지 로드 완료 시 이동 실행
window.addEventListener("DOMContentLoaded", startDragonRambling);

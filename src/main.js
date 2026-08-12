import "./styles.css";
import { isSupabaseConfigured, supabase } from "./supabase.js";
import { fetchCurrentWeather, getWeatherLabel, getWeatherMission, requestCurrentPosition, sampleWeather } from "./weather.js";

// 앱의 화면 구조를 한곳에 모아 두어 다음 단계에서 데이터를 쉽게 연결할 수 있습니다.
const app = document.querySelector("#app");

// 실제 Carrier API 대신 사용할 가상 에어컨의 초기 상태입니다.
// 다음 미션 단계에서도 같은 객체를 사용해 조건을 판단할 수 있도록 구성했습니다.
const airconState = {
  power: true,
  mode: "냉방",
  temperature: 26,
  fan: "자동",
  runtimeMinutes: 90,
  filterPercent: 86,
  sensorError: false,
};

// 오늘의 미션 진행 상태입니다. 아직 포인트는 지급하지 않으며 PHASE 4에서 연결합니다.
const missionState = {
  status: "ready",
  elapsedMinutes: 0,
  goalMinutes: 120,
};

// 지갑 데이터는 로그인할 때 Supabase에서 불러오며 브라우저 저장소에는 보관하지 않습니다.
const pointState = {
  balance: 0,
  transactions: [],
  orders: [],
};
localStorage.removeItem("greenon-wallet");
localStorage.removeItem("greenon-profile");
localStorage.removeItem("greenon-session");
localStorage.removeItem("greenon-user");

let rewards = [];
let activeMissionId = null;
let activeUserMissionId = null;
let weatherState = { ...sampleWeather };

let selectedRewardId = null;

// 실제 로그인 세션은 Supabase SDK가 안전하게 관리합니다.
let currentUser = null;

app.innerHTML = `
  <canvas class="wind-cursor-canvas" id="wind-cursor-canvas" aria-hidden="true"></canvas>
  <div class="app-shell">
    <header class="topbar">
      <nav class="desktop-nav desktop-nav-left" aria-label="주요 메뉴">
        <a class="nav-item header-nav-link active" href="#home" data-page="home">홈</a>
        <a class="nav-item header-nav-link" href="#mission" data-page="mission">미션</a>
        <a class="nav-item header-nav-link" href="#wallet" data-page="wallet">지갑</a>
      </nav>
      <a class="brand nav-item" href="#home" data-page="home" aria-label="Carrier GreenON 홈">
        <span class="brand-mark" aria-hidden="true">G</span>
        <span>Carrier <strong>GreenON</strong></span>
      </a>
      <nav class="desktop-nav desktop-nav-right" aria-label="사용자 메뉴">
        <a class="nav-item header-nav-link" href="#shop" data-page="shop">리워드샵</a>
        <a class="nav-item header-nav-link" href="#my" data-page="my">GREEN REPORT</a>
        <button class="profile-button" id="profile-button" type="button" aria-label="내 정보 보기">ON</button>
      </nav>
    </header>

    <main class="page app-page" id="home-page">
      <section class="welcome" aria-labelledby="welcome-title">
        <div class="welcome-content">
          <p class="eyebrow">SMART COOLING, GREENER LIVING</p>
          <h1 id="welcome-title">공기의 기준을 바꾸다<br /><span>Carrier GreenON</span></h1>
          <p class="welcome-copy">당신의 시원함이 지구의 내일이 되도록.<br />스마트 냉방 미션으로 더 나은 일상을 시작하세요.</p>
          <div class="hero-actions">
            <a class="hero-button hero-button-light nav-item" href="#mission" data-page="mission">오늘의 미션</a>
            <a class="hero-button hero-button-dark nav-item" href="#shop" data-page="shop">리워드 보기</a>
          </div>
        </div>
        <div class="hero-pagination" aria-hidden="true"><i class="active"></i><i></i><i></i><i></i><i></i></div>
      </section>

      <section class="summary-grid" aria-label="오늘의 요약">
        <article class="summary-card weather-card" id="weather-card">
          <div class="card-heading">
            <span class="icon-badge" aria-hidden="true">☀</span>
            <div><p><span id="weather-location">서울</span> 현재 날씨</p><h2 id="weather-label">맑고 더워요</h2></div>
          </div>
          <div class="metric"><strong id="weather-temperature">29°</strong><span id="weather-humidity">습도 58%</span></div>
          <p class="helper-text" id="weather-helper">친환경 냉방이 필요한 날이에요</p>
          <div class="weather-actions"><button id="weather-refresh" type="button">서울 날씨 새로고침</button><button id="weather-location-button" type="button">내 위치 사용</button></div>
          <small class="weather-source" id="weather-source">샘플 데이터</small>
        </article>

        <article class="summary-card aircon-card" id="aircon-card">
          <div class="card-heading">
            <span class="icon-badge" aria-hidden="true">❄</span>
            <div><p>우리 집 에어컨</p><h2 id="aircon-summary">정상 작동 중</h2></div>
          </div>
          <div class="status-row"><strong id="aircon-temperature">26°C</strong><span class="status-chip" id="aircon-chip">● 냉방 중</span></div>
          <p class="helper-text" id="aircon-helper">모든 상태가 정상이에요</p>
        </article>
      </section>

      <section class="aircon-dashboard" aria-labelledby="aircon-title">
        <div class="section-title-row">
          <div><p class="eyebrow">VIRTUAL CARRIER AIRCON</p><h2 id="aircon-title">에어컨 상태</h2></div>
          <span class="live-badge"><i></i> SIMULATION</span>
        </div>

        <div class="device-status" id="device-status" role="status" aria-live="polite">
          <span class="device-icon" aria-hidden="true">❄</span>
          <div><strong id="device-status-title">쾌적하게 냉방 중</strong><p id="device-status-copy">가상 센서가 정상적으로 연결되어 있어요.</p></div>
        </div>

        <div class="status-detail-grid" aria-label="에어컨 상세 상태">
          <div class="status-detail"><span>POWER</span><strong id="power-value">ON</strong></div>
          <div class="status-detail"><span>MODE</span><strong id="mode-value">냉방</strong></div>
          <div class="status-detail"><span>FAN</span><strong id="fan-value">자동</strong></div>
          <div class="status-detail"><span>사용 시간</span><strong id="runtime-value">1시간 30분</strong></div>
          <div class="status-detail filter-detail"><span>필터 상태</span><strong id="filter-value">좋음 · 86%</strong><div class="filter-track"><i id="filter-bar"></i></div></div>
        </div>

        <details class="simulator">
          <summary>상태 시뮬레이션 패널 <span>열기</span></summary>
          <p class="simulator-guide">버튼을 눌러 가상 에어컨의 센서 값을 바꿔보세요.</p>
          <div class="control-grid">
            <button class="control-button" type="button" data-action="power">전원 ON/OFF</button>
            <button class="control-button" type="button" data-action="mode">모드 변경</button>
            <button class="control-button" type="button" data-action="fan">풍량 변경</button>
            <button class="control-button" type="button" data-action="temperature-down">온도 −1°C</button>
            <button class="control-button" type="button" data-action="temperature-up">온도 +1°C</button>
            <button class="control-button" type="button" data-action="runtime">사용 +30분</button>
          </div>
          <div class="fault-controls" aria-label="이상 상태 시뮬레이션">
            <button class="warning-button" type="button" data-action="filter">필터 점검 전환</button>
            <button class="warning-button" type="button" data-action="sensor">센서 오류 전환</button>
            <button class="reset-button" type="button" data-action="reset">정상 상태로 초기화</button>
          </div>
        </details>
      </section>

    </main>

    <main class="mission-page app-page" id="mission-page" hidden>
      <section class="page-intro" aria-labelledby="mission-page-title">
        <p class="eyebrow">GREEN MISSION</p>
        <h1 id="mission-page-title">오늘의 냉방 미션</h1>
        <p>가상 에어컨 상태를 확인하고 친환경 냉방에 도전해 보세요.</p>
      </section>
      <section class="mission-preview" aria-labelledby="mission-title">
        <div class="section-title-row">
          <div><p class="eyebrow">TODAY'S GREEN MISSION</p><h2 id="mission-title">오늘의 친환경 미션</h2></div>
          <span class="point-pill">+ 100 P</span>
        </div>
        <div class="mission-body">
          <span class="mission-icon" aria-hidden="true">🌿</span>
          <div><h3>적정 온도 26°C 유지하기</h3><p>냉방 모드 26°C를 120분 동안 유지해 주세요.</p></div>
        </div>
        <div class="weather-mission-tip" id="weather-mission-tip"><span aria-hidden="true">☀</span><div><strong id="weather-mission-title">26°C 적정 온도 유지하기</strong><p id="weather-mission-copy">지금 날씨에는 적정 온도 유지가 가장 효율적이에요.</p></div></div>
        <div class="mission-condition-list" aria-label="미션 성공 조건">
          <span id="condition-power">전원 ON</span>
          <span id="condition-mode">냉방 모드</span>
          <span id="condition-temperature">26°C 설정</span>
          <span id="condition-device">기기 정상</span>
        </div>
        <div class="mission-progress" id="mission-progress" hidden>
          <div class="progress-label"><strong id="mission-status-label">미션 진행 중</strong><span id="mission-time">0 / 120분</span></div>
          <div class="progress-track" role="progressbar" aria-label="미션 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="mission-progress-bar"></i></div>
          <p id="mission-progress-copy">조건을 유지한 뒤 30분 진행 버튼을 눌러주세요.</p>
        </div>
        <div class="mission-warning" id="mission-warning" role="alert" hidden>
          <strong>미션 조건을 확인해 주세요</strong>
          <p id="mission-warning-copy"></p>
        </div>
        <button class="primary-button" id="mission-action" type="button" aria-describedby="phase-message">미션 참여하기</button>
        <button class="secondary-button" id="mission-retry" type="button" hidden>미션 다시 도전하기</button>
        <p id="phase-message" class="phase-message">참여 후 30분 단위로 시간을 진행할 수 있어요.</p>
      </section>
    </main>

    <main class="wallet-page app-page" id="wallet-page" hidden>
      <section class="wallet-hero" aria-labelledby="wallet-title">
        <p class="eyebrow">GREEN WALLET</p>
        <h1 id="wallet-title">나의 초록 지갑</h1>
        <p>좋은 냉방 습관이 쌓일수록 지구도 지갑도 가벼워져요.</p>
        <div class="wallet-balance-card">
          <span>사용 가능한 GREEN POINT</span>
          <strong><span id="wallet-balance">0</span> P</strong>
          <small>미션을 완료하면 포인트가 자동으로 적립됩니다.</small>
        </div>
      </section>

      <section class="transaction-section" aria-labelledby="transaction-title">
        <div class="section-title-row">
          <div><p class="eyebrow">POINT HISTORY</p><h2 id="transaction-title">포인트 사용내역</h2></div>
        </div>
        <div class="transaction-tabs" role="tablist" aria-label="포인트 내역 필터">
          <button class="transaction-tab active" type="button" data-filter="all" role="tab" aria-selected="true">전체</button>
          <button class="transaction-tab" type="button" data-filter="earn" role="tab" aria-selected="false">적립</button>
          <button class="transaction-tab" type="button" data-filter="use" role="tab" aria-selected="false">사용</button>
        </div>
        <div class="transaction-list" id="transaction-list"></div>
      </section>
    </main>

    <main class="shop-page app-page" id="shop-page" hidden>
      <section class="shop-header" aria-labelledby="shop-title">
        <p class="eyebrow">GREEN REWARD SHOP</p>
        <div class="shop-heading-row"><div><h1 id="shop-title">초록 리워드 숍</h1><p>모은 포인트로 일상 속 친환경 혜택을 만나보세요.</p></div><div class="shop-balance"><span>MY POINT</span><strong><span id="shop-balance">0</span> P</strong></div></div>
      </section>
      <section class="reward-section" aria-label="리워드 상품">
        <div class="category-tabs" role="tablist" aria-label="상품 카테고리">
          <button class="category-tab active" type="button" data-category="ALL" role="tab" aria-selected="true">ALL</button>
          <button class="category-tab" type="button" data-category="FOOD" role="tab" aria-selected="false">FOOD</button>
          <button class="category-tab" type="button" data-category="LIFE" role="tab" aria-selected="false">LIFE</button>
          <button class="category-tab" type="button" data-category="CARRIER" role="tab" aria-selected="false">CARRIER</button>
        </div>
        <div class="reward-grid" id="reward-grid"></div>
      </section>
      <section class="order-section" aria-labelledby="order-title">
        <div class="section-title-row"><div><p class="eyebrow">MY REWARDS</p><h2 id="order-title">구매내역</h2></div></div>
        <div id="order-list" class="order-list"></div>
      </section>
    </main>

    <main class="my-page app-page" id="my-page" hidden>
      <section class="my-guest" id="my-guest">
        <span class="guest-character" aria-hidden="true">🌱</span>
        <p class="eyebrow">WELCOME TO GREENON</p>
        <h1>나의 초록 습관을<br />기록해 보세요</h1>
        <p>로그인하면 GREEN LEVEL과 활동 리포트를 확인할 수 있어요.</p>
        <button class="primary-button" id="open-auth" type="button">로그인 / 회원가입</button>
      </section>

      <div class="my-member" id="my-member" hidden>
        <section class="profile-card">
          <div class="profile-avatar" aria-hidden="true">G</div>
          <div><p>안녕하세요!</p><h1><span id="profile-name">그린이</span> 님</h1><small id="profile-email"></small></div>
          <button class="logout-button" id="logout-button" type="button">로그아웃</button>
        </section>

        <section class="level-card" aria-labelledby="level-title">
          <div class="level-heading"><div><p class="eyebrow">MY GREEN LEVEL</p><h2 id="level-title"><span id="level-icon">🌱</span> <span id="level-name">GREEN SPROUT</span></h2></div><strong id="level-point">0 P</strong></div>
          <p id="level-description">첫 미션을 완료하고 초록 새싹을 키워보세요.</p>
          <div class="level-track"><i id="level-bar"></i></div>
          <small id="level-next">다음 레벨까지 300 P</small>
        </section>

        <section class="report-section" aria-labelledby="report-title">
          <div class="section-title-row"><div><p class="eyebrow">GREEN REPORT</p><h2 id="report-title">나의 친환경 리포트</h2></div></div>
          <div class="report-grid">
            <article><span aria-hidden="true">✓</span><strong id="report-missions">0</strong><small>성공 미션</small></article>
            <article><span aria-hidden="true">P</span><strong id="report-earned">0 P</strong><small>누적 적립</small></article>
            <article><span aria-hidden="true">♧</span><strong id="report-orders">0</strong><small>받은 리워드</small></article>
            <article><span aria-hidden="true">⚡</span><strong id="report-energy">0 kWh</strong><small>예상 절감량</small></article>
          </div>
          <div class="report-message" id="report-message">첫 GREEN MISSION을 기다리고 있어요.</div>
        </section>
      </div>
    </main>

    <dialog class="reward-dialog" id="reward-dialog" aria-labelledby="reward-dialog-title">
      <button class="dialog-close" id="dialog-close" type="button" aria-label="상품 상세 닫기">×</button>
      <div class="dialog-product-icon" id="dialog-product-icon" aria-hidden="true"></div>
      <p class="dialog-category" id="dialog-category"></p>
      <h2 id="reward-dialog-title"></h2>
      <p class="dialog-description" id="dialog-description"></p>
      <div class="purchase-summary"><span>필요 포인트</span><strong id="dialog-price"></strong></div>
      <div class="purchase-summary"><span>구매 후 잔액</span><strong id="dialog-after-balance"></strong></div>
      <div class="purchase-warning" id="purchase-warning" role="alert" hidden><strong>포인트가 부족해요</strong><p>GREEN MISSION을 완료하고 포인트를 더 모아주세요.</p></div>
      <button class="purchase-button" id="purchase-button" type="button">포인트로 구매하기</button>
    </dialog>

    <dialog class="auth-dialog" id="auth-dialog" aria-labelledby="auth-title">
      <button class="dialog-close" id="auth-close" type="button" aria-label="로그인 창 닫기">×</button>
      <span class="auth-logo" aria-hidden="true">G</span>
      <h2 id="auth-title">Carrier GreenON</h2>
      <p class="auth-subtitle">초록 냉방 습관을 함께 시작해요.</p>
      <div class="auth-tabs" role="tablist" aria-label="사용자 인증 방식">
        <button class="auth-tab active" type="button" data-auth-mode="login" role="tab" aria-selected="true">로그인</button>
        <button class="auth-tab" type="button" data-auth-mode="signup" role="tab" aria-selected="false">회원가입</button>
      </div>
      <form id="auth-form">
        <label id="name-field" hidden>이름<input id="auth-name" name="name" type="text" autocomplete="name" maxlength="20" placeholder="그린이" /></label>
        <label>이메일<input id="auth-email" name="email" type="email" autocomplete="email" required placeholder="green@example.com" /></label>
        <label>비밀번호<input id="auth-password" name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="6자 이상 입력" /></label>
        <p class="auth-error" id="auth-error" role="alert" hidden></p>
        <button class="primary-button" id="auth-submit" type="submit">로그인</button>
      </form>
      <p class="auth-notice" id="auth-notice">Supabase가 로그인 정보를 안전하게 관리합니다.</p>
    </dialog>

    <nav class="bottom-nav" aria-label="주요 메뉴">
      <a class="nav-item active" href="#home" data-page="home" aria-current="page"><span aria-hidden="true">⌂</span>홈</a>
      <a class="nav-item" href="#mission" data-page="mission"><span aria-hidden="true">✓</span>미션</a>
      <a class="nav-item" href="#wallet" data-page="wallet"><span aria-hidden="true">◇</span>지갑</a>
      <a class="nav-item" href="#shop" data-page="shop"><span aria-hidden="true">♧</span>리워드</a>
      <a class="nav-item" href="#my" data-page="my"><span aria-hidden="true">○</span>MY</a>
    </nav>
  </div>
`;

// 데스크톱 마우스 뒤에 짧게 남는 푸른 냉기 입자를 그립니다.
// 투명 캔버스는 클릭을 받지 않으므로 아래의 버튼과 링크 동작을 방해하지 않습니다.
function initializeWindCursor() {
  const canvas = document.querySelector("#wind-cursor-canvas");
  const context = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const particles = [];
  let animationFrame = null;
  let previousPoint = null;

  function resizeCanvas() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * pixelRatio);
    canvas.height = Math.round(window.innerHeight * pixelRatio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function drawWind() {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.life -= 0.035;
      particle.x += particle.velocityX;
      particle.y += particle.velocityY + Math.sin(particle.phase) * 0.22;
      particle.phase += 0.18;

      if (particle.life <= 0) {
        particles.splice(index, 1);
        continue;
      }

      context.beginPath();
      context.moveTo(particle.x, particle.y);
      context.quadraticCurveTo(
        particle.x - particle.length * 0.5,
        particle.y + Math.sin(particle.phase) * 5,
        particle.x - particle.length,
        particle.y,
      );
      context.strokeStyle = `rgba(38, 145, 255, ${particle.life * 0.62})`;
      context.lineWidth = particle.width;
      context.lineCap = "round";
      context.stroke();
    }

    animationFrame = particles.length ? requestAnimationFrame(drawWind) : null;
  }

  window.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || reduceMotion.matches) return;
    const distance = previousPoint ? Math.hypot(event.clientX - previousPoint.x, event.clientY - previousPoint.y) : 20;
    previousPoint = { x: event.clientX, y: event.clientY };
    if (distance < 3) return;

    // 한 번에 적은 수의 입자만 만들어 부드러운 바람 결을 표현합니다.
    for (let index = 0; index < Math.min(3, Math.ceil(distance / 12)); index += 1) {
      particles.push({
        x: event.clientX + (Math.random() - 0.5) * 10,
        y: event.clientY + (Math.random() - 0.5) * 12,
        velocityX: -0.35 - Math.random() * 0.45,
        velocityY: (Math.random() - 0.5) * 0.3,
        length: 16 + Math.random() * 24,
        width: 1 + Math.random() * 1.4,
        life: 0.65 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
      });
    }
    if (particles.length > 90) particles.splice(0, particles.length - 90);
    if (!animationFrame) animationFrame = requestAnimationFrame(drawWind);
  }, { passive: true });

  window.addEventListener("resize", resizeCanvas, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => { previousPoint = null; });
  resizeCanvas();
}

initializeWindCursor();

// 모든 메뉴는 스크롤 위치가 아닌 각각의 독립 화면으로 전환합니다.
const pageNames = ["home", "mission", "wallet", "shop", "my"];

function showPage(targetPage, updateHistory = true) {
  const safePage = pageNames.includes(targetPage) ? targetPage : "home";
  document.querySelectorAll(".app-page").forEach((page) => { page.hidden = page.id !== `${safePage}-page`; });
  document.querySelectorAll(".nav-item").forEach((navItem) => {
    const isActive = navItem.dataset.page === safePage;
    navItem.classList.toggle("active", isActive);
    if (isActive) navItem.setAttribute("aria-current", "page");
    else navItem.removeAttribute("aria-current");
  });
  if (safePage === "wallet") renderWallet();
  if (safePage === "shop") renderShop();
  if (safePage === "my") renderMyPage();
  if (updateHistory && window.location.hash !== `#${safePage}`) window.history.pushState(null, "", `#${safePage}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    showPage(item.dataset.page);
  });
});

// 브라우저의 뒤로/앞으로 가기와 주소 해시 직접 접근도 같은 화면 전환 규칙을 사용합니다.
window.addEventListener("popstate", () => showPage(window.location.hash.slice(1), false));
if (window.location.hash) showPage(window.location.hash.slice(1), false);

// 거래 시각을 한국어 날짜와 시간으로 표시합니다.
function formatTransactionDate(value) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

// 선택된 탭에 맞춰 적립과 사용 내역을 그립니다.
function renderTransactions(filter = "all") {
  const list = document.querySelector("#transaction-list");
  const transactions = pointState.transactions.filter((item) => filter === "all" || item.type === filter);

  if (transactions.length === 0) {
    list.innerHTML = `<div class="empty-history"><span aria-hidden="true">◇</span><strong>아직 ${filter === "use" ? "사용" : "포인트"} 내역이 없어요</strong><p>GREEN MISSION에 참여해 첫 포인트를 모아보세요.</p></div>`;
    return;
  }

  list.innerHTML = transactions.map((item) => `
    <article class="transaction-item">
      <span class="transaction-icon ${item.type}" aria-hidden="true">${item.type === "earn" ? "+" : "−"}</span>
      <div><strong>${item.title}</strong><time datetime="${item.createdAt}">${formatTransactionDate(item.createdAt)}</time></div>
      <b class="${item.type}">${item.type === "earn" ? "+" : "−"}${item.amount.toLocaleString("ko-KR")} P</b>
    </article>
  `).join("");
}

function renderWallet() {
  document.querySelector("#wallet-balance").textContent = pointState.balance.toLocaleString("ko-KR");
  const activeFilter = document.querySelector(".transaction-tab.active")?.dataset.filter || "all";
  renderTransactions(activeFilter);
}

// 상품 카테고리에 맞는 카드 목록을 생성합니다.
function renderRewards(category = "ALL") {
  const visibleRewards = rewards.filter((reward) => category === "ALL" || reward.category === category);
  document.querySelector("#reward-grid").innerHTML = visibleRewards.map((reward) => `
    <article class="reward-card">
      <button type="button" data-reward-id="${reward.id}" aria-label="${reward.name} 상세 보기">
        <span class="reward-image ${reward.color}" aria-hidden="true">${reward.icon}</span>
        <span class="reward-category">${reward.category}</span>
        <strong>${reward.name}</strong>
        <small>${reward.description}</small>
        <b>${reward.price.toLocaleString("ko-KR")} P</b>
      </button>
    </article>
  `).join("");

  document.querySelectorAll("[data-reward-id]").forEach((button) => {
    button.addEventListener("click", () => openRewardDialog(button.dataset.rewardId));
  });
}

// 구매한 상품을 최신순으로 표시합니다.
function renderOrders() {
  const orderList = document.querySelector("#order-list");
  if (pointState.orders.length === 0) {
    orderList.innerHTML = `<div class="empty-history"><span aria-hidden="true">♧</span><strong>아직 구매한 리워드가 없어요</strong><p>모은 포인트로 첫 리워드를 만나보세요.</p></div>`;
    return;
  }

  orderList.innerHTML = pointState.orders.map((order) => `
    <article class="order-item"><span aria-hidden="true">${order.icon}</span><div><strong>${order.name}</strong><time datetime="${order.createdAt}">${formatTransactionDate(order.createdAt)}</time></div><b>${order.price.toLocaleString("ko-KR")} P</b></article>
  `).join("");
}

function renderShop() {
  document.querySelector("#shop-balance").textContent = pointState.balance.toLocaleString("ko-KR");
  const activeCategory = document.querySelector(".category-tab.active")?.dataset.category || "ALL";
  renderRewards(activeCategory);
  renderOrders();
}

// 누적 적립 포인트에 따라 사용자의 GREEN LEVEL을 계산합니다.
function getGreenLevel(totalEarned) {
  if (totalEarned >= 1500) return { name: "GREEN HERO", icon: "🌳", min: 1500, next: null, description: "지구를 위한 멋진 냉방 습관의 주인공이에요!" };
  if (totalEarned >= 700) return { name: "GREEN TREE", icon: "🌿", min: 700, next: 1500, description: "꾸준한 실천으로 초록 나무가 자라고 있어요." };
  if (totalEarned >= 300) return { name: "GREEN LEAF", icon: "🍃", min: 300, next: 700, description: "좋은 냉방 습관이 싱그러운 잎이 되었어요." };
  return { name: "GREEN SPROUT", icon: "🌱", min: 0, next: 300, description: "첫 미션을 완료하고 초록 새싹을 키워보세요." };
}

// 지갑과 구매 데이터를 요약하여 MY 페이지의 리포트를 갱신합니다.
function renderMyPage() {
  document.querySelector("#my-guest").hidden = Boolean(currentUser);
  document.querySelector("#my-member").hidden = !currentUser;
  document.querySelector("#profile-button").textContent = currentUser ? currentUser.name.slice(0, 1).toUpperCase() : "ON";
  if (!currentUser) return;

  const earned = pointState.transactions.filter((item) => item.type === "earn").reduce((sum, item) => sum + item.amount, 0);
  const successfulMissions = pointState.transactions.filter((item) => item.type === "earn" && item.title.includes("MISSION")).length;
  const level = getGreenLevel(earned);
  const levelProgress = level.next ? Math.min(100, Math.round(((earned - level.min) / (level.next - level.min)) * 100)) : 100;

  document.querySelector("#profile-name").textContent = currentUser.name;
  document.querySelector("#profile-email").textContent = currentUser.email;
  document.querySelector("#level-icon").textContent = level.icon;
  document.querySelector("#level-name").textContent = level.name;
  document.querySelector("#level-point").textContent = `${earned.toLocaleString("ko-KR")} P`;
  document.querySelector("#level-description").textContent = level.description;
  document.querySelector("#level-bar").style.width = `${levelProgress}%`;
  document.querySelector("#level-next").textContent = level.next ? `다음 레벨까지 ${(level.next - earned).toLocaleString("ko-KR")} P` : "최고 레벨을 달성했어요!";
  document.querySelector("#report-missions").textContent = String(successfulMissions);
  document.querySelector("#report-earned").textContent = `${earned.toLocaleString("ko-KR")} P`;
  document.querySelector("#report-orders").textContent = String(pointState.orders.length);
  document.querySelector("#report-energy").textContent = `${(successfulMissions * 0.48).toFixed(2)} kWh`;
  document.querySelector("#report-message").textContent = successfulMissions > 0 ? `${currentUser.name} 님의 작은 실천이 시원한 변화를 만들고 있어요!` : "첫 GREEN MISSION을 기다리고 있어요.";
}

// 모든 방문자가 볼 수 있는 활성 미션과 리워드 카탈로그를 Supabase에서 불러옵니다.
async function loadCatalogData() {
  if (!supabase) return;
  const [missionResult, rewardResult] = await Promise.all([
    supabase.from("missions").select("*").eq("active", true).order("created_at").limit(1),
    supabase.from("rewards").select("*").eq("active", true).order("created_at"),
  ]);
  if (missionResult.error) console.error("미션 조회 오류:", missionResult.error.message);
  if (rewardResult.error) console.error("리워드 조회 오류:", rewardResult.error.message);
  activeMissionId = missionResult.data?.[0]?.id || null;
  rewards = rewardResult.data || [];
  renderShop();
}

// 로그아웃 시 이전 사용자의 데이터가 다음 화면에 남지 않도록 메모리를 초기화합니다.
function resetUserData() {
  pointState.balance = 0;
  pointState.transactions = [];
  pointState.orders = [];
  activeUserMissionId = null;
  missionState.status = "ready";
  missionState.elapsedMinutes = 0;
  Object.assign(airconState, { power: true, mode: "냉방", temperature: 26, fan: "자동", runtimeMinutes: 0, filterPercent: 100, sensorError: false });
  renderAirconState();
  renderMissionState();
  renderWallet();
  renderShop();
  renderMyPage();
}

// 로그인 사용자의 지갑·구매·에어컨·미션 데이터를 한 번에 복원합니다.
async function loadUserData() {
  if (!supabase || !currentUser) return;
  const [profileResult, transactionsResult, ordersResult, airconResult, missionResult] = await Promise.all([
    supabase.from("profiles").select("total_points, green_level_key").eq("id", currentUser.id).single(),
    supabase.from("point_transactions").select("*").order("created_at", { ascending: false }),
    supabase.from("reward_orders").select("id, point_price, created_at, rewards(name, icon)").order("created_at", { ascending: false }),
    supabase.from("aircon_status").select("*").eq("user_id", currentUser.id).maybeSingle(),
    supabase.from("user_missions").select("id, mission_id, status, progress_minutes, reward_claimed").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  for (const result of [profileResult, transactionsResult, ordersResult, airconResult, missionResult]) {
    if (result.error) console.error("사용자 데이터 조회 오류:", result.error.message);
  }

  pointState.balance = profileResult.data?.total_points || 0;
  pointState.transactions = (transactionsResult.data || []).map((item) => ({
    id: item.id, type: item.transaction_type, title: item.title, amount: item.amount, createdAt: item.created_at,
  }));
  pointState.orders = (ordersResult.data || []).map((item) => ({
    id: item.id, name: item.rewards?.name || "리워드 상품", icon: item.rewards?.icon || "♧", price: item.point_price, createdAt: item.created_at,
  }));

  if (airconResult.data) {
    const modeMap = { cooling: "냉방", fan: "송풍", dry: "제습" };
    const fanMap = { auto: "자동", low: "약풍", medium: "중풍", high: "강풍" };
    Object.assign(airconState, {
      power: airconResult.data.power,
      mode: modeMap[airconResult.data.mode] || "냉방",
      temperature: airconResult.data.temperature,
      fan: fanMap[airconResult.data.fan] || "자동",
      runtimeMinutes: airconResult.data.runtime_minutes,
      filterPercent: airconResult.data.filter_percent,
      sensorError: airconResult.data.sensor_error,
    });
  } else {
    await persistAirconState();
  }

  if (missionResult.data) {
    activeUserMissionId = missionResult.data.id;
    missionState.status = missionResult.data.status;
    missionState.elapsedMinutes = missionResult.data.progress_minutes;
  } else {
    activeUserMissionId = null;
    missionState.status = "ready";
    missionState.elapsedMinutes = 0;
  }

  renderAirconState();
  renderMissionState();
  renderWallet();
  renderShop();
  renderMyPage();
}

// 조작한 가상 에어컨 상태를 현재 사용자 행에 upsert합니다.
async function persistAirconState() {
  if (!supabase || !currentUser) return;
  const modeMap = { "냉방": "cooling", "송풍": "fan", "제습": "dry" };
  const fanMap = { "자동": "auto", "약풍": "low", "중풍": "medium", "강풍": "high" };
  const { error } = await supabase.from("aircon_status").upsert({
    user_id: currentUser.id,
    power: airconState.power,
    mode: modeMap[airconState.mode],
    temperature: airconState.temperature,
    fan: fanMap[airconState.fan],
    runtime_minutes: airconState.runtimeMinutes,
    filter_percent: airconState.filterPercent,
    sensor_error: airconState.sensorError,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error("에어컨 상태 저장 오류:", error.message);
}

// 인증 사용자에게 필요한 profiles 행을 본인 권한으로 생성하거나 읽습니다.
async function loadAuthenticatedUser(user) {
  if (!user || !supabase) {
    currentUser = null;
    resetUserData();
    return;
  }

  const fallbackName = user.user_metadata?.display_name || user.email?.split("@")[0] || "그린이";
  const { data: profile, error: selectError } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) console.error("프로필 조회 오류:", selectError.message);

  if (!profile) {
    const { error: insertError } = await supabase.from("profiles").insert({ id: user.id, display_name: fallbackName });
    if (insertError) console.error("프로필 생성 오류:", insertError.message);
  }

  currentUser = { id: user.id, name: profile?.display_name || fallbackName, email: user.email || "" };
  renderMyPage();
  await loadUserData();
}

function openAuthDialog() {
  document.querySelector("#auth-error").hidden = true;
  document.querySelector("#auth-notice").textContent = isSupabaseConfigured ? "Supabase가 로그인 정보를 안전하게 관리합니다." : "Supabase 환경변수 설정이 필요합니다.";
  document.querySelector("#auth-dialog").showModal();
}

document.querySelector("#profile-button").addEventListener("click", () => {
  if (currentUser) document.querySelector('[data-page="my"]').click();
  else openAuthDialog();
});
document.querySelector("#open-auth").addEventListener("click", openAuthDialog);
document.querySelector("#auth-close").addEventListener("click", () => document.querySelector("#auth-dialog").close());

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const isSignup = tab.dataset.authMode === "signup";
    document.querySelectorAll(".auth-tab").forEach((item) => {
      const isActive = item === tab;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-selected", String(isActive));
    });
    document.querySelector("#name-field").hidden = !isSignup;
    document.querySelector("#auth-name").required = isSignup;
    document.querySelector("#auth-password").autocomplete = isSignup ? "new-password" : "current-password";
    document.querySelector("#auth-submit").textContent = isSignup ? "회원가입하고 시작하기" : "로그인";
    document.querySelector("#auth-error").hidden = true;
  });
});

// Supabase의 기술적인 영문 오류를 사용자가 바로 이해할 수 있는 안내로 바꿉니다.
function getAuthErrorMessage(authError, isSignup) {
  const code = authError?.code || "";
  const message = authError?.message?.toLowerCase() || "";

  if (code === "user_already_exists" || message.includes("already registered")) {
    return "이미 가입된 이메일이에요. 로그인 화면으로 전환했습니다.";
  }
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "이메일 인증이 아직 완료되지 않았어요. 받은 메일을 확인해 주세요.";
  }
  if (code === "weak_password" || message.includes("password")) {
    return isSignup ? "더 안전한 비밀번호를 입력해 주세요." : "비밀번호를 다시 확인해 주세요.";
  }
  if (code.includes("rate_limit") || message.includes("rate limit")) {
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  }
  return "인증 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
}

// 비밀번호는 Supabase Auth로 직접 전달하며 앱의 저장소에는 기록하지 않습니다.
document.querySelector("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const isSignup = document.querySelector('[data-auth-mode="signup"]').classList.contains("active");
  const email = document.querySelector("#auth-email").value.trim().toLowerCase();
  const name = document.querySelector("#auth-name").value.trim();
  const password = document.querySelector("#auth-password").value;
  const error = document.querySelector("#auth-error");
  const submitButton = document.querySelector("#auth-submit");

  if (!supabase) {
    error.textContent = "Supabase 환경변수가 설정되지 않았어요.";
    error.hidden = false;
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "처리 중...";
  error.hidden = true;

  const result = isSignup
    ? await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
          // 이메일 인증을 마치면 현재 실행 중인 로컬 또는 배포 사이트로 돌아옵니다.
          emailRedirectTo: window.location.origin,
        },
      })
    : await supabase.auth.signInWithPassword({ email, password });

  submitButton.disabled = false;
  submitButton.textContent = isSignup ? "회원가입하고 시작하기" : "로그인";

  if (result.error) {
    const isAlreadyRegistered = result.error.code === "user_already_exists"
      || result.error.message.toLowerCase().includes("already registered");
    // 이미 가입된 주소라면 다시 입력하게 하지 않고 곧바로 로그인 탭으로 안내합니다.
    if (isSignup && isAlreadyRegistered) document.querySelector('[data-auth-mode="login"]').click();
    error.textContent = getAuthErrorMessage(result.error, isSignup);
    error.hidden = false;
    return;
  }

  document.querySelector("#auth-form").reset();
  if (isSignup && !result.data.session) {
    document.querySelector("#auth-notice").textContent = "가입 확인 메일을 보냈어요. 이메일 확인 후 로그인해 주세요.";
    return;
  }

  await loadAuthenticatedUser(result.data.user);
  document.querySelector("#auth-dialog").close();
  document.querySelector('[data-page="my"]').click();
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) console.error("로그아웃 오류:", error.message);
});

// 선택한 상품의 상세와 현재 잔액 기준 구매 가능 여부를 표시합니다.
function openRewardDialog(rewardId) {
  const reward = rewards.find((item) => item.id === rewardId);
  if (!reward) return;
  selectedRewardId = rewardId;
  document.querySelector("#dialog-product-icon").textContent = reward.icon;
  document.querySelector("#dialog-product-icon").className = `dialog-product-icon ${reward.color}`;
  document.querySelector("#dialog-category").textContent = reward.category;
  document.querySelector("#reward-dialog-title").textContent = reward.name;
  document.querySelector("#dialog-description").textContent = reward.description;
  document.querySelector("#dialog-price").textContent = `${reward.price.toLocaleString("ko-KR")} P`;
  document.querySelector("#dialog-after-balance").textContent = `${Math.max(0, pointState.balance - reward.price).toLocaleString("ko-KR")} P`;
  document.querySelector("#purchase-warning").hidden = pointState.balance >= reward.price;
  document.querySelector("#purchase-button").classList.toggle("is-insufficient", pointState.balance < reward.price);
  document.querySelector("#reward-dialog").showModal();
}

document.querySelectorAll(".category-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".category-tab").forEach((item) => {
      const isActive = item === tab;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-selected", String(isActive));
    });
    renderRewards(tab.dataset.category);
  });
});

document.querySelector("#dialog-close").addEventListener("click", () => document.querySelector("#reward-dialog").close());
document.querySelector("#reward-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});

// 잔액을 다시 검사한 뒤 차감·사용 기록·구매내역을 한 번에 저장합니다.
document.querySelector("#purchase-button").addEventListener("click", async () => {
  const reward = rewards.find((item) => item.id === selectedRewardId);
  if (!reward) return;
  if (!currentUser || !supabase) {
    document.querySelector("#reward-dialog").close();
    openAuthDialog();
    return;
  }
  if (pointState.balance < reward.price) {
    document.querySelector("#purchase-warning").hidden = false;
    document.querySelector("#purchase-button").classList.add("is-insufficient");
    return;
  }

  const purchaseButton = document.querySelector("#purchase-button");
  purchaseButton.disabled = true;
  purchaseButton.textContent = "구매 처리 중...";
  const { error } = await supabase.rpc("purchase_green_reward", { p_reward_id: reward.id });
  purchaseButton.disabled = false;
  purchaseButton.textContent = "포인트로 구매하기";
  if (error) {
    document.querySelector("#purchase-warning").hidden = false;
    document.querySelector("#purchase-warning strong").textContent = error.message.includes("insufficient") ? "포인트가 부족해요" : "구매를 완료하지 못했어요";
    return;
  }

  await loadUserData();
  document.querySelector("#reward-dialog").close();
});

document.querySelectorAll(".transaction-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".transaction-tab").forEach((item) => {
      const isActive = item === tab;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-selected", String(isActive));
    });
    renderTransactions(tab.dataset.filter);
  });
});

// 현재 날씨와 조건별 추천 미션을 홈 카드에 함께 표시합니다.
function renderWeather() {
  const recommendation = getWeatherMission(weatherState);
  document.querySelector("#weather-location").textContent = weatherState.location;
  document.querySelector("#weather-label").textContent = getWeatherLabel(weatherState.weatherCode);
  document.querySelector("#weather-temperature").textContent = `${weatherState.temperature}°`;
  document.querySelector("#weather-humidity").textContent = `습도 ${weatherState.humidity}%`;
  document.querySelector("#weather-helper").textContent = weatherState.temperature >= 28 || weatherState.humidity >= 70 ? "친환경 냉방이 필요한 날이에요" : "창문 환기도 좋은 날씨예요";
  document.querySelector("#weather-source").textContent = weatherState.source === "open-meteo" ? "Open-Meteo 실시간 모델 데이터" : "네트워크 연결 전 샘플 데이터";
  document.querySelector("#weather-mission-tip").dataset.weatherType = recommendation.type;
  document.querySelector("#weather-mission-title").textContent = recommendation.title;
  document.querySelector("#weather-mission-copy").textContent = recommendation.copy;
}

// API 실패 시 샘플을 유지하고 오류를 Red로 과장하지 않고 안내 문구만 표시합니다.
async function updateWeather(position) {
  const refreshButton = document.querySelector("#weather-refresh");
  refreshButton.disabled = true;
  refreshButton.textContent = "날씨 확인 중...";
  try {
    weatherState = await fetchCurrentWeather(position);
  } catch (error) {
    console.error("날씨 조회 오류:", error.message);
    weatherState = { ...sampleWeather };
    document.querySelector("#weather-source").textContent = "API 연결 실패 · 서울 샘플 데이터 사용 중";
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "서울 날씨 새로고침";
    renderWeather();
  }
}

document.querySelector("#weather-refresh").addEventListener("click", () => updateWeather());
document.querySelector("#weather-location-button").addEventListener("click", async () => {
  const button = document.querySelector("#weather-location-button");
  button.disabled = true;
  button.textContent = "위치 확인 중...";
  try {
    const position = await requestCurrentPosition();
    await updateWeather(position);
  } catch (error) {
    document.querySelector("#weather-source").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "내 위치 사용";
  }
});

// 분 단위 사용 시간을 사용자가 읽기 쉬운 형태로 바꿉니다.
function formatRuntime(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}분`;
  if (remainingMinutes === 0) return `${hours}시간`;
  return `${hours}시간 ${remainingMinutes}분`;
}

// 필터 수치나 센서 오류가 있으면 비정상 상태로 판단합니다.
function getAirconWarning() {
  if (airconState.sensorError) return { title: "센서 연결 오류", copy: "온도 센서 신호를 확인해 주세요.", type: "sensor" };
  if (airconState.filterPercent <= 20) return { title: "필터 점검 필요", copy: "깨끗한 냉방을 위해 필터를 청소해 주세요.", type: "filter" };
  return null;
}

// 현재 기기 상태가 오늘의 미션 조건에 맞는지 확인하고 위반 사유를 반환합니다.
function getMissionViolation() {
  if (!airconState.power) return "에어컨 전원을 켜야 해요.";
  if (airconState.mode !== "냉방") return "운전 모드를 냉방으로 변경해 주세요.";
  if (airconState.temperature !== 26) return "설정 온도를 26°C로 맞춰 주세요.";
  if (airconState.sensorError) return "센서 오류를 해결한 뒤 진행해 주세요.";
  if (airconState.filterPercent <= 20) return "필터를 점검한 뒤 진행해 주세요.";
  return null;
}

// 에어컨 조작 직후 성공 조건 배지와 Warning을 즉시 갱신합니다.
function renderMissionConditions() {
  const conditions = {
    "#condition-power": airconState.power,
    "#condition-mode": airconState.mode === "냉방",
    "#condition-temperature": airconState.temperature === 26,
    "#condition-device": !airconState.sensorError && airconState.filterPercent > 20,
  };

  Object.entries(conditions).forEach(([selector, isMet]) => {
    document.querySelector(selector).classList.toggle("is-met", isMet);
    document.querySelector(selector).classList.toggle("is-unmet", !isMet);
  });

  const warning = document.querySelector("#mission-warning");
  const violation = getMissionViolation();
  const shouldWarn = missionState.status === "active" && Boolean(violation);
  warning.hidden = !shouldWarn;
  if (shouldWarn) document.querySelector("#mission-warning-copy").textContent = violation;
}

// 참여 전·진행 중·성공·실패 상태에 맞춰 미션 영역을 그립니다.
function renderMissionState() {
  const actionButton = document.querySelector("#mission-action");
  const retryButton = document.querySelector("#mission-retry");
  const progressBox = document.querySelector("#mission-progress");
  const missionCard = document.querySelector(".mission-preview");
  const progress = Math.min(100, Math.round((missionState.elapsedMinutes / missionState.goalMinutes) * 100));

  progressBox.hidden = missionState.status === "ready";
  retryButton.hidden = !["success", "failed"].includes(missionState.status);
  actionButton.hidden = ["success", "failed"].includes(missionState.status);
  actionButton.textContent = missionState.status === "active" ? "시간 +30분 진행" : "미션 참여하기";
  document.querySelector("#mission-time").textContent = `${missionState.elapsedMinutes} / ${missionState.goalMinutes}분`;
  document.querySelector("#mission-progress-bar").style.width = `${progress}%`;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", String(progress));
  missionCard.classList.toggle("is-success", missionState.status === "success");
  missionCard.classList.toggle("is-failed", missionState.status === "failed");

  if (missionState.status === "ready") {
    document.querySelector("#phase-message").textContent = "참여 후 30분 단위로 시간을 진행할 수 있어요.";
  }
  if (missionState.status === "active") {
    document.querySelector("#mission-status-label").textContent = "미션 진행 중";
    document.querySelector("#mission-progress-copy").textContent = "조건을 유지한 뒤 30분 진행 버튼을 눌러주세요.";
    document.querySelector("#phase-message").textContent = "현재 에어컨 상태가 성공 조건에 반영됩니다.";
  }
  if (missionState.status === "success") {
    document.querySelector("#mission-status-label").textContent = "미션 성공!";
    document.querySelector("#mission-progress-copy").textContent = "친환경 냉방 습관을 완성하고 GREEN POINT를 받았어요.";
    document.querySelector("#phase-message").textContent = "지갑에서 적립된 포인트를 확인해 보세요.";
  }
  if (missionState.status === "failed") {
    document.querySelector("#mission-status-label").textContent = "미션 실패";
    document.querySelector("#mission-progress-copy").textContent = "조건을 다시 맞추고 재도전해 보세요.";
    document.querySelector("#phase-message").textContent = "실패한 미션은 처음부터 다시 시작할 수 있어요.";
  }

  renderMissionConditions();
}

// 보상 지급은 DB 함수가 성공 여부와 중복 수령을 다시 검사한 뒤 원자적으로 처리합니다.
async function rewardCompletedMission() {
  if (!supabase || !activeUserMissionId) return;
  const { error } = await supabase.rpc("claim_green_mission_reward", { p_user_mission_id: activeUserMissionId });
  if (error) {
    document.querySelector("#phase-message").textContent = `포인트 지급 오류: ${error.message}`;
    return;
  }
  await loadUserData();
}

// 상태가 변경될 때 화면의 모든 에어컨 정보를 한 번에 갱신합니다.
function renderAirconState() {
  const warning = getAirconWarning();
  const card = document.querySelector("#aircon-card");
  const dashboard = document.querySelector(".aircon-dashboard");
  const statusBox = document.querySelector("#device-status");
  const filterDetail = document.querySelector(".filter-detail");
  const statusChip = document.querySelector("#aircon-chip");

  document.querySelector("#aircon-temperature").textContent = `${airconState.temperature}°C`;
  document.querySelector("#power-value").textContent = airconState.power ? "ON" : "OFF";
  document.querySelector("#mode-value").textContent = airconState.mode;
  document.querySelector("#fan-value").textContent = airconState.fan;
  document.querySelector("#runtime-value").textContent = formatRuntime(airconState.runtimeMinutes);
  document.querySelector("#filter-value").textContent = airconState.filterPercent <= 20 ? `점검 필요 · ${airconState.filterPercent}%` : `좋음 · ${airconState.filterPercent}%`;
  document.querySelector("#filter-bar").style.width = `${airconState.filterPercent}%`;

  card.classList.toggle("is-warning", Boolean(warning));
  dashboard.classList.toggle("is-warning", Boolean(warning));
  statusBox.classList.toggle("is-warning", Boolean(warning));
  filterDetail.classList.toggle("is-warning", airconState.filterPercent <= 20);
  renderMissionConditions();

  if (warning) {
    document.querySelector("#aircon-summary").textContent = warning.title;
    document.querySelector("#aircon-helper").textContent = warning.copy;
    document.querySelector("#device-status-title").textContent = warning.title;
    document.querySelector("#device-status-copy").textContent = warning.copy;
    statusChip.textContent = "● 확인 필요";
    return;
  }

  const operatingLabel = airconState.power ? `${airconState.mode} 중` : "전원 꺼짐";
  document.querySelector("#aircon-summary").textContent = airconState.power ? "정상 작동 중" : "대기 상태";
  document.querySelector("#aircon-helper").textContent = airconState.power ? "모든 상태가 정상이에요" : "현재 에어컨을 사용하지 않고 있어요";
  document.querySelector("#device-status-title").textContent = airconState.power ? `쾌적하게 ${airconState.mode} 중` : "에어컨 전원 OFF";
  document.querySelector("#device-status-copy").textContent = "가상 센서가 정상적으로 연결되어 있어요.";
  statusChip.textContent = `● ${operatingLabel}`;
}

// 시뮬레이션 버튼에 따라 가상 데이터만 변경하며 실제 기기 API에는 접근하지 않습니다.
document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const action = button.dataset.action;
    const modes = ["냉방", "송풍", "제습"];
    const fanLevels = ["자동", "약풍", "중풍", "강풍"];

    if (action === "power") airconState.power = !airconState.power;
    if (action === "mode") airconState.mode = modes[(modes.indexOf(airconState.mode) + 1) % modes.length];
    if (action === "fan") airconState.fan = fanLevels[(fanLevels.indexOf(airconState.fan) + 1) % fanLevels.length];
    if (action === "temperature-down") airconState.temperature = Math.max(18, airconState.temperature - 1);
    if (action === "temperature-up") airconState.temperature = Math.min(30, airconState.temperature + 1);
    if (action === "runtime") airconState.runtimeMinutes += 30;
    if (action === "filter") airconState.filterPercent = airconState.filterPercent <= 20 ? 86 : 12;
    if (action === "sensor") airconState.sensorError = !airconState.sensorError;
    if (action === "reset") Object.assign(airconState, { power: true, mode: "냉방", temperature: 26, fan: "자동", runtimeMinutes: 90, filterPercent: 86, sensorError: false });

    renderAirconState();
    await persistAirconState();
  });
});

// 미션 참여와 시간 진행은 분리하여 사용자가 상태 변화를 직접 확인할 수 있게 합니다.
document.querySelector("#mission-action").addEventListener("click", async () => {
  if (!currentUser || !supabase) {
    openAuthDialog();
    return;
  }

  if (missionState.status === "ready") {
    if (!activeMissionId) {
      document.querySelector("#phase-message").textContent = "활성 미션 정보를 불러오지 못했어요.";
      return;
    }
    const { data, error } = await supabase.from("user_missions").insert({ user_id: currentUser.id, mission_id: activeMissionId }).select("id").single();
    if (error) {
      document.querySelector("#phase-message").textContent = `미션 참여 오류: ${error.message}`;
      return;
    }
    activeUserMissionId = data.id;
    missionState.status = "active";
    missionState.elapsedMinutes = 0;
    renderMissionState();
    return;
  }

  const violation = getMissionViolation();
  const { data, error } = await supabase.rpc("advance_green_mission", {
    p_user_mission_id: activeUserMissionId,
    p_conditions_met: !violation,
  });
  if (error) {
    document.querySelector("#phase-message").textContent = `미션 진행 오류: ${error.message}`;
    return;
  }

  missionState.status = data.status;
  missionState.elapsedMinutes = data.progress_minutes;
  if (!violation) {
    airconState.runtimeMinutes += 30;
    await persistAirconState();
  }
  renderAirconState();
  renderMissionState();
  if (missionState.status === "success") await rewardCompletedMission();
});

// 성공하거나 실패한 미션을 초기 상태로 되돌려 반복 체험할 수 있습니다.
document.querySelector("#mission-retry").addEventListener("click", () => {
  missionState.status = "ready";
  missionState.elapsedMinutes = 0;
  activeUserMissionId = null;
  renderMissionState();
});

renderAirconState();
renderMissionState();
renderWallet();
renderShop();
renderMyPage();
renderWeather();
await loadCatalogData();
updateWeather();

// 새로고침 시 기존 세션을 복원하고 로그인 상태 변경을 화면에 반영합니다.
if (supabase) {
  const { data: { session } } = await supabase.auth.getSession();
  await loadAuthenticatedUser(session?.user || null);
  supabase.auth.onAuthStateChange((_event, nextSession) => {
    // 콜백 안에서 추가 Auth 요청을 기다리지 않고 사용자 화면만 안전하게 갱신합니다.
    if (!nextSession?.user) {
      currentUser = null;
      resetUserData();
    } else {
      setTimeout(() => loadAuthenticatedUser(nextSession.user), 0);
    }
  });
}

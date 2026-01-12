/**
 * main.js
 * 게임 UI 렌더링 및 엔진 연결
 */

let poseEngine;
let gameEngine;
let stabilizer;
let ctx;
let canvas;
let canvasWidth, canvasHeight;
let gameTimerId = null; // 1초 단위 타이머 ID
let currentBasketX = null; // 바구니 스무딩용 좌표

// 이미지 에셋 로드
const images = {
  apple: new Image(),
  orange: new Image(),
  bomb: new Image(),
  basket: new Image(),
  watermelon: new Image(),
  hourglass: new Image(),
  shield: new Image()
};

const v = new Date().getTime();
images.apple.src = "./images/apple.png?v=" + v;
images.orange.src = "./images/orange.png?v=" + v;
images.bomb.src = "./images/bomb.png?v=" + v;
images.basket.src = "./images/basket.png?v=" + v;
images.watermelon.src = "./images/watermelon.png?v=" + v;
images.hourglass.src = "./images/hourglass.png?v=" + v;
images.shield.src = "./images/shield.png?v=" + v;

// 이미지가 로드되었는지 확인하는 헬퍼
function isImageLoaded(img) {
  return img.complete && img.naturalHeight !== 0;
}

async function init() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  // 초기화 중 중복 클릭 방지
  startBtn.disabled = true;
  startBtn.innerText = "로딩 중...";

  try {
    // 1. PoseEngine
    poseEngine = new PoseEngine("./my_model/");
    const { webcam } = await poseEngine.init({ size: 200, flip: true });

    // 웹캠을 별도 컨테이너에 추가
    document.getElementById("webcam-container").appendChild(webcam.canvas);

    // 2. Stabilizer
    stabilizer = new PredictionStabilizer({ threshold: 0.6, smoothingFrames: 2 });

    // 3. GameEngine
    gameEngine = new GameEngine();

    // 4. Canvas 설정
    canvas = document.getElementById("canvas");
    // 반응형 크기 조정을 위해 CSS 크기에 맞춤 (또는 고정 크기)
    canvas.width = 600;
    canvas.height = 1575; // 900 * 1.75
    ctx = canvas.getContext("2d");

    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    // 5. 콜백 연결
    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.start();

    gameEngine.setScoreChangeCallback(updateUI);
    gameEngine.setGameEndCallback(endGame);

    // ===============================================
    // [FIX] 초기화 성공 후 버튼 상태 변경 로직
    // ===============================================
    startBtn.innerText = "Game Start";
    startBtn.disabled = false;
    startBtn.onclick = startGameMode; // 클릭 시 게임 시작 함수 연결

    stopBtn.disabled = false;

    // 게임 루프 시작 (렌더링)
    requestAnimationFrame(renderLoop);

  } catch (error) {
    console.error(error);
    alert("초기화 실패 (카메라 권한 확인 필요)");
    // 실패 시 다시 원상 복구
    startBtn.innerText = "Start";
    startBtn.disabled = false;
  }
}

function startGameMode() {
  if (!gameEngine) return;

  // 버튼 비활성화 (게임 중 재시작 방지) or '재시작'으로 변경 가능
  const startBtn = document.getElementById("startBtn");
  startBtn.innerText = "Playing...";
  startBtn.disabled = true;

  gameEngine.start();

  // 메인에서 1초 타이머 별도 구동 (GameEngine의 decreaseTime 호출)
  if (gameTimerId) clearInterval(gameTimerId);
  gameTimerId = setInterval(() => {
    gameEngine.decreaseTime();
  }, 1000);
}

function stop() {
  if (poseEngine) poseEngine.stop();
  if (gameTimerId) clearInterval(gameTimerId);
  if (gameEngine) gameEngine.stop();

  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  // 초기 상태로 복구
  startBtn.disabled = false;
  startBtn.innerText = "Start";
  startBtn.onclick = init; // 다시 init부터 시작하도록

  stopBtn.disabled = true;

  // 캔버스 초기화 (선택 사항)
  // ctx.clearRect(0, 0, canvasWidth, canvasHeight);
}

function handlePrediction(predictions) {
  // 안정화
  const stabilized = stabilizer.stabilize(predictions);

  // 디버그 표시
  const maxPredictionDiv = document.getElementById("max-prediction");
  if (maxPredictionDiv) maxPredictionDiv.innerText = stabilized.className;

  // 게임 엔진에 전달
  if (gameEngine && stabilized.className) {
    gameEngine.setPlayerLane(stabilized.className);
  }
}

function updateUI(score, level, time) {
  // 화면별도 UI 없으므로 pass
}

function endGame(finalScore, finalLevel) {
  if (gameTimerId) clearInterval(gameTimerId);
  alert(`게임 종료! \n점수: ${finalScore}\n레벨: ${finalLevel}`);

  // 게임 종료 후 버튼 상태 복구 (다시 게임 시작 가능하게)
  const startBtn = document.getElementById("startBtn");
  startBtn.innerText = "Game Start";
  startBtn.disabled = false;
  startBtn.onclick = startGameMode;
}

// ==========================================
// 렌더링 루프 (화면 그리기)
// ==========================================
function renderLoop() {
  // 1. 배경 클리어
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 2. 웹캠 배경 그리기 (제거함) - 이제 별도 창에서 확인
  // if (poseEngine && poseEngine.webcam && poseEngine.webcam.canvas) { ... }

  // 3. 게임 라인 그리기
  const laneWidth = canvasWidth / 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(laneWidth, 0);
  ctx.lineTo(laneWidth, canvasHeight);
  ctx.moveTo(laneWidth * 2, 0);
  ctx.lineTo(laneWidth * 2, canvasHeight);
  ctx.stroke();

  // 4. 게임 요소 그리기 (게임 중일 때만)
  if (gameEngine && gameEngine.isGameActive) {

    // (1) 플레이어 (바구니) - 부드러운 이동 (Lerp 적용)
    const targetX = gameEngine.playerLane * laneWidth + (laneWidth / 2);

    // 초기화 안됐으면 바로 이동, 아니면 항상 부드럽게 이동 (Teleport 방지)
    currentBasketX = targetX;

    const playerY = canvasHeight * 0.85; // 바닥에서 조금 위

    drawBasket(currentBasketX, playerY);

    // (2) 떨어지는 아이템들
    gameEngine.items.forEach(item => {
      const itemX = item.lane * laneWidth + (laneWidth / 2);
      // item.y는 0~100 퍼센트 값이므로 픽셀로 변환
      const itemY = (item.y / 100) * canvasHeight;

      drawItem(item.type, itemX, itemY);
    });

    // (3) HUD (점수, 시간)
    drawHUD();
  } else {
    // 대기 화면
    ctx.fillStyle = "white";
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Press Start Button to Play", canvasWidth / 2, canvasHeight / 2);
  }

  requestAnimationFrame(renderLoop);
}

function drawBasket(x, y) {
  const size = 120; // 바구니 크기

  // 방패 효과 (무적) 시각화
  if (gameEngine && gameEngine.effectInvincible) {
    // 맥동 효과 (시간에 따라 크기/투명도 변화주면 좋지만 간단하게 처리)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 191, 255, 0.3)"; // 반투명 푸른색
    ctx.fill();
    ctx.strokeStyle = "rgba(135, 206, 250, 0.8)"; // 밝은 하늘색 테두리
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  if (isImageLoaded(images.basket)) {
    ctx.drawImage(images.basket, x - size / 2, y - size / 2, size, size);
  } else {
    // 로딩 안됐으면 텍스트 대체
    ctx.font = "60px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.textBaseline = "middle";
    ctx.fillText("🧺", x, y);
  }
}

function drawItem(type, x, y) {
  const size = 80; // 아이템 크기
  let img = images.apple;
  let icon = "🍎";

  if (type === 'orange') {
    img = images.orange;
    icon = "🍊";
  }
  if (type === 'bomb') {
    img = images.bomb;
    icon = "💣";
  }
  if (type === 'watermelon') {
    img = images.watermelon;
    icon = "🍉";
  }
  if (type === 'hourglass') {
    img = images.hourglass;
    icon = "⏳";
  }
  if (type === 'shield') {
    img = images.shield;
    icon = "🛡️";
  }

  if (isImageLoaded(img)) {
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  } else {
    // 로딩 실패 시 텍스트
    ctx.font = "50px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "white";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, x, y);
  }
}

function drawHUD() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvasWidth, 50); // 상단 바

  ctx.fillStyle = "white";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${gameEngine.score}`, 20, 32);

  ctx.textAlign = "center";
  ctx.fillText(`Lv.${gameEngine.level}`, canvasWidth / 2, 32);

  ctx.textAlign = "right";
  ctx.fillText(`Time: ${gameEngine.timeLeft}`, canvasWidth - 20, 32);
}

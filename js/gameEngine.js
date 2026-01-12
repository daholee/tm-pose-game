/**
 * gameEngine.js
 * 하늘에서 떨어지는 과일 받기 게임 로직 (Sky Fruit Catcher)
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.timeLeft = 60; // 60초 제한
    this.isGameActive = false;

    // 게임 상태
    this.items = []; // 떨어지는 아이템들
    this.playerLane = 1; // 0: Left, 1: Center, 2: Right
    this.lastSpawnTime = 0;
    this.spawnInterval = 1000; // 아이템 생성 간격 (ms)
    this.baseSpeed = 0.54; // 기본 낙하 속도 (1.08 -> 0.54로 50% 감소)

    // 라인 설정 (3개)
    this.lanes = [0, 1, 2];

    // 콜백
    this.onScoreChange = null;
    this.onGameEnd = null;

    // 내부 루프용
    this.animationFrameId = null;
    this.lastFrameTime = 0;

    // 아이템 효과 상태
    this.effectFrenzy = false; // 수박 화채 (폭주)
    this.effectSlow = false;   // 모래시계 (느려짐)
    this.effectInvincible = false; // 방패 (무적)

    this.frenzyEndTime = 0;
    this.slowEndTime = 0;
    this.invincibleEndTime = 0;
  }

  start() {
    if (this.isGameActive) return;

    this.resetGame();
    this.isGameActive = true;
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  resetGame() {
    this.score = 0;
    this.level = 1;
    this.timeLeft = 60;
    this.items = [];
    this.playerLane = 1;
    this.baseSpeed = 0.54;
    this.spawnInterval = 1000;

    this.effectFrenzy = false;
    this.effectSlow = false;
    this.effectInvincible = false;

    // 점수 초기화 알림
    if (this.onScoreChange) this.onScoreChange(this.score, this.level, this.timeLeft);
  }

  stop() {
    this.isGameActive = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  // 메인 게임 루프
  loop(currentTime) {
    if (!this.isGameActive) return;

    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    this.update(deltaTime, currentTime);

    // 다음 프레임 요청
    this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
  }

  update(deltaTime, currentTime) {
    // 1. 시간 감소 (1초마다)
    // 정밀한 타이머를 위해 누적 시간 계산보다는 단순하게 처리 (실제로는 deltaTime 누적이 정확함)
    // 여기서는 편의상 frame count 방식 등 대신 간단히 처리하거나 메인 루프에서 별도 타이머 사용 가능.
    // 메인 JS에서 setInterval로 타이머를 돌려도 되지만, 엔진 내부에서 처리하는게 깔끔함.
    // 여기서는 deltaTime을 이용해 정밀하게 계산

    // (단순화를 위해 main.js가 타이머 UI를 갱신하도록 유도하거나, 여기서 1초 지날때마다 콜백)
    // 이번 구현에서는 update 내에서 초 단위 감소 로직 구현

    // * 아이템 생성 로직
    if (currentTime - this.lastSpawnTime > this.spawnInterval) {
      this.spawnItem();
      this.lastSpawnTime = currentTime;
    }

    // * 아이템 이동 및 충돌 처리
    this.updateItems(deltaTime);
  }

  // 외부에서 1초마다 호출해줄 함수 (타이머용) - main.js 에서 setInterval로 호출 권장
  decreaseTime() {
    if (!this.isGameActive) return;

    this.timeLeft--;

    // 레벨업 로직: 20초마다 (남은 시간이 40, 20일 때)
    if (this.timeLeft === 40 || this.timeLeft === 20) {
      this.levelUp();
    }

    if (this.timeLeft <= 0) {
      this.stop(); // 게임 종료
    }

    if (this.onScoreChange) this.onScoreChange(this.score, this.level, this.timeLeft);

    // 아이템 효과 만료 체크
    const now = Date.now();
    if (this.effectFrenzy && now > this.frenzyEndTime) {
      this.effectFrenzy = false;
      this.spawnInterval = 1000 - ((this.level - 1) * 200); // 원래대로 복구 (대략적)
      if (this.spawnInterval < 400) this.spawnInterval = 400;
    }
    if (this.effectSlow && now > this.slowEndTime) {
      this.effectSlow = false;
    }
    if (this.effectInvincible && now > this.invincibleEndTime) {
      this.effectInvincible = false;
    }
  }

  levelUp() {
    this.level++;
    this.baseSpeed *= 1.05; // 속도 5% 증가
    this.spawnInterval -= 200; // 생성 간격 감소
    if (this.spawnInterval < 400) this.spawnInterval = 400;
  }

  spawnItem() {
    const lane = Math.floor(Math.random() * 3); // 0, 1, 2 중 랜덤
    const typeRand = Math.random();

    let type = 'apple'; // 기본
    let score = 100;
    let isSpecial = false;

    // 확률 조정 (합 1.0)
    // 수박(3%), 모래시계(3%), 방패(3%), 폭탄(10%), 오렌지(20%), 사과(61%)
    if (typeRand > 0.97) {
      type = 'watermelon';
      score = 0;
      isSpecial = true;
    } else if (typeRand > 0.94) {
      type = 'hourglass';
      score = 0;
      isSpecial = true;
    } else if (typeRand > 0.91) {
      type = 'shield';
      score = 0;
      isSpecial = true;
    } else if (typeRand > 0.81) {
      type = 'bomb';
      score = 0;
    } else if (typeRand > 0.61) {
      type = 'orange';
      score = 200;
    }

    // Frenzy 상태면 아이템 스폰 간격 극도로 감소
    if (this.effectFrenzy) {
      this.spawnInterval = 100; // 0.1초마다
    }

    this.items.push({
      id: Date.now() + Math.random(),
      lane: lane,
      y: -100, // 화면 위에서 시작
      type: type,
      score: score,
      // 특수 아이템은 50% 속도, 나머지는 baseSpeed
      speed: isSpecial ? this.baseSpeed * 0.5 : this.baseSpeed
    });
  }

  updateItems(deltaTime) {
    // 속도 보정 (deltaTime은 ms 단위이므로, 60fps 기준 비율 맞춰줌)
    let timeScale = deltaTime / 16.66;

    // 모래시계 효과 중이면 시간 느리게
    if (this.effectSlow) {
      timeScale *= 0.5;
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      // 낙하
      item.y += item.speed * timeScale;

      // 충돌 감지 (바닥 근처 + 플레이어 라인 일치)
      // 캔버스 크기를 0~100% (또는 가상 좌표)로 가정했을 때,
      // 바스켓 위치를 y=85~95 정도로 가정.
      // 여기서는 y 좌표를 픽셀 단위가 아닌 퍼센트(0~100)로 관리한다고 가정.

      if (item.y > 85 && item.y < 95) {
        if (item.lane === this.playerLane) {
          // 충돌!
          this.handleCollision(item);
          this.items.splice(i, 1);
          continue;
        }
      }

      // 화면 밖으로 나가면 삭제
      if (item.y > 100) {
        this.items.splice(i, 1);
      }
    }
  }

  handleCollision(item) {
    if (item.type === 'bomb') {
      // 무적 상태면 폭탄 무시
      if (this.effectInvincible) {
        return;
      }
      // 폭탄 -> 게임오버
      this.timeLeft = 0;
      this.stop();
    } else if (item.type === 'watermelon') {
      // 수박 화채: 10초간 과일 폭주
      this.effectFrenzy = true;
      this.frenzyEndTime = Date.now() + 10000;
      this.spawnItem(); // 즉시 하나 생성
    } else if (item.type === 'hourglass') {
      // 모래시계: 10초간 슬로우 모션
      this.effectSlow = true;
      this.slowEndTime = Date.now() + 10000;
    } else if (item.type === 'shield') {
      // 방패: 15초간 무적
      this.effectInvincible = true;
      this.invincibleEndTime = Date.now() + 15000;
    } else {
      // 과일 -> 점수 획득
      this.score += item.score;
      if (this.onScoreChange) this.onScoreChange(this.score, this.level, this.timeLeft);
    }
  }

  // PoseEngine에서 호출
  setPlayerLane(laneName) {
    // laneName: "left", "center", "right"
    // 소문자로 처리
    const name = laneName.toLowerCase();

    if (name.includes('left')) this.playerLane = 0;
    else if (name.includes('right')) this.playerLane = 2;
    else if (name.includes('center') || name.includes('middle')) this.playerLane = 1;
    // 그 외(unknown)일 경우: 기존 위치 유지하거나, 정면(1)으로?
    // 여기서는 명시적으로 center가 아니면 변경하지 않도록 수정하거나, 
    // 혹은 모델이 'stand' 등으로 되어있을 수 있으니 기본값을 1로 유지하는게 낫습니다.
    else this.playerLane = 1;
  }

  setScoreChangeCallback(callback) {
    this.onScoreChange = callback;
  }

  setGameEndCallback(callback) {
    this.onGameEnd = callback;
  }
}

// 전역 내보내기
window.GameEngine = GameEngine;

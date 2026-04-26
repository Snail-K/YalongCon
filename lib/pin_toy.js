/* ==========================================================================
 * TOY CHARACTER FEATURE (박제 기능과 분리된 독립 기능)
 * - images/character/toy.png 스프라이트를 잘라 프레임 애니메이션
 * - 화면 내 가끔 랜덤 이동 + 둥둥 떠다니는 모션
 * ========================================================================== */
(function () {
  var TOY_IMAGE_SRC = "images/character/toy.png";

  // 스프라이트 시트 명세
  var SPRITE_COLS = 6;
  var SPRITE_ROWS = 4;
  var FRAME_WIDTH = 64;
  var FRAME_HEIGHT = 96;
  var ANCHOR_X = 32;
  // 기존 앵커 비율(56/64)을 96 높이에 맞춰 보정
  var ANCHOR_Y = 84;

  // 화면 표시 크기 (가로 x 세로) - 원본 대비 1.5배
  var DISPLAY_SCALE = 1.5;
  var DISPLAY_WIDTH = Math.round(FRAME_WIDTH * DISPLAY_SCALE);
  var DISPLAY_HEIGHT = Math.round(FRAME_HEIGHT * DISPLAY_SCALE);

  // 이동 관련 설정
  var MOVE_SPEED_PX_PER_SEC = 55;
  var TARGET_RESELECT_MIN_MS = 6500;
  var TARGET_RESELECT_MAX_MS = 12000;
  var EDGE_PADDING = 20;

  // 둥둥 떠다니는 모션
  var FLOAT_AMPLITUDE = 10;
  var FLOAT_SPEED = 0.0032;

  var layer = null;
  var canvas = null;
  var ctx = null;
  var spriteImage = null;

  var animations = {
    idle: { start: 0, end: 5, fps: 8 },
    left: { start: 6, end: 11, fps: 10 },
    right: { start: 12, end: 17, fps: 10 }
  };
  var currentAnim = "idle";
  var currentFrame = animations.idle.start;
  var frameAccumulator = 0;
  var moveAnimPlayed = false;

  var x = 120;
  var y = 120;
  var targetX = 240;
  var targetY = 240;
  var nextTargetAt = 0;
  var lastTs = 0;
  var isKnockback = false;
  var knockbackMs = 0;
  var knockbackVX = 0;
  var knockbackVY = 0;
  var rotationDeg = 0;
  var KNOCKBACK_DURATION_MS = 950;
  var KNOCKBACK_SPEED_MIN = 520;
  var KNOCKBACK_SPEED_MAX = 760;
  var KNOCKBACK_SPIN_DPS = 900;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function getScaledAnchor() {
    return {
      x: ANCHOR_X * (DISPLAY_WIDTH / FRAME_WIDTH),
      y: ANCHOR_Y * (DISPLAY_HEIGHT / FRAME_HEIGHT)
    };
  }

  function chooseRandomTarget() {
    var anchor = getScaledAnchor();
    var minX = EDGE_PADDING + anchor.x;
    var maxX = Math.max(minX, window.innerWidth - EDGE_PADDING - (DISPLAY_WIDTH - anchor.x));
    var minY = EDGE_PADDING + anchor.y;
    var maxY = Math.max(minY, window.innerHeight - EDGE_PADDING - (DISPLAY_HEIGHT - anchor.y));
    var obstacles = Array.isArray(window.__pinObstacles) ? window.__pinObstacles : [];
    var maxAttempts = 25;
    var fallbackX = rand(minX, maxX);
    var fallbackY = rand(minY, maxY);

    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      var candidateX = rand(minX, maxX);
      var candidateY = rand(minY, maxY);
      var drawX = candidateX - anchor.x;
      var drawY = candidateY - anchor.y;
      var candidateRect = {
        left: drawX,
        top: drawY,
        right: drawX + DISPLAY_WIDTH,
        bottom: drawY + DISPLAY_HEIGHT
      };
      var isBlocked = obstacles.some(function (rect) {
        return !(candidateRect.right < rect.left ||
                 candidateRect.left > rect.right ||
                 candidateRect.bottom < rect.top ||
                 candidateRect.top > rect.bottom);
      });
      if (!isBlocked) {
        targetX = candidateX;
        targetY = candidateY;
        return;
      }
    }

    targetX = fallbackX;
    targetY = fallbackY;
  }

  function getToyRectAt(anchorX, anchorY) {
    var anchor = getScaledAnchor();
    var drawX = anchorX - anchor.x;
    var drawY = anchorY - anchor.y;
    return {
      left: drawX,
      top: drawY,
      right: drawX + DISPLAY_WIDTH,
      bottom: drawY + DISPLAY_HEIGHT
    };
  }

  function isRectBlocked(rect, obstacles) {
    return obstacles.some(function (obs) {
      return !(rect.right < obs.left ||
               rect.left > obs.right ||
               rect.bottom < obs.top ||
               rect.top > obs.bottom);
    });
  }

  function setAnimation(name) {
    var anim = animations[name] || animations.idle;
    if (currentAnim !== name) {
      currentAnim = name;
      currentFrame = anim.start;
      frameAccumulator = 0;
      moveAnimPlayed = false;
    }
  }

  function drawFrame() {
    if (!ctx || !spriteImage) {
      return;
    }

    var frameX = (currentFrame % SPRITE_COLS) * FRAME_WIDTH;
    var frameY = Math.floor(currentFrame / SPRITE_COLS) * FRAME_HEIGHT;

    ctx.clearRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);
    ctx.drawImage(
      spriteImage,
      frameX, frameY, FRAME_WIDTH, FRAME_HEIGHT,
      0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT
    );
  }

  function updatePosition(dtMs, nowMs) {
    if (isKnockback) {
      knockbackMs -= dtMs;
      x += knockbackVX * (dtMs / 1000);
      y += knockbackVY * (dtMs / 1000);
      rotationDeg += KNOCKBACK_SPIN_DPS * (dtMs / 1000);

      knockbackVX *= 0.985;
      knockbackVY *= 0.985;

      var knockAnchor = getScaledAnchor();
      var minX = EDGE_PADDING + knockAnchor.x;
      var maxX = Math.max(minX, window.innerWidth - EDGE_PADDING - (DISPLAY_WIDTH - knockAnchor.x));
      var minY = EDGE_PADDING + knockAnchor.y;
      var maxY = Math.max(minY, window.innerHeight - EDGE_PADDING - (DISPLAY_HEIGHT - knockAnchor.y));

      if (x < minX || x > maxX) {
        x = clamp(x, minX, maxX);
        knockbackVX *= -0.7;
      }
      if (y < minY || y > maxY) {
        y = clamp(y, minY, maxY);
        knockbackVY *= -0.7;
      }

      var obstaclesDuringKnockback = Array.isArray(window.__pinObstacles) ? window.__pinObstacles : [];
      if (obstaclesDuringKnockback.length > 0) {
        var rectDuringKnockback = getToyRectAt(x, y);
        if (isRectBlocked(rectDuringKnockback, obstaclesDuringKnockback)) {
          knockbackVX *= -0.55;
          knockbackVY *= -0.55;
          x += knockbackVX * (dtMs / 1000);
          y += knockbackVY * (dtMs / 1000);
        }
      }

      if (knockbackMs <= 0) {
        isKnockback = false;
        rotationDeg = 0;
        chooseRandomTarget();
        nextTargetAt = nowMs + rand(TARGET_RESELECT_MIN_MS, TARGET_RESELECT_MAX_MS);
      }
      return;
    }

    if (nowMs >= nextTargetAt) {
      chooseRandomTarget();
      nextTargetAt = nowMs + rand(TARGET_RESELECT_MIN_MS, TARGET_RESELECT_MAX_MS);
    }

    var prevX = x;
    var prevY = y;
    var dx = targetX - x;
    var dy = targetY - y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 0.001) {
      var step = MOVE_SPEED_PX_PER_SEC * (dtMs / 1000);
      if (step >= distance) {
        x = targetX;
        y = targetY;
      } else {
        x += (dx / distance) * step;
        y += (dy / distance) * step;
      }
    }

    // 이동 경로 충돌 감지: 박제창에 닿으면 즉시 정지 후 목표 재선정
    var obstacles = Array.isArray(window.__pinObstacles) ? window.__pinObstacles : [];
    if (obstacles.length > 0) {
      var candidateRect = getToyRectAt(x, y);
      if (isRectBlocked(candidateRect, obstacles)) {
        x = prevX;
        y = prevY;
        chooseRandomTarget();
      }
    }

    var anchor = getScaledAnchor();
    x = clamp(
      x,
      EDGE_PADDING + anchor.x,
      Math.max(EDGE_PADDING + anchor.x, window.innerWidth - EDGE_PADDING - (DISPLAY_WIDTH - anchor.x))
    );
    y = clamp(
      y,
      EDGE_PADDING + anchor.y,
      Math.max(EDGE_PADDING + anchor.y, window.innerHeight - EDGE_PADDING - (DISPLAY_HEIGHT - anchor.y))
    );

    var vx = x - prevX;
    if (Math.abs(vx) > 0.1) {
      setAnimation(vx < 0 ? "left" : "right");
    } else {
      setAnimation("idle");
    }
  }

  function render(nowMs) {
    if (!canvas) {
      return;
    }

    var bobOffset = Math.sin(nowMs * FLOAT_SPEED) * FLOAT_AMPLITUDE;
    var anchor = getScaledAnchor();
    var drawX = x - anchor.x;
    var drawY = (y + bobOffset) - anchor.y;
    var rotate = isKnockback ? (" rotate(" + rotationDeg.toFixed(1) + "deg)") : "";
    canvas.style.transform = "translate(" + drawX.toFixed(2) + "px," + drawY.toFixed(2) + "px)" + rotate;
  }

  function loop(ts) {
    if (!lastTs) {
      lastTs = ts;
    }
    var dt = ts - lastTs;
    lastTs = ts;

    var anim = animations[currentAnim] || animations.idle;
    if (currentAnim === "left" || currentAnim === "right") {
      // 좌/우는 1회 재생 후 마지막 프레임 고정
      if (!moveAnimPlayed) {
        var moveFrameDurationMs = 1000 / anim.fps;
        frameAccumulator += dt;
        while (frameAccumulator >= moveFrameDurationMs) {
          frameAccumulator -= moveFrameDurationMs;
          if (currentFrame < anim.end) {
            currentFrame += 1;
            drawFrame();
          }
          if (currentFrame >= anim.end) {
            currentFrame = anim.end;
            moveAnimPlayed = true;
            drawFrame();
            break;
          }
        }
      }
    } else {
      var frameDurationMs = 1000 / anim.fps;
      frameAccumulator += dt;
      while (frameAccumulator >= frameDurationMs) {
        frameAccumulator -= frameDurationMs;
        currentFrame += 1;
        if (currentFrame > anim.end) {
          currentFrame = anim.start;
        }
        drawFrame();
      }
    }

    updatePosition(dt, ts);
    render(ts);
    requestAnimationFrame(loop);
  }

  function initCanvas() {
    layer = document.getElementById("toy-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "toy-layer";
      document.body.appendChild(layer);
    }

    layer.style.position = "fixed";
    layer.style.inset = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "10000";

    canvas = document.createElement("canvas");
    canvas.width = DISPLAY_WIDTH;
    canvas.height = DISPLAY_HEIGHT;
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.willChange = "transform";

    ctx = canvas.getContext("2d");
    layer.appendChild(canvas);
  }

  function initSprite() {
    spriteImage = new Image();
    spriteImage.onload = function () {
      var requiredWidth = SPRITE_COLS * FRAME_WIDTH;
      var requiredHeight = SPRITE_ROWS * FRAME_HEIGHT;
      if (spriteImage.width < requiredWidth || spriteImage.height < requiredHeight) {
        console.warn("[PIN-TOY] sprite size is smaller than expected:", {
          expected: requiredWidth + "x" + requiredHeight,
          actual: spriteImage.width + "x" + spriteImage.height
        });
      }

      var anchor = getScaledAnchor();
      x = rand(
        EDGE_PADDING + anchor.x,
        Math.max(EDGE_PADDING + anchor.x, window.innerWidth - EDGE_PADDING - (DISPLAY_WIDTH - anchor.x))
      );
      y = rand(
        EDGE_PADDING + anchor.y,
        Math.max(EDGE_PADDING + anchor.y, window.innerHeight - EDGE_PADDING - (DISPLAY_HEIGHT - anchor.y))
      );
      chooseRandomTarget();
      nextTargetAt = performance.now() + rand(TARGET_RESELECT_MIN_MS, TARGET_RESELECT_MAX_MS);

      drawFrame();
      requestAnimationFrame(loop);
      console.log("[PIN-TOY] toy sprite loaded");
    };

    spriteImage.onerror = function () {
      console.warn("[PIN-TOY] toy image load failed:", TOY_IMAGE_SRC);
    };

    spriteImage.src = TOY_IMAGE_SRC;
  }

  function init() {
    initCanvas();
    initSprite();

    window.addEventListener("resize", function () {
      var anchor = getScaledAnchor();
      x = clamp(
        x,
        EDGE_PADDING + anchor.x,
        Math.max(EDGE_PADDING + anchor.x, window.innerWidth - EDGE_PADDING - (DISPLAY_WIDTH - anchor.x))
      );
      y = clamp(
        y,
        EDGE_PADDING + anchor.y,
        Math.max(EDGE_PADDING + anchor.y, window.innerHeight - EDGE_PADDING - (DISPLAY_HEIGHT - anchor.y))
      );
      chooseRandomTarget();
    });

    window.addEventListener("pin:toy-hit", function () {
      var speed = rand(KNOCKBACK_SPEED_MIN, KNOCKBACK_SPEED_MAX);
      var angle = rand(0, Math.PI * 2);
      knockbackVX = Math.cos(angle) * speed;
      knockbackVY = Math.sin(angle) * speed;
      knockbackMs = KNOCKBACK_DURATION_MS;
      isKnockback = true;
      moveAnimPlayed = false;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());

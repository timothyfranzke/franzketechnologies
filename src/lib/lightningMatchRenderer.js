// ─── LIGHTNING MATCH CANVAS RENDERER ─────────────────────────────────
// Renders the Lightning Match play area on a single <canvas>.
// Driven by requestAnimationFrame — no React re-renders during gameplay.
// Pure rendering + timing; all game logic lives in lightningMatchEngine.js.

// ─── CONSTANTS ──────────────────────────────────────────────────────

const TILE_PADDING_X = 16;
const TILE_PADDING_Y = 10;
const TILE_RADIUS = 12;
const TILE_FONT_SIZE = 15; // CSS px
const TILE_MIN_TAP = 48; // minimum tap target in CSS px
const TILE_SHADOW_OFFSET = 2;

const MATCH_POP_DURATION = 400; // ms
const FLOAT_SCORE_DURATION = 800; // ms
const FLOAT_SCORE_DISTANCE = 60; // px upward

const MISS_FLASH_DURATION = 300; // ms

// ─── HELPERS ────────────────────────────────────────────────────────

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    // Polyfill for older browsers
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

function measureTileWidth(ctx, text, font) {
  ctx.font = font;
  const metrics = ctx.measureText(text);
  return Math.max(TILE_MIN_TAP, metrics.width + TILE_PADDING_X * 2);
}

// ─── EXPORTED: POSITION MATH (also used in tests) ──────────────────

export function computeTileY(progress, tileH, canvasH) {
  // progress 0 → top (just above canvas), progress 1 → bottom (just below canvas)
  return lerp(-tileH, canvasH, progress);
}

export function computeProgress(now, spawnTime, fallDurationMs) {
  return (now - spawnTime) / fallDurationMs;
}

// ─── EXPORTED: HIT TESTING ──────────────────────────────────────────

export function hitTest(x, y, tileBounds) {
  // tileBounds: array of { id, x, y, w, h } in render order
  // Check in reverse (top-most first)
  for (let i = tileBounds.length - 1; i >= 0; i--) {
    const b = tileBounds[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      return b.id;
    }
  }
  return null;
}

// ─── EXPORTED: ACCUMULATOR ──────────────────────────────────────────

export function createAccumulator(intervalMs) {
  return { intervalMs, accumulated: 0 };
}

export function updateAccumulator(acc, deltaMs) {
  const newAccumulated = acc.accumulated + deltaMs;
  const fires = Math.floor(newAccumulated / acc.intervalMs);
  const remainder = newAccumulated - fires * acc.intervalMs;
  return { fires, accumulated: remainder };
}

// ─── RENDERER ───────────────────────────────────────────────────────

export function createRenderer(canvas, options) {
  const {
    getGameState,
    onTileClick,
    onTileMiss,
    onSpawnNeeded,
    onTimerTick,
    onGameOver,
    colors,
    fonts,
  } = options;

  const ctx = canvas.getContext("2d");
  let rafId = null;
  let lastTime = null;
  let running = false;

  // DPI scaling
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;

  // Spawn times: Map<tileId, timestamp>
  const spawnTimes = new Map();

  // Accumulators
  let timerAcc = createAccumulator(1000);
  let spawnAcc = createAccumulator(2000); // initial, updated per frame

  // Current tile bounds (for hit testing)
  let currentTileBounds = [];

  // Visual effects
  const effects = [];

  // ─── RESIZE ─────────────────────────────────────────────────────

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    cssW = rect.width;
    cssH = rect.height;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    // Don't set canvas.style.width/height — controlled by CSS
  }

  // ─── POINTER HANDLING ───────────────────────────────────────────

  function handlePointerDown(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const tileId = hitTest(x, y, currentTileBounds);
    if (tileId) {
      onTileClick(tileId);
    }
  }

  // ─── TRACK SPAWN TIMES ─────────────────────────────────────────

  function syncSpawnTimes(activeTiles, now) {
    // Add new tiles
    for (const tile of activeTiles) {
      if ((tile.state === "falling" || tile.state === "selected") && !spawnTimes.has(tile.id)) {
        spawnTimes.set(tile.id, now);
      }
    }
    // Remove tiles no longer active
    const activeIds = new Set(activeTiles.map((t) => t.id));
    for (const id of spawnTimes.keys()) {
      if (!activeIds.has(id)) {
        spawnTimes.delete(id);
      }
    }
  }

  // ─── ADD EFFECT ─────────────────────────────────────────────────

  function addEffect(effect) {
    effects.push({ ...effect, startTime: performance.now() });
  }

  // ─── DRAW ───────────────────────────────────────────────────────

  function drawFrame(now) {
    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, cssW, cssH);

    // Background
    ctx.fillStyle = colors.playAreaBg || "rgba(26,37,55,0.03)";
    roundRect(ctx, 0, 0, cssW, cssH, 16);
    ctx.fill();

    // Lane guides
    const gameState = getGameState();
    const numLanes = 4; // canvas uses 4 lanes
    for (let i = 1; i < numLanes; i++) {
      const x = (i / numLanes) * cssW;
      ctx.strokeStyle = colors.laneGuide || "rgba(26,37,55,0.04)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }

    // Build tile font
    const tileFont = `bold ${TILE_FONT_SIZE}px ${fonts.display || "system-ui"}`;
    const tileH = TILE_FONT_SIZE + TILE_PADDING_Y * 2;

    // Compute tile positions and draw
    const bounds = [];
    const fallingTiles = gameState.activeTiles.filter(
      (t) => t.state === "falling" || t.state === "selected"
    );

    for (const tile of fallingTiles) {
      const spawnTime = spawnTimes.get(tile.id);
      if (spawnTime == null) continue;

      const progress = computeProgress(now, spawnTime, tile.fallDurationMs);

      // Miss detection
      if (progress >= 1.0) {
        onTileMiss(tile.id);
        continue;
      }

      const y = computeTileY(progress, tileH, cssH);
      const tileW = measureTileWidth(ctx, tile.text, tileFont);
      const xPct = tile.x / 100;
      const tileX = xPct * cssW - tileW / 2;

      // Clamp tile within canvas bounds
      const clampedX = Math.max(2, Math.min(cssW - tileW - 2, tileX));

      // Store bounds for hit testing
      bounds.push({
        id: tile.id,
        x: clampedX,
        y,
        w: tileW,
        h: tileH,
      });

      const isSelected = tile.state === "selected";

      // Shadow
      ctx.fillStyle = isSelected
        ? "rgba(217,164,65,0.2)"
        : "rgba(26,37,55,0.15)";
      roundRect(
        ctx,
        clampedX + TILE_SHADOW_OFFSET,
        y + TILE_SHADOW_OFFSET,
        tileW,
        tileH,
        TILE_RADIUS
      );
      ctx.fill();

      // Tile body
      ctx.fillStyle = isSelected
        ? (colors.selectedTileBg || "rgba(217,164,65,0.15)")
        : (colors.tileBg || "#FDF6E3");
      roundRect(ctx, clampedX, y, tileW, tileH, TILE_RADIUS);
      ctx.fill();

      // Border
      if (isSelected) {
        ctx.strokeStyle = colors.gold || "#D9A441";
        ctx.lineWidth = 2.5;
        // Glow
        ctx.save();
        ctx.shadowColor = "rgba(217,164,65,0.4)";
        ctx.shadowBlur = 12;
        roundRect(ctx, clampedX, y, tileW, tileH, TILE_RADIUS);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = colors.ink || "#1A2537";
        ctx.lineWidth = 2;
        roundRect(ctx, clampedX, y, tileW, tileH, TILE_RADIUS);
        ctx.stroke();
      }

      // Text
      ctx.fillStyle = colors.ink || "#1A2537";
      ctx.font = tileFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tile.text, clampedX + tileW / 2, y + tileH / 2);
    }

    currentTileBounds = bounds;

    // ─── EFFECTS ────────────────────────────────────────────────

    const activeEffects = [];
    for (const effect of effects) {
      const elapsed = now - effect.startTime;

      if (effect.type === "matchPop") {
        if (elapsed > MATCH_POP_DURATION) continue;
        const t = elapsed / MATCH_POP_DURATION;
        const scale = lerp(1, 1.5, t);
        const alpha = lerp(1, 0, t);

        ctx.save();
        ctx.globalAlpha = alpha;
        const tileW = measureTileWidth(ctx, effect.text, tileFont);
        const xPct = effect.x / 100;
        const centerX = xPct * cssW;
        const drawX = centerX - (tileW * scale) / 2;
        const drawY = effect.y - (tileH * scale - tileH) / 2;

        ctx.fillStyle = "rgba(107,142,111,0.2)";
        roundRect(ctx, drawX, drawY, tileW * scale, tileH * scale, TILE_RADIUS);
        ctx.fill();

        ctx.strokeStyle = colors.sage || "#6B8E6F";
        ctx.lineWidth = 2.5;
        roundRect(ctx, drawX, drawY, tileW * scale, tileH * scale, TILE_RADIUS);
        ctx.stroke();

        ctx.fillStyle = colors.sage || "#6B8E6F";
        ctx.font = `bold ${TILE_FONT_SIZE * scale}px ${fonts.display || "system-ui"}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(effect.text, centerX, drawY + (tileH * scale) / 2);
        ctx.restore();
        activeEffects.push(effect);
      } else if (effect.type === "floatScore") {
        if (elapsed > FLOAT_SCORE_DURATION) continue;
        const t = elapsed / FLOAT_SCORE_DURATION;
        const alpha = lerp(1, 0, t);
        const yOffset = lerp(0, -FLOAT_SCORE_DISTANCE, t);

        ctx.save();
        ctx.globalAlpha = alpha;
        const centerX = (effect.x / 100) * cssW;

        // Score text
        ctx.fillStyle = colors.sage || "#6B8E6F";
        ctx.font = `900 24px ${fonts.display || "system-ui"}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(effect.text, centerX, effect.y + yOffset);

        // Multiplier
        if (effect.multiplier) {
          ctx.fillStyle = colors.gold || "#D9A441";
          ctx.font = `bold 12px ${fonts.mono || "monospace"}`;
          ctx.fillText(effect.multiplier, centerX, effect.y + yOffset + 20);
        }
        ctx.restore();
        activeEffects.push(effect);
      } else if (effect.type === "missFlash") {
        if (elapsed > MISS_FLASH_DURATION) continue;
        const t = elapsed / MISS_FLASH_DURATION;
        const alpha = lerp(0.15, 0, t);
        ctx.save();
        ctx.fillStyle = `rgba(196,78,71,${alpha})`;
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.restore();
        activeEffects.push(effect);
      }
    }

    // Replace effects array with surviving ones
    effects.length = 0;
    effects.push(...activeEffects);

    ctx.restore();
  }

  // ─── GAME LOOP ────────────────────────────────────────────────

  function loop(timestamp) {
    if (!running) return;

    const now = timestamp;
    if (lastTime === null) {
      lastTime = now;
      rafId = requestAnimationFrame(loop);
      return;
    }

    const deltaMs = Math.min(now - lastTime, 100); // cap to prevent spiral
    lastTime = now;

    const gameState = getGameState();

    // Check game over
    if (gameState.status === "gameOver") {
      onGameOver();
      running = false;
      drawFrame(now);
      return;
    }

    if (gameState.status !== "playing") {
      rafId = requestAnimationFrame(loop);
      return;
    }

    // Sync spawn times
    syncSpawnTimes(gameState.activeTiles, now);

    // Timer accumulator (1 second ticks)
    const timerResult = updateAccumulator(timerAcc, deltaMs);
    timerAcc.accumulated = timerResult.accumulated;
    for (let i = 0; i < timerResult.fires; i++) {
      onTimerTick();
    }

    // Spawn accumulator (variable rate)
    const elapsed = 60 - gameState.timeRemaining;
    const { spawnIntervalMs } = getDifficultyParams(elapsed);
    spawnAcc.intervalMs = spawnIntervalMs;

    const spawnResult = updateAccumulator(spawnAcc, deltaMs);
    spawnAcc.accumulated = spawnResult.accumulated;
    for (let i = 0; i < spawnResult.fires; i++) {
      onSpawnNeeded();
    }

    // Draw
    drawFrame(now);

    rafId = requestAnimationFrame(loop);
  }

  // ─── PUBLIC API ─────────────────────────────────────────────────

  function start() {
    if (running) return;
    running = true;
    lastTime = null;
    timerAcc = createAccumulator(1000);
    spawnAcc = createAccumulator(2000);
    spawnTimes.clear();
    effects.length = 0;
    currentTileBounds = [];

    resize();
    canvas.addEventListener("pointerdown", handlePointerDown);
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    canvas.removeEventListener("pointerdown", handlePointerDown);
    spawnTimes.clear();
    effects.length = 0;
  }

  function getTileBounds() {
    return currentTileBounds;
  }

  // Import getDifficultyParams locally to avoid circular dep issues at module scope
  // (it's imported at the top of the file)

  return {
    start,
    stop,
    resize,
    addEffect,
    getTileBounds,
  };
}

// ─── RESOLVE COLORS FROM CSS CUSTOM PROPERTIES ──────────────────────

export function resolveColors(rootEl) {
  const s = getComputedStyle(rootEl || document.documentElement);
  return {
    ink: s.getPropertyValue("--ink").trim() || "#1A2537",
    cream: s.getPropertyValue("--cream").trim() || "#FDF6E3",
    gold: s.getPropertyValue("--gold").trim() || "#D9A441",
    rust: s.getPropertyValue("--rust").trim() || "#C44E47",
    sage: s.getPropertyValue("--sage").trim() || "#6B8E6F",
    dusty: s.getPropertyValue("--dusty").trim() || "#9B8F85",
    paper: s.getPropertyValue("--paper").trim() || "#F5EFE0",
    tileBg: s.getPropertyValue("--cream").trim() || "#FDF6E3",
    selectedTileBg: "rgba(217,164,65,0.15)",
    playAreaBg: "rgba(26,37,55,0.03)",
    laneGuide: "rgba(26,37,55,0.04)",
  };
}

// We need getDifficultyParams in the game loop
import { getDifficultyParams } from "./lightningMatchEngine.js";

const playArea = document.getElementById("playArea");
const tabs = document.querySelectorAll("#tabs .tab");
const key = "mindgarden_state_v1";
let state = JSON.parse(localStorage.getItem(key) || "{}");
if (!state || typeof state !== "object") state = { games: {}, settings: {} };

function saveState() {
  localStorage.setItem(key, JSON.stringify(state));
}

// theme
const themeBtn = document.getElementById("themeToggle");
themeBtn.onclick = () => {
  const curr = document.documentElement.getAttribute("data-theme") || "dark";
  const next = curr === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  state.settings.theme = next;
  saveState();
};
if (state.settings && state.settings.theme) {
  document.documentElement.setAttribute("data-theme", state.settings.theme);
}

// backup / restore
document.getElementById("backupBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "claritytoybox_backup.json";
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById("restoreBtn").onclick = () => {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json,application/json";
  inp.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const incoming = JSON.parse(ev.target.result);
        if (!incoming || typeof incoming !== "object")
          throw new Error("Invalid structure");
        Object.keys(incoming).forEach((k) => {
          if (
            typeof incoming[k] === "object" &&
            incoming[k] !== null &&
            !Array.isArray(incoming[k]) &&
            state[k]
          ) {
            Object.assign(state[k], incoming[k]);
          } else {
            state[k] = incoming[k];
          }
        });
        saveState();
        alert("State restored. Reload the page.");
        window.location.reload();
      } catch (err) {
        alert("Restore failed: " + err.message);
      }
    };
    r.readAsText(file);
  };
  inp.click();
};

// ---------- GAME IMPLEMENTATIONS ----------

const games = {
  // ---- MemoryTiles ----
  // ---- MemoryTiles (moves only, no timer) ----
  memorytiles(container, prev = {}, save) {
    const stateG = Object.assign(
      {
        size: 4, // 2, 4, or 6
        moves: 0,
        matches: 0,
        bestMoves: null,
        _deck: [], // [{id, icon, matched}]
      },
      prev
    );

    const iconsBase = [
      "🐘",
      "🐅",
      "🦉",
      "🦊",
      "🦌",
      "🐒",
      "🦜",
      "🐢",
      "🦓",
      "🦏",
      "🐋",
      "🦚",
      "🦥",
      "🐼",
      "🦩",
      "🦔",
      "🐟",
      "🦃",
      "🐝",
      "🦇",
    ];

    let first = null;
    let lock = false;

    const wrap = document.createElement("div");
    wrap.className = "mt-wrap";
    container.appendChild(wrap);

    const left = document.createElement("div");
    left.className = "panel section";
    wrap.appendChild(left);

    const right = document.createElement("div");
    right.className = "panel section";
    wrap.appendChild(right);

    left.innerHTML = `
    <h2>MemoryTiles</h2>
    <p style="font-size:0.9rem;opacity:.8;margin-top:-0.5rem">
      Find all the matching pairs of cards. Select two cards to flip them.
      If they match, they stay revealed; otherwise, they flip back after a moment.
    </p>
    <div class="row">
      <label for="mtSize">Grid size</label>
      <select id="mtSize">
        <option value="2">2 × 2</option>
        <option value="4">4 × 4</option>
        <option value="6">6 × 6</option>
      </select>
    </div>
    <div class="row">
      <button id="mtNew">New Game</button>
      <button id="mtReset">Reset Stats</button>
    </div>
    <div style="margin-top:.4rem;font-family:ui-monospace,Menlo,Consolas,monospace;">
      <div id="mtMoves">Moves: 0</div>
      <div id="mtMatches">Matches: 0</div>
      <div>Best (fewest moves): <span id="mtBestMoves">–</span></div>
    </div>
    <p style="color:var(--ink-dim);font-size:.9rem;margin-top:.5rem">
      No timer, no countdown. Take your time. Best is updated only when you finish a board.
    </p>
  `;

    const sizeSel = left.querySelector("#mtSize");
    sizeSel.value = String(stateG.size || 4);

    const newBtn = left.querySelector("#mtNew");
    const resetBtn = left.querySelector("#mtReset");
    const movesEl = left.querySelector("#mtMoves");
    const matchEl = left.querySelector("#mtMatches");
    const bestMovesEl = left.querySelector("#mtBestMoves");

    const grid = document.createElement("div");
    grid.className = "mt-grid";
    right.appendChild(grid);

    function paintStats() {
      movesEl.textContent = "Moves: " + stateG.moves;
      matchEl.textContent =
        "Matches: " + stateG.matches + " / " + (stateG.size * stateG.size) / 2;
      bestMovesEl.textContent =
        stateG.bestMoves == null ? "–" : stateG.bestMoves;
    }

    function shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function buildGrid(sz) {
      const needPairs = (sz * sz) / 2;
      const icons = shuffle(iconsBase.slice()).slice(0, needPairs);
      const deck = shuffle([...icons, ...icons]).map((icon, idx) => ({
        id: idx,
        icon,
        matched: false,
      }));

      stateG._deck = deck;
      stateG.moves = 0;
      stateG.matches = 0;
      save(stateG);

      first = null;
      lock = false;
      renderGrid();
      paintStats();
    }

    function renderGrid() {
      grid.innerHTML = "";
      const sz = stateG.size;
      const deck = stateG._deck;
      grid.style.gridTemplateColumns = `repeat(${sz}, 72px)`;

      deck.forEach((card) => {
        const cell = document.createElement("div");
        cell.className = "mt-card";
        cell.dataset.id = String(card.id);
        cell.textContent = "";

        if (card.matched) {
          cell.classList.add("revealed", "matched");
          cell.textContent = card.icon;
        }

        cell.onclick = () => flip(card, cell);
        grid.appendChild(cell);
      });

      paintStats();
    }

    function flip(card, cell) {
      if (lock || card.matched) return;

      if (!cell.classList.contains("revealed")) {
        cell.classList.add("revealed");
        cell.textContent = card.icon;
      }

      if (!first) {
        first = { card, cell };
        return;
      }

      if (first.cell === cell) return; // same card clicked twice

      stateG.moves++;
      paintStats();

      const deck = stateG._deck;
      const card1Index = deck.findIndex((c) => c.id === first.card.id);
      const card2Index = deck.findIndex((c) => c.id === card.id);

      if (first.card.icon === card.icon) {
        if (card1Index !== -1) deck[card1Index].matched = true;
        if (card2Index !== -1) deck[card2Index].matched = true;

        first.cell.classList.add("matched");
        cell.classList.add("matched");
        first = null;
        stateG.matches++;
        save(stateG);
        paintStats();

        const totalPairs = (stateG.size * stateG.size) / 2;
        if (stateG.matches === totalPairs) {
          if (stateG.bestMoves == null || stateG.moves < stateG.bestMoves) {
            stateG.bestMoves = stateG.moves;
            save(stateG);
            paintStats();
          }
        }
      } else {
        lock = true;
        setTimeout(() => {
          first.cell.classList.remove("revealed");
          first.cell.textContent = "";
          cell.classList.remove("revealed");
          cell.textContent = "";
          first = null;
          lock = false;
        }, 650);
      }
    }

    function newGame() {
      const sz = parseInt(sizeSel.value, 10);
      stateG.size = sz;
      buildGrid(sz);
    }

    newBtn.onclick = newGame;

    resetBtn.onclick = () => {
      stateG.bestMoves = null;
      save(stateG);
      paintStats();
    };

    // resume or start fresh
    if (stateG._deck && stateG._deck.length > 0) {
      renderGrid();
    } else {
      newGame();
    }
  },

  // ---- ColorBloom ----
  colorbloom(container, prev = {}, save) {
    const stateG = Object.assign(
      {
        bestDelta: null,
        rounds: 0,
        lastTarget: null,
      },
      prev
    );

    let target = stateG.lastTarget;
    let isLocked = false;

    const wrap = document.createElement("div");
    wrap.className = "cb-wrap";
    container.appendChild(wrap);
    const left = document.createElement("div");
    left.className = "panel section";
    wrap.appendChild(left);
    const right = document.createElement("div");
    right.className = "panel section";
    wrap.appendChild(right);

    left.innerHTML = `
      <h2>ColourBloom: Visual Acuity</h2>
      <p style="font-size:0.9rem;opacity:.8;margin-top:-0.5rem">
        Use the Red, Green, and Blue sliders to match the Target Colour as closely as possible. Press 'Lock & Score' to see your distance (Δ), lower is better.
      </p>
      <div class="cb-dual">
        <div class="col">
          <label>Target Colour</label>
          <div id="swatchTarget" class="cb-swatch" style="height: 100px; width: 100%;"></div>
        </div>
        <div class="col">
          <label>Your Mix</label>
          <div id="swatchYou" class="cb-swatch" style="height: 100px; width: 100%;"></div>
        </div>
      </div>
      <div class="col" style="margin-top:.6rem">
        <label>Red</label><input id="r" type="range" min="0" max="255" value="128" />
        <label>Green</label><input id="g" type="range" min="0" max="255" value="128" />
        <label>Blue</label><input id="b" type="range" min="0" max="255" value="128" />
        <div class="row" style="margin-top:.8rem">
          <button id="btnNew">New Target</button>
          <button id="btnSnap">Lock & Score</button>
          <button id="btnResetStats">Reset Stats</button>
        </div>
        <div class="cb-stat" style="margin-top:.4rem" id="deltaLine">Δ (RGB distance): –</div>
        <div class="cb-stat">Rounds Attempted: <span id="rounds">0</span> · Best Δ: <span id="bestDelta">–</span></div>
      </div>
    `;

    const r = left.querySelector("#r"),
      g = left.querySelector("#g"),
      b = left.querySelector("#b");
    const tSw = left.querySelector("#swatchTarget"),
      ySw = left.querySelector("#swatchYou");
    const btnNew = left.querySelector("#btnNew"),
      btnSnap = left.querySelector("#btnSnap");
    const deltaLine = left.querySelector("#deltaLine"),
      roundsEl = left.querySelector("#rounds"),
      bestDeltaEl = left.querySelector("#bestDelta");
    const btnResetStats = left.querySelector("#btnResetStats");

    roundsEl.textContent = String(stateG.rounds || 0);
    bestDeltaEl.textContent =
      stateG.bestDelta == null ? "–" : stateG.bestDelta.toFixed(1);

    right.innerHTML = `<h3>Details</h3><div class="cb-stat" id="vals">Current RGB: 128, 128, 128</div>`;
    const vals = right.querySelector("#vals");

    function rand(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function rgb(r, g, b) {
      return `rgb(${r}, ${g}, ${b})`;
    }

    function dist(a, b) {
      const dr = a[0] - b[0],
        dg = a[1] - b[1],
        db = a[2] - b[2];
      return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    function paintTarget() {
      tSw.style.background = rgb(target[0], target[1], target[2]);
    }

    function paintYou() {
      const c = [+r.value, +g.value, +b.value];
      ySw.style.background = rgb(c[0], c[1], c[2]);
      const d = target ? dist(target, c) : 0;
      deltaLine.textContent = `Δ (RGB distance): ${d.toFixed(1)}`;
      vals.textContent = `Current RGB: ${c.join(", ")}`;
    }

    function newTarget() {
      isLocked = false;

      target = [rand(20, 235), rand(20, 235), rand(20, 235)];
      stateG.lastTarget = target;

      tSw.style.border = "none";
      ySw.style.border = "none";

      paintTarget();
      paintYou();
      btnSnap.disabled = false;
      save(stateG);
    }

    function snap() {
      if (isLocked) return;
      isLocked = true;
      btnSnap.disabled = true;

      const c = [+r.value, +g.value, +b.value];
      const d = dist(target, c);

      stateG.rounds = (stateG.rounds || 0) + 1;
      if (stateG.bestDelta == null || d < stateG.bestDelta) {
        stateG.bestDelta = d;
      }

      deltaLine.textContent = `Δ (RGB distance): ${d.toFixed(
        1
      )} (Lower is better)`;

      const color = d === stateG.bestDelta ? "var(--success)" : "var(--line)";
      tSw.style.border = `4px solid ${color}`;
      ySw.style.border = `4px solid ${color}`;

      roundsEl.textContent = String(stateG.rounds);
      bestDeltaEl.textContent = stateG.bestDelta.toFixed(1);

      save(stateG);

      setTimeout(() => {
        tSw.style.border = "none";
        ySw.style.border = "none";
        newTarget();
      }, 1500);
    }

    btnResetStats.onclick = () => {
      stateG.rounds = 0;
      stateG.bestDelta = null;
      save(stateG);
      roundsEl.textContent = "0";
      bestDeltaEl.textContent = "–";
      newTarget();
    };

    r.oninput = g.oninput = b.oninput = paintYou;
    btnNew.onclick = newTarget;
    btnSnap.onclick = snap;

    if (!stateG.lastTarget) {
      target = [rand(20, 235), rand(20, 235), rand(20, 235)];
      stateG.lastTarget = target;
      save(stateG);
    } else {
      target = stateG.lastTarget;
    }

    r.value = g.value = b.value = 128;
    paintTarget();
    paintYou();
  },

  // ---- PathLines ----
  pathlines(container, prev = {}, save) {
    const MAX_LEVEL = 10;
    const DOT_RADIUS = 7;

    function levelParams(level) {
      let lvl = Math.max(1, Math.min(level || 1, MAX_LEVEL));
      // Dots: 25 → 30 across levels 1–10
      const numDots = Math.min(30, 25 + Math.floor((lvl - 1) / 2));
      // Obstacles: 2 → 6 across levels
      const maxObstacles = 2 + Math.floor((lvl - 1) / 2); // 2,2,3,3,4,4,5,5,6,6
      // Radius grows with level
      const obstacleRadius = 22 + (lvl - 1) * 3; // ~22 → 49
      return { lvl, numDots, maxObstacles, obstacleRadius };
    }

    const stateG = Object.assign(
      {
        bestVisited: 0,
        plays: 0,
        level: 1,
        _dots: [],
        _visited: [],
        _obstacles: [],
      },
      prev
    );

    const root = document.createElement("div");
    root.className = "panel section";
    container.appendChild(root);

    const title = document.createElement("h2");
    title.textContent = "PathLines: The Gardener's Trail";
    root.appendChild(title);

    const desc = document.createElement("p");
    desc.style.fontSize = "0.9rem";
    desc.style.opacity = ".8";
    desc.style.marginTop = "-0.5rem";
    desc.textContent =
      "Drag from any dot to trace a continuous line through as many dots as you can. Avoid the obstacles, and do not cross your own path.";
    root.appendChild(desc);

    const stats = document.createElement("div");
    stats.style.marginBottom = "0.6rem";
    stats.style.fontFamily = "ui-monospace, Menlo, Consolas, monospace";
    root.appendChild(stats);

    const controls = document.createElement("div");
    controls.className = "row";

    const newBtn = document.createElement("button");
    newBtn.textContent = "New Layout";
    controls.appendChild(newBtn);

    const restartLevelBtn = document.createElement("button");
    restartLevelBtn.textContent = "Restart Level";
    controls.appendChild(restartLevelBtn);

    // NEW: restart from level 1
    const restartAllBtn = document.createElement("button");
    restartAllBtn.textContent = "Clear stats and Restart From Level 1";
    controls.appendChild(restartAllBtn);

    const nextLevelBtn = document.createElement("button");
    nextLevelBtn.textContent = "Next Level";
    nextLevelBtn.disabled = true;
    nextLevelBtn.style.display = "none";
    controls.appendChild(nextLevelBtn);

    root.appendChild(controls);

    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 550;
    canvas.style.width = "100%";
    canvas.style.maxWidth = "800px";
    canvas.style.borderRadius = "18px";
    canvas.style.border = "1px solid var(--line)";
    canvas.style.background =
      "radial-gradient(circle at top, rgba(0,255,255,0.08), transparent)";
    canvas.style.display = "block";
    canvas.style.marginTop = "0.6rem";
    root.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    let dots = stateG._dots || [];
    let obstacles = stateG._obstacles || [];
    // old saves: normalise obstacle shape
    obstacles.forEach((o) => {
      if (!o) return;
      if (typeof o.r !== "number") o.r = 24;
    });

    let visited = new Set(stateG._visited || []);
    let totalDots = dots.length;
    let drawing = false;
    let last = null;
    let pathPoints = stateG._visited
      .map((i) => (dots[i] ? { x: dots[i].x, y: dots[i].y } : null))
      .filter(Boolean);
    let gameOver = false;

    // segments preventing self-crossing
    let segments = [];

    function currentCfg() {
      return levelParams(stateG.level);
    }

    function paintStats() {
      totalDots = stateG._dots.length;
      const best = stateG.bestVisited || 0;
      stats.textContent = `Level: ${stateG.level} · Dots: ${
        visited.size
      } / ${totalDots} · Best: ${best} · Boards: ${stateG.plays || 0}`;
    }

    function checkObstacleCollision(x, y) {
      for (const obs of obstacles) {
        if (!obs) continue;
        const R = obs.r || currentCfg().obstacleRadius || 24;
        const dx = obs.x - x;
        const dy = obs.y - y;
        if (dx * dx + dy * dy <= (R + 3) * (R + 3)) {
          return true;
        }
      }
      return false;
    }

    // segment intersection helpers
    function segIntersects(s1, s2) {
      // ignore if they share endpoints
      if (
        (s1.x1 === s2.x1 && s1.y1 === s2.y1) ||
        (s1.x2 === s2.x2 && s1.y2 === s2.y2) ||
        (s1.x1 === s2.x2 && s1.y1 === s2.y2) ||
        (s1.x2 === s2.x1 && s1.y2 === s2.y1)
      ) {
        return false;
      }

      function ccw(ax, ay, bx, by, cx, cy) {
        return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
      }

      const { x1, y1, x2, y2 } = s1;
      const { x1: x3, y1: y3, x2: x4, y2: y4 } = s2;

      const d1 = ccw(x1, y1, x3, y3, x4, y4);
      const d2 = ccw(x2, y2, x3, y3, x4, y4);
      const d3 = ccw(x1, y1, x2, y2, x3, y3);
      const d4 = ccw(x1, y1, x2, y2, x4, y4);

      return d1 !== d2 && d3 !== d4;
    }

    function layoutDots(level = stateG.level) {
      const cfg = levelParams(level);
      stateG.level = cfg.lvl;

      dots = [];
      obstacles = [];
      visited.clear();
      stateG._visited = [];
      drawing = false;
      last = null;
      pathPoints = [];
      gameOver = false;
      segments = [];

      nextLevelBtn.disabled = true;
      nextLevelBtn.style.display = "none";

      const marginX = 50;
      const marginY = 40;
      const w = canvas.width - marginX * 2;
      const h = canvas.height - marginY * 2;

      // place dots randomly, but with minimum spacing
      const minDotDistSq = DOT_RADIUS * 3 * (DOT_RADIUS * 3);
      let attempts = 0;
      while (dots.length < cfg.numDots && attempts < cfg.numDots * 40) {
        attempts++;
        const x = marginX + Math.random() * w;
        const y = marginY + Math.random() * h;

        let ok = true;
        for (const d of dots) {
          const dx = d.x - x;
          const dy = d.y - y;
          if (dx * dx + dy * dy < minDotDistSq) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        dots.push({ x, y });
      }

      // place obstacles (circle-collision, blob drawing)
      const targetObstacles = cfg.maxObstacles;
      const obstacleBaseRadius = cfg.obstacleRadius;
      const OB_CLEARANCE_DOT_SQ = (obstacleBaseRadius + DOT_RADIUS + 10) ** 2;

      let obsAttempts = 0;
      while (
        obstacles.length < targetObstacles &&
        obsAttempts < targetObstacles * 80
      ) {
        obsAttempts++;
        const R = obstacleBaseRadius * (0.9 + Math.random() * 0.3); // small random size variation
        const x = marginX + R + Math.random() * (w - 2 * R);
        const y = marginY + R + Math.random() * (h - 2 * R);
        let ok = true;

        // keep away from dots
        for (const d of dots) {
          const dx = d.x - x;
          const dy = d.y - y;
          if (dx * dx + dy * dy < (R + DOT_RADIUS + 8) ** 2) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        // keep obstacles apart
        for (const o of obstacles) {
          const R2 = o.r || obstacleBaseRadius;
          const dx = o.x - x;
          const dy = o.y - y;
          if (dx * dx + dy * dy < (R + R2 + 12) ** 2) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        obstacles.push({ x, y, r: R });
      }

      // ensure at least one obstacle exists; if not, relax constraints and drop a big one in center
      if (obstacles.length === 0) {
        obstacles.push({
          x: canvas.width / 2,
          y: canvas.height / 2,
          r: obstacleBaseRadius * 1.1,
        });
      }

      stateG._dots = dots;
      stateG._obstacles = obstacles;
      save(stateG);
      draw();
      paintStats();
    }

    function drawObstacleBlob(obs) {
      const R = obs.r || currentCfg().obstacleRadius || 24;
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.beginPath();
      // irregular blob using a few arcs
      ctx.moveTo(R, 0);
      ctx.quadraticCurveTo(R * 0.6, -R * 0.6, 0, -R * 0.9);
      ctx.quadraticCurveTo(-R * 0.8, -R * 0.3, -R * 0.9, 0.2 * R);
      ctx.quadraticCurveTo(-R * 0.4, R, 0.2 * R, R * 0.9);
      ctx.quadraticCurveTo(R, R * 0.4, R, 0);
      ctx.closePath();
      ctx.fillStyle = "rgba(80, 80, 90, 0.5)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(160, 160, 180, 0.9)";
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // background grid
      ctx.save();
      ctx.strokeStyle = "rgba(0,255,255,0.12)";
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }
      ctx.restore();

      // path
      if (pathPoints.length > 1) {
        ctx.save();
        ctx.strokeStyle = gameOver
          ? "rgba(255, 60, 60, 0.9)"
          : "rgba(0,255,255,0.7)";
        ctx.lineWidth = gameOver ? 4 : 3;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
        for (let i = 1; i < pathPoints.length; i++) {
          ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // obstacles
      obstacles.forEach((obs) => {
        if (!obs) return;
        drawObstacleBlob(obs);
      });

      // dots
      dots.forEach((d, idx) => {
        const hit = visited.has(idx);
        ctx.beginPath();
        ctx.arc(d.x, d.y, DOT_RADIUS, 0, Math.PI * 2);

        let fill = hit ? "rgba(0,255,255,0.8)" : "rgba(0,0,0,0.6)";
        if (last === idx && drawing && !gameOver) {
          fill = "rgba(255,255,0,0.9)";
        }
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.lineWidth = 2;
        ctx.strokeStyle = hit
          ? "rgba(0,255,255,0.9)"
          : "rgba(255,255,255,0.25)";
        ctx.stroke();
      });
    }

    function findDot(x, y) {
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const dx = d.x - x,
          dy = d.y - y;
        if (dx * dx + dy * dy <= (DOT_RADIUS + 5) * (DOT_RADIUS + 5)) {
          return i;
        }
      }
      return null;
    }

    function getMousePos(canvas, clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    function startDraw(evt) {
      if (gameOver) return;
      const { x, y } = getMousePos(
        canvas,
        evt.touches ? evt.touches[0].clientX : evt.clientX,
        evt.touches ? evt.touches[0].clientY : evt.clientY
      );
      const idx = findDot(x, y);
      if (idx == null) return;

      drawing = true;
      visited.clear();
      stateG._visited = [];
      pathPoints = [];
      segments = [];
      last = idx;
      visited.add(idx);
      stateG._visited.push(idx);
      pathPoints.push({ x: dots[idx].x, y: dots[idx].y });
      draw();
      paintStats();
    }

    function moveDraw(evt) {
      if (!drawing || gameOver) return;
      const { x, y } = getMousePos(
        canvas,
        evt.touches ? evt.touches[0].clientX : evt.clientX,
        evt.touches ? evt.touches[0].clientY : evt.clientY
      );

      if (checkObstacleCollision(x, y)) {
        pathPoints.push({ x, y });
        gameOver = true;
        drawing = false;
        endDraw();
        return;
      }

      const idx = findDot(x, y);

      if (idx != null && !visited.has(idx)) {
        if (last != null) {
          const a = dots[last];
          const b = dots[idx];
          const newSeg = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };

          let crosses = false;
          for (const seg of segments) {
            if (
              (seg.x1 === newSeg.x1 && seg.y1 === newSeg.y1) ||
              (seg.x2 === newSeg.x2 && seg.y2 === newSeg.y2) ||
              (seg.x1 === newSeg.x2 && seg.y1 === newSeg.y2) ||
              (seg.x2 === newSeg.x1 && seg.y2 === newSeg.y1)
            ) {
              continue;
            }
            if (segIntersects(seg, newSeg)) {
              crosses = true;
              break;
            }
          }

          if (crosses) {
            return; // illegal move: ignore
          }

          segments.push(newSeg);
        }

        last = idx;
        visited.add(idx);
        stateG._visited.push(idx);

        pathPoints = stateG._visited.map((i) => dots[i]);
        if (visited.size > (stateG.bestVisited || 0)) {
          stateG.bestVisited = visited.size;
        }
        draw();
        paintStats();
      }

      // trailing line to cursor
      if (pathPoints.length > 0) {
        const committed = stateG._visited.map((i) => dots[i]);
        committed.push({ x, y });
        pathPoints = committed;
        draw();
      }
    }

    function endDraw() {
      if (!drawing && !gameOver) return;

      if (visited.size > 0) {
        stateG.plays = (stateG.plays || 0) + 1;
      }

      drawing = false;
      pathPoints = stateG._visited.map((idx) => dots[idx]);
      save(stateG);
      draw();
      paintStats();

      if (visited.size === totalDots && totalDots > 0) {
        nextLevelBtn.disabled = false;
        nextLevelBtn.style.display = "block";
        setTimeout(
          () => alert(`Perfect Trail! Level ${stateG.level} complete.`),
          100
        );
      }

      if (gameOver) {
        nextLevelBtn.disabled = true;
        nextLevelBtn.style.display = "none";
        setTimeout(() => alert("Path blocked by an obstacle. Game Over!"), 100);
      }
    }

    // events
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", moveDraw);
    window.addEventListener("mouseup", endDraw);
    canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        startDraw(e);
      },
      { passive: false }
    );
    canvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        moveDraw(e);
      },
      { passive: false }
    );
    canvas.addEventListener("touchend", () => {
      endDraw();
    });

    newBtn.onclick = () => {
      layoutDots(stateG.level);
    };

    restartLevelBtn.onclick = () => {
      gameOver = false;
      visited.clear();
      stateG._visited = [];
      drawing = false;
      last = null;
      pathPoints = [];
      segments = [];
      nextLevelBtn.disabled = true;
      nextLevelBtn.style.display = "none";
      draw();
      paintStats();
    };

    restartAllBtn.onclick = () => {
      gameOver = false;
      visited.clear();
      stateG._visited = [];
      drawing = false;
      last = null;
      pathPoints = [];
      segments = [];
      nextLevelBtn.disabled = true;
      nextLevelBtn.style.display = "none";

      stateG.bestVisited = 0;
      stateG.plays = 0;
      save(stateG);
      // go back to level 1 and build a fresh layout
      layoutDots(1);
    };

    nextLevelBtn.onclick = () => {
      let nextLevel = stateG.level + 1;
      if (nextLevel > MAX_LEVEL) {
        alert("Congratulations! You completed the highest level!");
        nextLevel = MAX_LEVEL;
      }
      layoutDots(nextLevel);
    };

    // initial layout
    if (
      !dots ||
      dots.length === 0 ||
      !stateG._dots ||
      stateG._dots.length === 0
    ) {
      layoutDots(stateG.level);
    } else {
      // ensure old obstacles have radius
      obstacles.forEach((o) => {
        if (o && typeof o.r !== "number")
          o.r = levelParams(stateG.level).obstacleRadius;
      });
      pathPoints = stateG._visited
        .map((idx) => (dots[idx] ? { x: dots[idx].x, y: dots[idx].y } : null))
        .filter(Boolean);
      draw();
      paintStats();
    }
  },

  // ---- SequenceGarden ----
  sequencegarden(container, prev = {}, save) {
    const stateG = Object.assign(
      { bestLevel: 0, plays: 0, _seq: [], _level: 0 },
      prev
    );
    const root = document.createElement("div");
    root.className = "panel section";
    container.appendChild(root);

    root.innerHTML = `
      <h2>SequenceGarden</h2>
      <p style="font-size:0.9rem;opacity:.8;margin-top:-0.5rem">
        Watch the pads light up in a sequence; once the sequence stops, then try to repeat the pattern by tapping them in the same order. The sequence gets longer by one tap each round.
      </p>`;

    const stats = document.createElement("div");
    stats.style.fontFamily = "ui-monospace, Menlo, Consolas, monospace";
    stats.style.marginBottom = "0.6rem";
    root.appendChild(stats);

    const controls = document.createElement("div");
    controls.className = "row";
    const startBtn = document.createElement("button");
    startBtn.textContent = "Start Sequence";
    controls.appendChild(startBtn);

    const restartBtn = document.createElement("button");
    restartBtn.textContent = "Restart";
    controls.appendChild(restartBtn);

    root.appendChild(controls);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(2, 120px)";
    grid.style.gridTemplateRows = "repeat(2, 120px)";
    grid.style.gap = "14px";
    grid.style.marginTop = "0.8rem";
    root.appendChild(grid);

    const colors = [
      { base: "rgba(0,255,255,0.12)", glow: "rgba(0,255,255,0.9)" },
      { base: "rgba(78,107,80,0.3)", glow: "rgba(167,208,177,1)" },
      { base: "rgba(200,179,154,0.25)", glow: "rgba(255,219,180,1)" },
      { base: "rgba(120,130,160,0.25)", glow: "rgba(200,210,255,1)" },
    ];

    const pads = [];
    for (let i = 0; i < 4; i++) {
      const pad = document.createElement("button");
      pad.style.borderRadius = "18px";
      pad.style.borderWidth = "1px";
      pad.style.width = "120px";
      pad.style.height = "120px";
      pad.style.background = colors[i].base;
      pad.style.borderColor = "var(--line)";
      pad.dataset.idx = String(i);
      pad.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
      pad.style.transition = "background 0.15s, box-shadow 0.15s";
      pads.push(pad);
      grid.appendChild(pad);
    }

    let seq = stateG._seq || [];
    let userPos = 0;
    let playingBack = false;
    let currentLevel = stateG._level || 0;

    function paintStats() {
      stats.textContent = `Level: ${currentLevel} · Best: ${
        stateG.bestLevel || 0
      } · Sessions: ${stateG.plays || 0}`;
    }

    function sleep(ms) {
      return new Promise((res) => setTimeout(res, ms));
    }

    async function flashPad(i) {
      const pad = pads[i];
      pad.style.background = colors[i].glow;
      pad.style.boxShadow = `0 0 20px 4px ${colors[i].glow}`;
      await sleep(260);
      pad.style.background = colors[i].base;
      pad.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
    }

    async function playSequence() {
      playingBack = true;
      startBtn.disabled = true;
      await sleep(500);
      for (let i = 0; i < seq.length; i++) {
        await flashPad(seq[i]);
        await sleep(120);
      }
      playingBack = false;
      startBtn.disabled = false;
    }

    function nextRound() {
      const next = Math.floor(Math.random() * 4);
      seq.push(next);
      currentLevel = seq.length;
      stateG._seq = seq;
      stateG._level = currentLevel;

      if (currentLevel > (stateG.bestLevel || 0)) {
        stateG.bestLevel = currentLevel;
      }
      userPos = 0;
      save(stateG);
      paintStats();
      playSequence();
    }

    pads.forEach((pad) => {
      pad.addEventListener("click", async () => {
        if (playingBack || seq.length === 0) return;
        const idx = parseInt(pad.dataset.idx, 10);

        const originalBg = pad.style.background;
        const originalShadow = pad.style.boxShadow;
        pad.style.background = colors[idx].glow;
        pad.style.boxShadow = `0 0 20px 4px ${colors[idx].glow}`;
        await sleep(100);
        pad.style.background = originalBg;
        pad.style.boxShadow = originalShadow;

        if (idx === seq[userPos]) {
          userPos++;
          if (userPos === seq.length) {
            await sleep(500);
            nextRound();
          }
        } else {
          playingBack = true;
          startBtn.disabled = true;
          const failGlow = "rgba(255, 50, 50, 0.9)";
          pads.forEach((p) => {
            p.style.background = failGlow;
            p.style.boxShadow = `0 0 20px 4px ${failGlow}`;
          });
          await sleep(500);
          pads.forEach((p, i) => {
            p.style.background = colors[i].base;
            p.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
          });

          stateG.plays = (stateG.plays || 0) + 1;
          save(stateG);
          currentLevel = 0;
          stateG._level = 0;
          seq = [];
          stateG._seq = [];
          userPos = 0;
          playingBack = false;
          startBtn.disabled = false;
          paintStats();
        }
      });
    });

    startBtn.onclick = () => {
      if (playingBack) return;
      if (seq.length > 0) {
        userPos = 0;
        playSequence();
      } else {
        nextRound();
      }
    };

    restartBtn.onclick = () => {
      if (playingBack) return;
      currentLevel = 0;
      stateG._level = 0;
      seq = [];
      stateG._seq = [];
      userPos = 0;
      save(stateG);
      paintStats();
      startBtn.textContent = "Start Sequence";
    };

    if (seq.length > 0) {
      startBtn.textContent = `Resume Level ${currentLevel}`;
    }

    paintStats();
  },

  // ---- MirrorMaze ----
  // ---- MirrorMaze (procedural, guaranteed-solvable) ----
  mirrormaze(container, prev = {}, save) {
    // Per-game state persisted via save():
    //  - currentGrid: array of strings for the current maze
    //  - size: board size (currently fixed at 8)
    //  - baseMirrors: initial mirror layout (for reset)
    //  - mirrors: current mirror orientation overrides
    //  - sourceDir: initial direction of the beam from S
    //  - plays / solved: stats
    const stateG = Object.assign(
      {
        size: 8,
        currentGrid: null, // ['S....', ...] or null
        baseMirrors: {}, // { "r,c": "/" or "\\" }
        mirrors: {}, // { "r,c": "/" or "\\" }
        sourceDir: "right", // "up"|"down"|"left"|"right"
        plays: 0,
        solved: 0,
      },
      prev
    );

    const size = stateG.size;

    // Layout containers
    const wrap = document.createElement("div");
    wrap.className = "mm-wrap";
    container.appendChild(wrap);

    const left = document.createElement("div");
    left.className = "panel section";
    wrap.appendChild(left);

    const right = document.createElement("div");
    right.className = "panel section";
    wrap.appendChild(right);

    // Left panel UI
    left.innerHTML = `
    <h2>MirrorMaze</h2>
    <p style="font-size:0.9rem;opacity:.8;margin-top:-0.5rem">
      A beam starts from <strong>S</strong> and moves in a straight line.
      Mirrors <code>/</code> and <code>\\</code> bend it at right angles.
      Rotate the mirrors so the beam reaches <strong>T</strong>, then press
      <em>Trace Beam</em> to watch its path.
    </p>
    <div class="row" style="margin-top:0.6rem">
      <button id="mmNew">New Random Maze</button>
      <button id="mmReset">Reset Mirrors</button>
    </div>
    <div class="row" style="margin-top:0.4rem">
      <button id="mmTrace">Trace Beam</button>
    </div>
    <div class="mm-status" id="mmStatus"></div>
    <div class="mm-status" id="mmStats"></div>
  `;

    const newBtn = left.querySelector("#mmNew");
    const resetBtn = left.querySelector("#mmReset");
    const traceBtn = left.querySelector("#mmTrace");
    const statusEl = left.querySelector("#mmStatus");
    const statsEl = left.querySelector("#mmStats");

    // Right panel grid container
    const gridEl = document.createElement("div");
    gridEl.className = "mm-grid";
    right.appendChild(gridEl);

    // Board representation for current maze
    // board[r][c] = { type: "empty"|"wall"|"source"|"target"|"mirror", mirror: "/" or "\\"|null }
    let board = [];
    let source = null; // { r, c, dir }
    let target = null; // { r, c }
    let tracing = false;

    const dirs = {
      up: { dr: -1, dc: 0 },
      down: { dr: 1, dc: 0 },
      left: { dr: 0, dc: -1 },
      right: { dr: 0, dc: 1 },
    };

    function sleep(ms) {
      return new Promise((res) => setTimeout(res, ms));
    }

    function reflect(dir, mirrorChar) {
      if (mirrorChar === "/") {
        if (dir === "up") return "right";
        if (dir === "down") return "left";
        if (dir === "left") return "down";
        if (dir === "right") return "up";
      } else {
        // "\"
        if (dir === "up") return "left";
        if (dir === "down") return "right";
        if (dir === "left") return "up";
        if (dir === "right") return "down";
      }
      return dir;
    }

    function paintStats() {
      statsEl.textContent = `Games solved: ${
        stateG.solved || 0
      } · Boards played: ${stateG.plays || 0}`;
    }

    // --------- Procedural level generation with guaranteed solution ---------

    function rand(n) {
      return Math.floor(Math.random() * n);
    }

    function generateSolvableLevel() {
      // We build a path first, by simulating the beam with mirrors laid down
      // as we go. Then we set T at the final cell, and add walls that avoid the path.
      // Loop until we get a non-trivial path.
      while (true) {
        const grid = Array.from({ length: size }, () => Array(size).fill("."));
        const baseMirrors = {};
        const path = [];

        // Choose random start edge and direction
        const edges = [
          { r: 0, c: rand(size), dir: "down" },
          { r: size - 1, c: rand(size), dir: "up" },
          { r: rand(size), c: 0, dir: "right" },
          { r: rand(size), c: size - 1, dir: "left" },
        ];
        const start = edges[rand(edges.length)];

        grid[start.r][start.c] = "S";

        let r = start.r;
        let c = start.c;
        let dir = start.dir;
        let steps = 0;
        const MAX_STEPS = size * size; // hard cap

        while (steps < MAX_STEPS) {
          const delta = dirs[dir];
          const nr = r + delta.dr;
          const nc = c + delta.dc;
          if (nr < 0 || nc < 0 || nr >= size || nc >= size) break;

          // With some probability place a mirror here
          if (Math.random() < 0.3) {
            const mirror = Math.random() < 0.5 ? "/" : "\\";
            grid[nr][nc] = mirror;
            baseMirrors[`${nr},${nc}`] = mirror;
            dir = reflect(dir, mirror);
          } else {
            grid[nr][nc] = ".";
          }

          path.push({ r: nr, c: nc });
          r = nr;
          c = nc;
          steps++;
        }

        // Require a minimum path length; otherwise regenerate
        if (path.length < 4) continue;

        // Last cell on path is the target
        grid[r][c] = "T";

        // Remember S and T + path positions to avoid wall placement there
        const pathSet = new Set(path.map((p) => `${p.r},${p.c}`));
        const sKey = `${start.r},${start.c}`;
        const tKey = `${r},${c}`;
        pathSet.add(sKey);
        pathSet.add(tKey);

        // Sprinkle walls that do not touch the canonical solution path
        const wallAttempts = size * size;
        for (let i = 0; i < wallAttempts; i++) {
          const rr = rand(size);
          const cc = rand(size);
          const key = `${rr},${cc}`;
          if (pathSet.has(key)) continue; // do not block the solution
          if (grid[rr][cc] === ".") {
            grid[rr][cc] = "#";
          }
        }

        // Convert to string rows and return
        const rows = grid.map((row) => row.join(""));

        return {
          grid: rows,
          baseMirrors,
          sourceDir: start.dir,
        };
      }
    }

    // --------- Board build and rendering ----------

    function buildBoardFromState() {
      board = [];
      source = null;
      target = null;

      if (!stateG.currentGrid) return;

      const gridRows = stateG.currentGrid;
      const userMirrors = stateG.mirrors || {};
      const baseMirrors = stateG.baseMirrors || {};

      for (let r = 0; r < gridRows.length; r++) {
        const rowStr = gridRows[r];
        const row = [];
        for (let c = 0; c < rowStr.length; c++) {
          const ch = rowStr[c];
          let type = "empty";
          let mirror = null;

          if (ch === "#") type = "wall";
          else if (ch === "S") type = "source";
          else if (ch === "T") type = "target";
          else if (ch === "/" || ch === "\\") {
            type = "mirror";
            mirror = ch;
          }

          // Apply current mirror overrides (if any)
          const key = `${r},${c}`;
          if (type === "mirror") {
            if (key in userMirrors) {
              mirror = userMirrors[key] === "\\" ? "\\" : "/";
            } else if (key in baseMirrors) {
              mirror = baseMirrors[key];
            } else if (!mirror) {
              mirror = "/";
            }
          }

          const cell = { type, mirror };
          row.push(cell);

          if (type === "source") {
            source = { r, c, dir: stateG.sourceDir || "right" };
          }
          if (type === "target") {
            target = { r, c };
          }
        }
        board.push(row);
      }
    }

    function renderGrid(highlightPath = []) {
      gridEl.innerHTML = "";
      const pathSet = new Set(highlightPath.map((p) => `${p.r},${p.c}`));

      for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
          const cell = board[r][c];
          const cellDiv = document.createElement("div");
          cellDiv.className = "mm-cell";

          const inner = document.createElement("div");
          inner.className = "mm-cell-inner";
          cellDiv.appendChild(inner);

          if (cell.type === "source") {
            cellDiv.classList.add("source");
            inner.textContent = "S";
          } else if (cell.type === "target") {
            cellDiv.classList.add("target");
            inner.textContent = "T";
          } else if (cell.type === "wall") {
            cellDiv.classList.add("wall");
          } else if (cell.type === "mirror") {
            inner.textContent = cell.mirror || "/";
          }

          if (pathSet.has(`${r},${c}`)) {
            cellDiv.classList.add("beam");
          }

          cellDiv.addEventListener("click", () => {
            if (cell.type === "mirror") toggleMirror(r, c);
          });

          gridEl.appendChild(cellDiv);
        }
      }
    }

    function storeMirrorsFromBoard() {
      const mirrors = {};
      for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
          const cell = board[r][c];
          if (cell.type === "mirror") {
            mirrors[`${r},${c}`] = cell.mirror || "/";
          }
        }
      }
      stateG.mirrors = mirrors;
      save(stateG);
    }

    function toggleMirror(r, c) {
      const cell = board[r][c];
      if (!cell || cell.type !== "mirror") return;
      cell.mirror = cell.mirror === "/" ? "\\" : "/";
      storeMirrorsFromBoard();
      renderGrid();
      statusEl.textContent = "Mirror flipped. Trace the beam to test.";
    }

    // --------- Beam tracing with visible animation ----------

    async function traceBeam() {
      if (tracing) return;
      if (!source || !target) {
        statusEl.textContent = "Maze misconfigured: missing S or T.";
        return;
      }

      tracing = true;
      statusEl.textContent = "Tracing beam…";

      let { r, c, dir } = source;
      const path = [];
      const visitedStates = new Set();
      let steps = 0;
      const MAX_STEPS = size * size * 4;
      const STEP_DELAY = 80;

      while (steps < MAX_STEPS) {
        const stateKey = `${r},${c},${dir}`;
        if (visitedStates.has(stateKey)) {
          statusEl.textContent =
            "The beam fell into a loop and never reached the target.";
          renderGrid(path);
          tracing = false;
          return;
        }
        visitedStates.add(stateKey);

        const delta = dirs[dir];
        r += delta.dr;
        c += delta.dc;
        steps++;

        if (r < 0 || c < 0 || r >= size || c >= size) {
          statusEl.textContent =
            "The beam left the maze without reaching the target.";
          renderGrid(path);
          tracing = false;
          return;
        }

        const cell = board[r][c];
        path.push({ r, c });
        renderGrid(path);
        await sleep(STEP_DELAY);

        if (cell.type === "wall") {
          statusEl.textContent = "The beam hit a wall.";
          tracing = false;
          return;
        }

        if (cell.type === "target") {
          statusEl.textContent = "Solved: the beam reached the target.";
          renderGrid(path);

          stateG.plays = (stateG.plays || 0) + 1;
          stateG.solved = (stateG.solved || 0) + 1;
          save(stateG);
          paintStats();
          tracing = false;
          return;
        }

        if (cell.type === "mirror") {
          dir = reflect(dir, cell.mirror || "/");
        }
      }

      statusEl.textContent = "The beam wandered for too long and fizzled out.";
      renderGrid(path);
      tracing = false;
    }

    // --------- Actions: new maze / reset / trace ----------

    function createNewMaze() {
      const generated = generateSolvableLevel();
      stateG.currentGrid = generated.grid;
      stateG.baseMirrors = generated.baseMirrors || {};
      stateG.mirrors = Object.assign({}, stateG.baseMirrors);
      stateG.sourceDir = generated.sourceDir || "right";
      statusEl.textContent = "New maze generated.";
      save(stateG);
      buildBoardFromState();
      renderGrid();
      paintStats();
    }

    function resetMirrors() {
      stateG.mirrors = Object.assign({}, stateG.baseMirrors || {});
      save(stateG);
      buildBoardFromState();
      renderGrid();
      statusEl.textContent = "Mirrors reset to original layout.";
    }

    newBtn.onclick = () => {
      createNewMaze();
    };

    resetBtn.onclick = () => {
      if (!stateG.currentGrid) return;
      resetMirrors();
    };

    traceBtn.onclick = () => {
      if (!stateG.currentGrid) {
        statusEl.textContent = "Generate a maze first.";
        return;
      }
      buildBoardFromState(); // rebuild in case mirrors changed
      traceBeam();
    };

    // --------- Initial load ----------

    if (!stateG.currentGrid) {
      createNewMaze();
    } else {
      buildBoardFromState();
      renderGrid();
      paintStats();
    }
  },

  // ---- FractalGrow ----
  fractalgrow(container, prev = {}, save) {
    const PRESETS = {
      // Jitter removed from all presets
      fern: {
        label: "Classic Fern",
        spread: 20,
        decay: 0.66,
        maxDepth: 6,
        direction: -90,
        hue: [140, 180],
      },
      lightning: {
        label: "Electric Bolt",
        spread: 35,
        decay: 0.75,
        maxDepth: 5,
        direction: -90,
        hue: [200, 260],
      },
      tree: {
        label: "Tree Branch",
        spread: 30,
        decay: 0.7,
        maxDepth: 8,
        direction: -90,
        hue: [150, 200],
      },
      sierpinski: {
        label: "Sierpinski Curve",
        spread: 60,
        decay: 0.5,
        maxDepth: 10,
        direction: -180,
        hue: [20, 60],
      },
    };

    const stateG = Object.assign(
      {
        paused: false,
        mode: "fern",
        seeds: [],
        // Custom settings (no jitter)
        customSpread: 20,
        customDecay: 0.66,
        customDirection: -90, // angle in degrees
        growthSpeed: 4, // 1 to 10
      },
      prev
    );

    const wrap = document.createElement("div");
    wrap.className = "fg-wrap";
    container.appendChild(wrap);

    const left = document.createElement("div");
    left.className = "panel section";
    wrap.appendChild(left);
    const right = document.createElement("div");
    right.className = "panel section";
    wrap.appendChild(right);

    // --- LEFT PANEL UI (Controls and Stats) ---

    left.innerHTML = `
      <h2>FractalGrow</h2>
      <p style="font-size:0.9rem;opacity:.8;margin-top:-0.5rem">
        Click anywhere in the canvas to plant a fractal seed and watch it grow infinitely. Use presets or customize the rules below.
      </p>
      
      <div style="font-size:0.85rem; color:var(--ink-dim); margin-bottom: 1rem;">
          <p style="margin: 0.2rem 0;">**Classic Fern:** A dense, elegant biological leaf shape.</p>
          <p style="margin: 0.2rem 0;">**Electric Bolt:** Open, wider branching structure with high spread.</p>
          <p style="margin: 0.2rem 0;">**Tree Branch:** A pattern for tall, solid, tree-like growth.</p>
          <p style="margin: 0.2rem 0;">**Sierpinski Curve:** Highly geometric and spreading, often filling space quickly.</p>
      </div>

      <div class="row">
        <label for="fgPreset">Preset</label>
        <select id="fgPreset">
          <option value="fern">Classic Fern</option>
          <option value="lightning">Electric Bolt</option>
          <option value="tree">Tree Branch</option>
          <option value="sierpinski">Sierpinski Curve</option>
          <option value="custom">Custom Rules</option>
        </select>
      </div>

      <div class="row" style="margin-top:.5rem;">
        <button id="fgPause">Pause</button>
        <button id="fgClear">Clear All Seeds</button>
        <button id="fgDownload">Download Pattern</button>
      </div>
      
      <div style="margin-top:1rem;">
        <label for="fgSpeed">Growth Speed (1-10)</label>
        <input id="fgSpeed" type="range" min="1" max="10" value="${
          stateG.growthSpeed
        }" />
      </div>

      <div id="fgCustomControls" style="margin-top:1rem; border-top: 1px solid var(--line); padding-top: 1rem; display: none;">
        <h3>Custom Rule Parameters</h3>
        
        <div style="margin-bottom: 0.8rem;">
            <label for="fgDirection">Initial Direction (Angle):</label>
            <p style="font-size:0.85rem; color:var(--ink-dim); margin: 0.2rem 0 0.4rem;">
                Sets the starting orientation of the fractal.
            </p>
            <input id="fgDirection" type="range" min="-180" max="180" value="${
              stateG.customDirection
            }" />
            <div class="row" style="justify-content: space-between; font-size: 0.75rem; color:var(--ink-dim); margin-top:-0.5rem; padding: 0 0.2rem;">
                <span style="flex-basis: 15%; text-align: left;">-180°</span>
                <span style="flex-basis: 15%; text-align: center;">-90° (Up)</span>
                <span style="flex-basis: 15%; text-align: center;">0° (Right)</span>
                <span style="flex-basis: 15%; text-align: center;">90° (Down)</span>
                <span style="flex-basis: 15%; text-align: right;">180°</span>
            </div>
        </div>

        <div style="margin-bottom: 0.8rem;">
            <label for="fgSpread">Spread Angle (Degrees):</label>
            <p style="font-size:0.85rem; color:var(--ink-dim); margin: 0.2rem 0 0.4rem;">
                Angle between new branches at each split (determines shape width).
            </p>
            <input id="fgSpread" type="range" min="1" max="90" value="${
              stateG.customSpread
            }" />
            <div class="row" style="justify-content: space-between; font-size: 0.75rem; color:var(--ink-dim); margin-top:-0.5rem; padding: 0 0.2rem;">
                <span>1° (Narrow)</span>
                <span>45° (Mid)</span>
                <span>90° (Wide)</span>
            </div>
        </div>

        <label for="fgDecay">Decay (% Length):</label>
        <p style="font-size:0.85rem; color:var(--ink-dim); margin: 0.2rem 0 0.4rem;">
            How much branches shrink when they split (lower = longer branches).
        </p>
        <input id="fgDecay" type="range" min="50" max="95" value="${Math.round(
          stateG.customDecay * 100
        )}" />
      </div>
      
      <p style="margin-top:.5rem;font-family:ui-monospace,Menlo,Consolas,monospace;">
        Seeds: <span id="fgSeedCount">0</span>
      </p>
    `;
    // --- END LEFT PANEL ---

    const presetSel = left.querySelector("#fgPreset");
    const pauseBtn = left.querySelector("#fgPause");
    const clearBtn = left.querySelector("#fgClear");
    const downloadBtn = left.querySelector("#fgDownload"); // NEW SELECTOR
    const seedCountEl = left.querySelector("#fgSeedCount");
    const customControls = left.querySelector("#fgCustomControls");

    // canvas
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 550;
    canvas.style.width = "100%";
    canvas.style.maxWidth = "800px";
    canvas.style.borderRadius = "18px";
    canvas.style.border = "1px solid var(--line)";
    canvas.style.background = "black";
    canvas.style.display = "block";
    right.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    // restore state
    let paused = !!stateG.paused;
    let seeds = [];

    // Helper function to sync UI with state
    function syncControls() {
      presetSel.value = stateG.mode;
      customControls.style.display =
        stateG.mode === "custom" ? "block" : "none";

      // Ensure sliders are set from state (for restores)
      document.getElementById("fgSpread").value = stateG.customSpread;
      document.getElementById("fgDecay").value = Math.round(
        stateG.customDecay * 100
      );
      document.getElementById("fgDirection").value = stateG.customDirection;
      document.getElementById("fgSpeed").value = stateG.growthSpeed;
    }

    function makeSeed(x, y, mode) {
      let rule;
      let hueRange;
      let initialAngleDegrees;

      if (mode === "custom") {
        // Rule built without jitter
        rule = {
          spread: stateG.customSpread,
          decay: stateG.customDecay,
          maxDepth: 8,
        };
        hueRange = [0, 360];
        initialAngleDegrees = stateG.customDirection;
      } else {
        // Rule pulled from preset without jitter
        const preset = PRESETS[mode] || PRESETS.fern;
        rule = {
          spread: preset.spread,
          decay: preset.decay,
          maxDepth: preset.maxDepth,
        };
        hueRange = preset.hue;
        initialAngleDegrees = preset.direction;
      }

      const hue = hueRange[0] + Math.random() * (hueRange[1] - hueRange[0]);
      const directionRad = (initialAngleDegrees * Math.PI) / 180;

      return {
        x,
        y,
        hue,
        mode,
        rule,
        branches: [
          {
            x,
            y,
            angle: directionRad,
            length: 60,
            depth: 0,
          },
        ],
      };
    }

    function growSeed(seed) {
      const nextBranches = [];
      // Jitter removed from destructuring
      const { spread, decay, maxDepth } = seed.rule;

      ctx.strokeStyle = `hsl(${seed.hue}, 80%, 70%)`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = `hsl(${seed.hue}, 100%, 70%)`;
      ctx.shadowBlur = 10;

      const step = stateG.growthSpeed * 0.5;

      for (const b of seed.branches) {
        const nx = b.x + Math.cos(b.angle) * step;
        const ny = b.y + Math.sin(b.angle) * step;

        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        b.x = nx;
        b.y = ny;
        b.length -= step;

        if (b.length <= 0 && b.depth < maxDepth) {
          const children = 2;
          for (let i = 0; i < children; i++) {
            const sign = i === 0 ? -1 : 1;
            const baseSpread = (spread * Math.PI) / 180;
            // Jitter logic removed: newAngle is purely geometric
            const newAngle = b.angle + sign * baseSpread;

            nextBranches.push({
              x: b.x,
              y: b.y,
              angle: newAngle,
              length: 60 * decay,
              depth: b.depth + 1,
            });
          }
        } else if (b.length > 0) {
          nextBranches.push(b);
        }
      }

      seed.branches = nextBranches;
    }

    function frame() {
      if (!paused) {
        ctx.fillStyle = "rgba(0,0,0,0.04)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (const s of seeds) {
          if (s.branches.length > 0) {
            growSeed(s);
          }
        }
      }
      requestAnimationFrame(frame);
    }

    // --- DOWNLOAD LOGIC ---
    function downloadCanvas() {
      const dataURL = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataURL;
      const modeName = stateG.mode === "custom" ? "Custom" : stateG.mode;
      a.download = `ClarityToybox_FractalGrow_${modeName}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    // --- END DOWNLOAD LOGIC ---

    // --- Custom Rule Event Listeners ---
    function setupCustomListeners() {
      const updateState = (key, value) => {
        stateG[key] = value;
        save(stateG);
      };

      document.getElementById("fgSpeed").oninput = (e) =>
        updateState("growthSpeed", parseInt(e.target.value));

      document.getElementById("fgSpread").oninput = (e) =>
        updateState("customSpread", parseInt(e.target.value));
      document.getElementById("fgDecay").oninput = (e) =>
        updateState("customDecay", parseInt(e.target.value) / 100);
      document.getElementById("fgDirection").oninput = (e) =>
        updateState("customDirection", parseInt(e.target.value));
    }

    // event handlers
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) * canvas.width) / rect.width;
      const y = ((e.clientY - rect.top) * canvas.height) / rect.height;

      if (seeds.length > 50) {
        seeds.shift();
        stateG.seeds.shift();
      }

      const newSeed = makeSeed(x, y, stateG.mode || "fern");
      seeds.push(newSeed);
      if (!stateG.seeds) stateG.seeds = [];
      stateG.seeds.push({ x, y, mode: stateG.mode || "fern" });
      seedCountEl.textContent = String(seeds.length);
      save(stateG);
    });

    presetSel.value = stateG.mode || "fern";
    presetSel.onchange = () => {
      stateG.mode = presetSel.value;
      save(stateG);
      syncControls();
    };

    pauseBtn.onclick = () => {
      paused = !paused;
      stateG.paused = paused;
      pauseBtn.textContent = paused ? "Resume" : "Pause";
      save(stateG);
    };
    pauseBtn.textContent = paused ? "Resume" : "Pause";

    // Clear button acts as a restart (clearing the canvas)
    clearBtn.onclick = () => {
      seeds = [];
      stateG.seeds = [];
      seedCountEl.textContent = "0";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      save(stateG);
    };

    // Attach listener for the download button
    downloadBtn.onclick = downloadCanvas;

    // restore any saved seeds
    if (Array.isArray(stateG.seeds) && stateG.seeds.length > 0) {
      for (const s of stateG.seeds) {
        seeds.push(makeSeed(s.x, s.y, s.mode || "fern"));
      }
      seedCountEl.textContent = String(seeds.length);
    } else {
      seedCountEl.textContent = "0";
    }

    // Initial setup and start
    syncControls();
    setupCustomListeners();
    frame();
  },

  // ---- SequenceForge ----
  sequenceforge(container, prev = {}, save) {
    const stateG = Object.assign(
      {
        rounds: 0,
        correct: 0,
        bestStreak: 0,
        currentStreak: 0,
        lastSeq: null,
        lastAnswer: null,
        lastOptions: null,
      },
      prev
    );

    let seq =
      Array.isArray(stateG.lastSeq) && stateG.lastSeq.length > 0
        ? stateG.lastSeq.slice()
        : null;
    let answer = stateG.lastAnswer;
    let options =
      Array.isArray(stateG.lastOptions) && stateG.lastOptions.length > 0
        ? stateG.lastOptions.slice()
        : null;

    const root = document.createElement("div");
    root.className = "panel section";
    container.appendChild(root);

    root.innerHTML = `
      <h2>SequenceForge</h2>
      <p style="font-size:0.9rem;opacity:.8;margin-top:-0.5rem">
        Study the sequence and choose the next number that best continues the pattern.
      </p>
    `;

    const stats = document.createElement("div");
    stats.style.fontFamily = "ui-monospace, Menlo, Consolas, monospace";
    stats.style.marginBottom = "0.6rem";
    root.appendChild(stats);

    const seqLine = document.createElement("div");
    seqLine.style.fontSize = "1.05rem";
    seqLine.style.marginBottom = "0.5rem";
    root.appendChild(seqLine);

    const feedback = document.createElement("div");
    feedback.style.marginBottom = "0.6rem";
    feedback.style.fontSize = "0.9rem";
    feedback.style.color = "var(--ink-dim)";
    root.appendChild(feedback);

    const optionsRow = document.createElement("div");
    optionsRow.className = "row";
    root.appendChild(optionsRow);

    const controls = document.createElement("div");
    controls.className = "row";
    controls.style.marginTop = "0.8rem";
    root.appendChild(controls);

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "New Pattern";
    controls.appendChild(nextBtn);

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset Stats";
    controls.appendChild(resetBtn);

    function paintStats() {
      stats.textContent = `Rounds: ${stateG.rounds || 0} · Correct: ${
        stateG.correct || 0
      } · Current streak: ${stateG.currentStreak || 0} · Best streak: ${
        stateG.bestStreak || 0
      }`;
    }

    function shuffled(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function randInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function makePattern() {
      const type = randInt(1, 4);
      let base, diff, ratio;

      switch (type) {
        case 1: // arithmetic
          base = randInt(0, 15);
          diff = randInt(1, 9);
          seq = [base, base + diff, base + 2 * diff, base + 3 * diff];
          answer = base + 4 * diff;
          break;
        case 2: // geometric
          base = randInt(1, 6);
          ratio = randInt(2, 4);
          seq = [base, base * ratio, base * ratio ** 2, base * ratio ** 3];
          answer = base * ratio ** 4;
          break;
        case 3: // squares
          base = randInt(1, 5);
          seq = [
            base * base,
            (base + 1) * (base + 1),
            (base + 2) * (base + 2),
            (base + 3) * (base + 3),
          ];
          answer = (base + 4) * (base + 4);
          break;
        default: // alternating increments
          base = randInt(0, 20);
          const d1 = randInt(1, 5);
          const d2 = randInt(2, 8);
          seq = [base, base + d1, base + d1 + d2, base + 2 * d1 + d2];
          answer = base + 2 * d1 + 2 * d2;
          break;
      }

      // build options
      const opts = new Set();
      opts.add(answer);
      while (opts.size < 4) {
        const noise = randInt(-6, 6);
        const candidate = answer + noise;
        if (candidate !== answer && candidate > -20) {
          opts.add(candidate);
        }
      }
      options = shuffled(Array.from(opts));

      stateG.lastSeq = seq.slice();
      stateG.lastAnswer = answer;
      stateG.lastOptions = options.slice();
      save(stateG);
    }

    function paintBoard() {
      if (!seq || !options) return;

      seqLine.textContent = `${seq.join(", ")}, ?`;
      optionsRow.innerHTML = "";
      options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.className = "sf-option";
        btn.textContent = String(opt);
        btn.onclick = () => handleGuess(opt, btn);
        optionsRow.appendChild(btn);
      });
      feedback.textContent =
        "Choose the number that best continues the sequence.";
    }

    function handleGuess(choice, btn) {
      const all = optionsRow.querySelectorAll(".sf-option");
      all.forEach((b) => {
        b.disabled = true;
      });

      stateG.rounds = (stateG.rounds || 0) + 1;

      if (choice === answer) {
        stateG.correct = (stateG.correct || 0) + 1;
        stateG.currentStreak = (stateG.currentStreak || 0) + 1;
        if (stateG.currentStreak > (stateG.bestStreak || 0)) {
          stateG.bestStreak = stateG.currentStreak;
        }
        feedback.textContent = "Correct. New pattern queued.";
        btn.classList.add("sf-correct");
      } else {
        stateG.currentStreak = 0;
        feedback.textContent = `Not quite. Correct answer was ${answer}.`;
        btn.classList.add("sf-wrong");
        all.forEach((b) => {
          if (parseInt(b.textContent, 10) === answer) {
            b.classList.add("sf-correct");
          }
        });
      }

      save(stateG);
      paintStats();

      setTimeout(() => {
        makePattern();
        paintBoard();
        paintStats();
      }, 1100);
    }

    nextBtn.onclick = () => {
      makePattern();
      paintBoard();
      paintStats();
    };

    resetBtn.onclick = () => {
      stateG.rounds = 0;
      stateG.correct = 0;
      stateG.bestStreak = 0;
      stateG.currentStreak = 0;
      save(stateG);
      feedback.textContent = "Stats cleared. Fresh patterns ahead.";
      paintStats();
    };

    // initial render
    if (!seq || !options) {
      makePattern();
    }
    paintBoard();
    paintStats();
  },

  // ---- SumLeaves ----
  sumleaves(container, prev = {}, save) {
    const stateG = Object.assign(
      {
        attempts: 0,
        solved: 0,
        bestAttempts: null,
        lastTarget: null,
        lastValues: null,
      },
      prev
    );

    let currentTarget = stateG.lastTarget || null;
    let values =
      Array.isArray(stateG.lastValues) && stateG.lastValues.length > 0
        ? stateG.lastValues.slice()
        : [];
    let selectedIndex = null;
    let attemptsThisRound = 0;

    const root = document.createElement("div");
    root.className = "panel section";
    container.appendChild(root);

    root.innerHTML = `
      <h2>SumLeaves</h2>
      <p style="font-size:0.9rem;opacity:.8;margin-top:-0.5rem">
        Find calm pairs. Each board shows a target number and a cluster of leaves. Tap two leaves whose numbers add up exactly to the target.
      </p>
    `;

    const stats = document.createElement("div");
    stats.style.fontFamily = "ui-monospace, Menlo, Consolas, monospace";
    stats.style.marginBottom = "0.6rem";
    root.appendChild(stats);

    const controls = document.createElement("div");
    controls.className = "row";
    root.appendChild(controls);

    const newBtn = document.createElement("button");
    newBtn.textContent = "New Board";
    controls.appendChild(newBtn);

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset Stats";
    controls.appendChild(resetBtn);

    const targetLine = document.createElement("div");
    targetLine.style.marginTop = "0.6rem";
    targetLine.style.fontSize = "1rem";
    root.appendChild(targetLine);

    const feedback = document.createElement("div");
    feedback.style.marginTop = "0.4rem";
    feedback.style.fontSize = "0.9rem";
    feedback.style.color = "var(--ink-dim)";
    root.appendChild(feedback);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(4, 1fr)";
    grid.style.gap = "0.5rem";
    grid.style.marginTop = "0.8rem";
    root.appendChild(grid);

    function paintStats() {
      const best =
        stateG.bestAttempts == null ? "–" : String(stateG.bestAttempts);
      stats.textContent = `Boards solved: ${stateG.solved || 0} · Attempts: ${
        stateG.attempts || 0
      } · Best attempts on a board: ${best}`;
    }

    function randInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function generateBoard() {
      const level = stateG.solved || 0;

      // ----- difficulty scaling -----
      // number range increases slowly with boards solved
      // e.g. solved 0 → max 15, 5 → max 25, 10 → max 35, capped at 40
      const maxVal = Math.min(15 + level * 2, 40);

      // board size increases every ~3 solved boards, capped at 12
      // solved 0–2: 6 numbers
      // solved 3–5: 7 numbers
      // solved 6–8: 8 numbers
      // … up to 12
      const countBase = 6 + Math.floor(level / 3);
      const count = Math.max(6, Math.min(countBase, 12));
      // ----- end difficulty scaling -----

      const nums = [];
      for (let i = 0; i < count; i++) {
        nums.push(randInt(1, maxVal));
      }

      // guarantee at least one valid pair
      const i = randInt(0, count - 1);
      let j = randInt(0, count - 1);
      if (j === i) j = (j + 1) % count;
      const target = nums[i] + nums[j];

      currentTarget = target;
      values = nums;
      attemptsThisRound = 0;
      selectedIndex = null;

      stateG.lastTarget = currentTarget;
      stateG.lastValues = values.slice();
      save(stateG);
      paintBoard();
      paintStats();
    }

    function clearSelectionHighlight() {
      const cells = grid.querySelectorAll(".sl-cell");
      cells.forEach((c) => {
        c.classList.remove("sl-selected");
        c.classList.remove("sl-correct");
        c.classList.remove("sl-wrong");
      });
    }

    function paintBoard() {
      targetLine.textContent = currentTarget
        ? `Target: ${currentTarget}`
        : "Target: –";
      feedback.textContent =
        "Tap two blocks whose numbers add exactly to the target.";

      grid.innerHTML = "";
      values.forEach((v, idx) => {
        const cell = document.createElement("button");
        cell.className = "sl-cell";
        cell.textContent = String(v);
        cell.onclick = () => handleClick(idx, cell);
        grid.appendChild(cell);
      });

      clearSelectionHighlight();
    }

    function handleClick(idx, cell) {
      if (!currentTarget) return;

      const allCells = grid.querySelectorAll(".sl-cell");

      if (selectedIndex === null) {
        selectedIndex = idx;
        clearSelectionHighlight();
        cell.classList.add("sl-selected");
        return;
      }

      if (selectedIndex === idx) {
        // deselect
        selectedIndex = null;
        clearSelectionHighlight();
        return;
      }

      const firstIdx = selectedIndex;
      selectedIndex = null;
      attemptsThisRound++;
      stateG.attempts = (stateG.attempts || 0) + 1;

      const sum = values[firstIdx] + values[idx];

      clearSelectionHighlight();
      allCells[firstIdx].classList.add("sl-selected");
      allCells[idx].classList.add("sl-selected");

      if (sum === currentTarget) {
        feedback.textContent = `Correct: ${values[firstIdx]} + ${values[idx]} = ${currentTarget}. New board coming up.`;
        allCells[firstIdx].classList.add("sl-correct");
        allCells[idx].classList.add("sl-correct");

        stateG.solved = (stateG.solved || 0) + 1;
        if (
          stateG.bestAttempts == null ||
          attemptsThisRound < stateG.bestAttempts
        ) {
          stateG.bestAttempts = attemptsThisRound;
        }

        save(stateG);
        paintStats();

        setTimeout(() => {
          generateBoard();
        }, 900);
      } else {
        feedback.textContent = `Not quite: ${values[firstIdx]} + ${values[idx]} = ${sum}. Try another pair.`;
        allCells[firstIdx].classList.add("sl-wrong");
        allCells[idx].classList.add("sl-wrong");
        save(stateG);
        paintStats();

        setTimeout(() => {
          clearSelectionHighlight();
        }, 600);
      }
    }

    newBtn.onclick = () => {
      generateBoard();
    };

    resetBtn.onclick = () => {
      stateG.attempts = 0;
      stateG.solved = 0;
      stateG.bestAttempts = null;
      save(stateG);
      attemptsThisRound = 0;
      feedback.textContent = "Stats cleared. New calm board.";
      paintStats();
    };

    // initial paint
    if (!currentTarget || !values || values.length === 0) {
      generateBoard();
    } else {
      paintBoard();
      paintStats();
    }
  },

  // ---- Constellation ----
  constellation(container, prev = {}, save) {
    const stateG = Object.assign({ bestScore: 0, plays: 0 }, prev);
    const root = document.createElement("div");
    root.className = "panel section";
    container.appendChild(root);

    const SIZE = 5;
    const TIME_LIMIT = 5000;
    let activeCells = new Set();
    let userGuesses = new Set();
    let phase = "setup"; // setup, memorizing, guessing, finished
    let score = 0;
    let maxPossible = 0;
    let timeoutId = null;

    function generateConstellation() {
      const baseStars = 6;
      maxPossible = Math.min(SIZE * SIZE, baseStars);
      activeCells.clear();
      while (activeCells.size < maxPossible) {
        activeCells.add((Math.random() * SIZE * SIZE) | 0);
      }
      userGuesses.clear();
      score = 0;
      phase = "memorizing";
      stateG.plays = (stateG.plays || 0) + 1;
      save(stateG);

      timeoutId = setTimeout(startGuessing, TIME_LIMIT);
      render();
    }

    function startGuessing() {
      phase = "guessing";
      const fb = root.querySelector("#constFeedback");
      if (fb) fb.textContent = "Time's up. Recreate the pattern.";
      render();
    }

    function checkGuess(index) {
      if (phase !== "guessing") return;

      if (userGuesses.has(index)) {
        userGuesses.delete(index);
      } else {
        userGuesses.add(index);
      }

      render();

      if (userGuesses.size === maxPossible) {
        finishGame();
      }
    }

    function finishGame() {
      phase = "finished";
      let correctGuesses = 0;
      userGuesses.forEach((index) => {
        if (activeCells.has(index)) correctGuesses++;
      });

      score = correctGuesses;
      stateG.bestScore = Math.max(stateG.bestScore, score);
      save(stateG);

      const fb = root.querySelector("#constFeedback");
      if (fb) {
        if (correctGuesses === maxPossible) {
          fb.textContent = `Perfect. Score: ${correctGuesses}/${maxPossible}.`;
          fb.style.color = "var(--success)";
        } else {
          fb.textContent = `Score: ${correctGuesses}/${maxPossible} correct.`;
          fb.style.color = "var(--warning)";
        }
      }

      render();
    }

    function render() {
      let cells = "";
      for (let i = 0; i < SIZE * SIZE; i++) {
        let style = "";
        let className = "";

        if (phase === "memorizing") {
          if (activeCells.has(i)) style = "background: rgba(0,255,255,0.8);";
        } else if (phase === "guessing") {
          if (userGuesses.has(i)) style = "background: var(--ink-dim);";
        } else if (phase === "finished") {
          const isActive = activeCells.has(i);
          const guessed = userGuesses.has(i);
          if (isActive && guessed) {
            style = "background: var(--success);";
          } else if (isActive && !guessed) {
            style = "background: var(--warning);";
          } else if (!isActive && guessed) {
            style = "background: var(--error);";
          } else {
            style = "background: var(--bg-highlight-dim);";
          }
        }

        cells += `<div data-index="${i}" style="${style}"></div>`;
      }

      root.innerHTML = `
        <h2>Constellation</h2>
        <p style="font-size:0.9rem;opacity:.8;margin-top:-0.5rem;margin-bottom:.6rem">
          Click Start, then memorize the highlighted squares. Once the highlighting ceases, click the squares to recreate the pattern.
        </p>
        <div style="font-family:ui-monospace, Menlo, Consolas, monospace; margin-bottom: 0.8rem">
          Best Score: ${stateG.bestScore} · Plays: ${stateG.plays}
        </div>
        
        <div id="constGrid" style="display:grid; grid-template-columns: repeat(${SIZE}, 1fr); width: 300px; height: 300px; border: 2px solid var(--line); margin: 0 auto;">
          ${cells}
        </div>
        
        <p id="constFeedback" style="margin-top: 1rem; font-weight: bold; text-align: center;">
          ${
            phase === "memorizing"
              ? "Memorize the highlighted pattern."
              : phase === "guessing"
              ? `Guesses: ${userGuesses.size}/${maxPossible}`
              : phase === "finished"
              ? ""
              : "Click Start to begin."
          }
        </p>
        
        <div style="text-align: center; margin-top: 1rem;">
          <button id="constStart" ${
            phase === "memorizing" || phase === "guessing" ? "disabled" : ""
          }>
            ${phase === "finished" ? "Start New Constellation" : "Start"}
          </button>
          <button id="constResetHistory">Reset History</button>
        </div>
      `;

      const startBtn = root.querySelector("#constStart");
      startBtn.onclick = () => {
        if (timeoutId) clearTimeout(timeoutId);
        generateConstellation();
      };

      const resetBtn = root.querySelector("#constResetHistory");
      resetBtn.onclick = () => {
        stateG.bestScore = 0;
        stateG.plays = 0;
        save(stateG);
        render();
      };

      root.querySelectorAll("#constGrid > div").forEach((cell) => {
        cell.onclick = (e) => {
          const idx = parseInt(e.target.dataset.index, 10);
          checkGuess(idx);
        };
      });
    }

    render();
  },
};

// main.js (Add this function and listener near the end of the file)

// --- Home Button/Welcome Screen Logic ---

// Capture the initial welcome HTML content to restore it later
const initialPlayAreaContent = playArea.innerHTML;
const homeLink = document.getElementById("homeLink");

function loadWelcomeScreen() {
  // 1. Reset the play area content
  playArea.innerHTML = initialPlayAreaContent;

  // 2. Clear active state from all game tabs
  tabs.forEach((x) => x.classList.remove("active"));

  // 3. Clear any active timers/intervals from the previous game (best practice)
  // This is handled by the games themselves listening to "DOMNodeRemoved",
  // but explicitly calling the event can be safer if needed.
}

// Attach the click handler to the ClarityToybox header link
if (homeLink) {
  homeLink.addEventListener("click", (e) => {
    e.preventDefault(); // Prevent default link behavior
    loadWelcomeScreen();
  });
}

// tab wiring
tabs.forEach((btn) => {
  btn.onclick = () => {
    const gameId = btn.dataset.game;
    const init = games[gameId];
    playArea.innerHTML = "";
    const container = playArea;

    if (!state.games) state.games = {};
    if (!state.games[gameId]) state.games[gameId] = {};

    const prev = state.games[gameId];
    const save = (newState) => {
      Object.assign(state.games[gameId], newState);
      saveState();
    };
    if (typeof init === "function") {
      init(container, prev, save);
    } else {
      const box = document.createElement("div");
      box.className = "panel section";
      box.textContent = "This game is not implemented yet.";
      container.appendChild(box);
    }
  };
});

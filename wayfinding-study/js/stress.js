/**
 * v4.3 stress-induction modules.
 *
 * Default: a MIST-style experimental block built from the published method
 * (Dedovic et al., 2005, J Psychiatry Neurosci 30(5): 319–325). This is an
 * original HTML/JS implementation from the paper's description. It does not
 * copy Inquisit / Millisecond code or assets.
 *
 *   WFStress.runMist(host, cfg, onEvent)
 *     cfg.phase = "practice" (untimed, first use) or "experimental" (timed,
 *     with a performance bar and a fixed high "average" marker).
 *
 * Legacy modules, off unless flagged in the app:
 *   WFStress.runPrep  — anticipatory preparation screen (?prep=1)
 *   WFStress.run      — live serial subtraction with failure feedback (?liveStress=1)
 *   WFStress.runQuiet — optional short real arithmetic at the end (?endMath=1)
 *
 * Wording is DRAFT for IRB (WFStress.WORDING_VERSION).
 */
(function () {
  "use strict";

  const WORDING_VERSION = "DRAFT_IRB_2026-11-09_v43";

  const PREP_COPY = {
    first: {
      title: "Preparation for the arithmetic task",
      html: `
        <p>Later in this session you will complete a short mental arithmetic task. The task will be timed and scored. You will be asked to subtract a number repeatedly, as quickly and accurately as you can.</p>
        <p>Please use the next few minutes to prepare. Two example problems are shown below. You do not need to enter any answers now.</p>
        <div class="prep-examples">
          <h3>Example problems</h3>
          <ol>
            <li>Starting at 1022, subtract 13 each time: 1022 − 13 = 1009, then 1009 − 13 = 996, and so on.</li>
            <li>Starting at 847, subtract 7 each time: 847 − 7 = 840, then 840 − 7 = 833, and so on.</li>
          </ol>
        </div>
        <p>The wayfinding task will continue after this preparation period. The arithmetic task itself will come later in the session.</p>`,
    },
    second: {
      title: "Preparation (continued)",
      html: `
        <p>The arithmetic task is still ahead. It will be timed and scored, as described earlier.</p>
        <p>Please use the next few minutes to prepare again for the next part of the session. An example problem is shown below. You do not need to enter any answers now.</p>
        <div class="prep-examples">
          <h3>Example problem</h3>
          <ol>
            <li>Starting at 1022, subtract 13 each time: 1022 − 13 = 1009, then 1009 − 13 = 996, and so on.</li>
          </ol>
        </div>
        <p>The second part of the wayfinding task will begin after this preparation period.</p>`,
    },
  };

  const MIST_DEFAULTS = {
    DURATION_S: 180,
    PRACTICE_S: 40,
    AVERAGE_PCT: 85,
    LIMIT_FACTOR: 0.90,       // about 10% below the practice mean/median RT
    LIMIT_MIN_MS: 650,
    LIMIT_MAX_MS: 7000,
    DEFAULT_MEAN_RT_MS: 3000,
    ADAPT_CORRECT_STREAK: 2,
    ADAPT_ERROR_STREAK: 2,
    ADAPT_DOWN: 0.90,         // shorten limit after a correct streak
    ADAPT_UP: 1.12,           // lengthen after an error streak
    ACC_LOW: 0.20,
    ACC_HIGH: 0.45,
    ACC_WINDOW: 8,
    ACC_TIGHTEN: 0.88,
    ACC_LOOSEN: 1.14,
    FEEDBACK_MS: 700,
    START_LEVEL: 3,
    PRACTICE_LEVEL_MAX: 2,
    MIN_LEVEL: 1,
    MAX_LEVEL: 5,
    EVAL_MESSAGES: false,
    EVAL_SEGMENTS: 3,
    EVAL_MSG_MS: 3500,
    MIN_PRACTICE_CORRECT: 3,
  };

  const MIST_COPY = {
    practiceTitle: "Mental arithmetic — practice",
    taskTitle: "Mental arithmetic",
    practiceHint: "There is no time limit on these practice problems. Enter a single-digit answer (0–9) by clicking a number or pressing a number key.",
    taskHint: "Enter a single-digit answer (0–9) by clicking a number or pressing a number key. Work as quickly and accurately as you can.",
    yourPerf: "Your performance",
    avgPerf: "Average performance",
    evalMessage: "Your performance is below average. Please try to work faster and more accurately.",
  };

  const DEBRIEF_COPY = {
    title: "Debriefing",
    html: `
      <p class="draft-banner"><strong>DRAFT for IRB review — not final consent/debrief language.</strong></p>
      <p>During the mental arithmetic task, a bar compared “your performance” with “average performance.”</p>
      <p>The “average performance” marker was <strong>not</strong> a real average of other participants. It was a fixed, high value (around 80–90%). The time allowed for each problem was also adjusted so that the task would stay very difficult for everyone. The comparison was part of the study procedure, not a true score of your ability.</p>
      <p>The aim of this procedure was to create a mild, temporary feeling of pressure, similar to everyday evaluative stress. If you have questions or would like to talk about how you felt during the task, please contact the study team.</p>
      <p><strong>[PLACEHOLDER: additional IRB-approved debrief text, including who to contact and any further clarification the IRB requires.]</strong></p>`,
  };

  /* ---------------- utilities ---------------- */
  function fmtClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function rngInt(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }
  function rngPick(rng, arr) {
    return arr[rngInt(rng, 0, arr.length - 1)];
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function median(vals) {
    if (!vals.length) return null;
    const a = vals.slice().sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------------- problem generator (original; paper constraints only) ----------------
   * Dedovic et al.: mental arithmetic using up to four numbers in 0–99 and the
   * four operations, with a single-digit (0–9) integer answer. Levels 1–5 increase
   * the number of operations and the size of the operands. Expressions use standard
   * precedence (× ÷ before + −) and parentheses when needed.
   */
  const N = (v) => ({ type: "num", v: v });
  const PREC = { "×": 2, "÷": 2, "+": 1, "−": 1 };

  function fmtNode(node, parentPrec, isRight) {
    if (node.type === "num") return String(node.v);
    const prec = PREC[node.op] || 1;
    // Left-associative: parenthesize a right child of equal precedence so
    // "a − (b − c)" is not printed as "a − b − c".
    const s = fmtNode(node.l, prec, false) + " " + node.op + " " + fmtNode(node.r, prec, true);
    const needParen = prec < (parentPrec || 0) || (isRight && prec === (parentPrec || 0));
    return needParen ? "(" + s + ")" : s;
  }
  function evalNode(node) {
    if (node.type === "num") return node.v;
    const a = evalNode(node.l), b = evalNode(node.r);
    if (node.op === "+") return a + b;
    if (node.op === "−") return a - b;
    if (node.op === "×") return a * b;
    if (node.op === "÷") return b === 0 ? NaN : a / b;
    return NaN;
  }
  function leafValues(node, out) {
    if (node.type === "num") { out.push(node.v); return out; }
    leafValues(node.l, out); leafValues(node.r, out); return out;
  }
  function opCount(node) {
    return node.type === "num" ? 0 : 1 + opCount(node.l) + opCount(node.r);
  }
  function invertOptions(ans, rng, numMin, numMax, allowMulDiv, tries) {
    const lo = 0, hi = 99;
    const opts = [];
    const seen = new Set();
    const add = (op, l, r) => {
      if (!Number.isInteger(l) || !Number.isInteger(r)) return;
      if (l < lo || l > hi || r < lo || r > hi) return;
      if (op === "÷" && (r === 0 || l % r !== 0)) return;
      if (op === "×" && (l === 0 || r === 0 || l === 1 || r === 1)) return;
      if ((op === "+" || op === "−") && (l === 0 || r === 0)) return;
      if (op === "÷" && (r === 1 || l === 0)) return;
      const key = op + ":" + l + ":" + r;
      if (seen.has(key)) return;
      seen.add(key);
      opts.push({ op: op, l: l, r: r });
    };
    const nTry = tries || 48;
    for (let i = 0; i < nTry; i++) {
      const k = rngInt(rng, numMin, numMax);
      add("+", ans - k, k);
      add("−", ans + k, k);
      add("−", k, k - ans);
      if (allowMulDiv) {
        if (k > 1 && ans % k === 0) add("×", ans / k, k);
        if (k > 1) add("÷", ans * k, k);
        if (ans > 1 && k % ans === 0) add("÷", k, k / ans);
      }
    }
    return opts;
  }
  function buildTree(ans, nOps, rng, numMin, numMax, allowMulDiv) {
    if (nOps <= 0) return N(ans);
    const opts = invertOptions(ans, rng, numMin, numMax, allowMulDiv, 60);
    if (!opts.length) return null;
    const o = rngPick(rng, opts);
    const rest = nOps - 1;
    let leftOps = 0, rightOps = 0;
    if (rest > 0) {
      if (rng() < 0.75) leftOps = rest;
      else { leftOps = rngInt(rng, 0, rest); rightOps = rest - leftOps; }
    }
    const l = leftOps ? buildTree(o.l, leftOps, rng, numMin, numMax, allowMulDiv) : N(o.l);
    const r = rightOps ? buildTree(o.r, rightOps, rng, numMin, numMax, allowMulDiv) : N(o.r);
    if (!l || !r) return null;
    return { type: "op", op: o.op, l: l, r: r };
  }

  const FALLBACK = {
    1: [
      ["3 + 4", 7], ["9 − 2", 7], ["6 + 1", 7], ["8 − 5", 3], ["2 + 5", 7],
      ["4 + 4", 8], ["7 − 3", 4], ["1 + 6", 7], ["9 − 8", 1], ["5 + 3", 8],
    ],
    2: [
      ["12 − 8", 4], ["4 × 2", 8], ["18 ÷ 3", 6], ["25 − 19", 6], ["3 × 3", 9],
      ["45 − 38", 7], ["16 ÷ 2", 8], ["7 × 1", 7], ["63 ÷ 9", 7], ["31 − 27", 4],
    ],
    3: [
      ["12 + 5 − 9", 8], ["3 × 6 − 10", 8], ["(15 − 7) × 1", 8], ["24 ÷ 4 + 1", 7],
      ["18 − 9 − 6", 3], ["5 × 3 − 8", 7], ["(9 + 7) ÷ 2", 8], ["14 + 8 − 19", 3],
    ],
    4: [
      ["(12 + 8) ÷ 4 − 1", 4], ["3 × 7 − 10 − 5", 6], ["(18 − 6) ÷ 3 + 1", 5],
      ["4 × 8 − 20 − 5", 7], ["(9 × 3 + 3) ÷ 6", 5], ["15 + 9 − 8 − 9", 7],
    ],
    5: [
      ["(24 × 3 − 48) ÷ 6", 4], ["(18 + 14) × 2 − 60", 4], ["(45 − 18) ÷ 9 + 5", 8],
      ["(16 × 4 − 28) ÷ 9", 4], ["(13 + 17) × 3 − 84", 6], ["(72 ÷ 8 + 5) × 1 − 5", 9],
    ],
  };

  function fallbackProblem(level, rng) {
    const lvl = clamp(level | 0, 1, 5);
    const pair = rngPick(rng, FALLBACK[lvl]);
    return { expr: pair[0], answer: pair[1], level: lvl, source: "fallback" };
  }

  /**
   * Generate one problem at `level` (1–5). `rng` is a () => [0,1) function.
   * Returns { expr, answer, level, source }.
   */
  function generateProblem(level, rng) {
    const rnd = rng || Math.random;
    const lvl = clamp(level | 0, 1, 5);
    const nOps = lvl === 1 ? 1 : lvl === 2 ? 1 : lvl === 3 ? 2 : lvl === 4 ? 3 : rngInt(rnd, 3, 4);
    const allowMulDiv = lvl >= 2;
    const numMin = lvl <= 1 ? 1 : lvl === 2 ? 2 : lvl === 3 ? 2 : 3;
    const numMax = lvl <= 1 ? 9 : lvl === 2 ? 24 : lvl === 3 ? 40 : 99;
    for (let attempt = 0; attempt < 30; attempt++) {
      const ans = rngInt(rnd, 0, 9);
      // For level 1 prefer +/− only (allowMulDiv false).
      const tree = buildTree(ans, nOps, rnd, numMin, numMax, allowMulDiv);
      if (!tree || tree.type !== "op") continue;
      const val = evalNode(tree);
      if (val !== ans || !Number.isInteger(val) || val < 0 || val > 9) continue;
      const nums = leafValues(tree, []);
      if (nums.some((n) => n < 0 || n > 99 || !Number.isInteger(n))) continue;
      if (opCount(tree) < 1) continue;
      // Prefer non-trivial: at least one operand > 1
      if (nums.every((n) => n <= 1) && lvl > 1) continue;
      return { expr: fmtNode(tree, 0), answer: ans, level: lvl, source: "gen" };
    }
    return fallbackProblem(lvl, rnd);
  }

  /* ---------------- anticipatory prep (legacy) ---------------- */
  function runPrep(host, cfg, onEvent) {
    const C = Object.assign({ DURATION_S: 45, variant: "first", wordingVersion: WORDING_VERSION }, cfg || {});
    const copy = PREP_COPY[C.variant] || PREP_COPY.first;
    return new Promise((resolve) => {
      host.innerHTML = `<div class="page prep" data-prep="${C.variant}">
        <h2>${copy.title}</h2>
        ${copy.html}
        <div class="prep-clock" id="prep-clock" aria-live="polite">${fmtClock(C.DURATION_S * 1000)}</div>
        <p class="hint" id="prep-hint">This screen will continue automatically when the time is up.</p>
        <p class="exp-note draft-note" hidden>DRAFT wording (${C.wordingVersion}) — confirm before use. Experimenter: Esc skips the wait.</p>
      </div>`;
      if (document.body.classList.contains("debug")) {
        const n = host.querySelector(".draft-note");
        if (n) n.hidden = false;
      }
      const t0 = performance.now();
      const clock = host.querySelector("#prep-clock");
      let raf = null, done = false;
      const finish = (skipped) => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown", onKey);
        const duration_ms = Math.round(performance.now() - t0);
        onEvent && onEvent("prep_offset", { variant: C.variant, skipped: skipped ? 1 : 0, duration_ms });
        resolve({ config: C, variant: C.variant, skipped: !!skipped, duration_ms, wordingVersion: C.wordingVersion });
      };
      const onKey = (e) => { if (e.key === "Escape") finish(true); };
      document.addEventListener("keydown", onKey);
      onEvent && onEvent("prep_onset", { variant: C.variant, duration_s: C.DURATION_S, wordingVersion: C.wordingVersion });
      if (C.DURATION_S <= 0) { finish(false); return; }
      const tick = () => {
        const left = C.DURATION_S * 1000 - (performance.now() - t0);
        if (clock) clock.textContent = fmtClock(left);
        if (left <= 0) { finish(false); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
  }

  /* ---------------- live serial subtraction (legacy) ---------------- */
  function run(host, cfg, onEvent) {
    const C = Object.assign({ START: 1022, STEP: 13, DURATION_S: 300, LIMIT0_MS: 7000, LIMIT_MIN_MS: 2500, LIMIT_MAX_MS: 10000,
      FEEDBACK_MS: 900, ADAPT_N: 3 }, cfg || {});
    return new Promise((resolve) => {
      host.innerHTML = `<div class="stress">
        <div class="stress-top"><span id="st-clock" class="st-clock"></span></div>
        <div class="st-task">Subtract ${C.STEP} each time.</div>
        <div class="st-prev" id="st-prev">Start at <strong>${C.START}</strong></div>
        <input id="st-input" class="st-input" type="text" inputmode="numeric" autocomplete="off" maxlength="5" aria-label="Your answer">
        <div class="st-bar"><div class="st-bar-fill" id="st-bar"></div></div>
        <div class="st-fb" id="st-fb">&nbsp;</div>
        <p class="hint">Type your answer and press Enter.</p></div>`;
      const inp = host.querySelector("#st-input"), bar = host.querySelector("#st-bar"), fb = host.querySelector("#st-fb");
      const prev = host.querySelector("#st-prev"), clock = host.querySelector("#st-clock");
      const t0 = performance.now();
      const responses = [];
      let current = C.START, limit = C.LIMIT0_MS, streakOk = 0, streakBad = 0, itemOnset = 0, timer = null, raf = null, locked = false, done = false;
      let nCorrect = 0, nWrong = 0, nTimeout = 0, nRestarts = 0, best = C.START;

      const finish = () => {
        if (done) return; done = true;
        clearTimeout(timer); cancelAnimationFrame(raf);
        onEvent && onEvent("stress_task_end", { nCorrect, nWrong, nTimeout, nRestarts });
        resolve({ config: C, responses, summary: { n_responses: responses.length, n_correct: nCorrect, n_wrong: nWrong,
          n_timeout: nTimeout, n_restarts: nRestarts, lowest_number_reached: best, final_limit_ms: Math.round(limit),
          duration_ms: Math.round(performance.now() - t0) } });
      };
      const tick = () => {
        const now = performance.now();
        const left = Math.max(0, C.DURATION_S * 1000 - (now - t0));
        clock.textContent = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
        if (!locked) bar.style.width = Math.max(0, 100 * (1 - (now - itemOnset) / limit)) + "%";
        if (left <= 0 && !locked) { finish(); return; }
        raf = requestAnimationFrame(tick);
      };
      const nextItem = () => {
        if (done) return;
        if (performance.now() - t0 >= C.DURATION_S * 1000) { finish(); return; }
        locked = false; fb.textContent = "\u00a0"; fb.className = "st-fb";
        inp.value = ""; inp.disabled = false; inp.focus();
        itemOnset = performance.now();
        clearTimeout(timer);
        timer = setTimeout(() => respond(null), limit);
      };
      const respond = (given) => {
        if (locked || done) return;
        locked = true; clearTimeout(timer);
        const now = performance.now();
        const expected = current - C.STEP;
        const timeout = given == null;
        const correct = !timeout && given === expected;
        const row = { idx: responses.length + 1, previous: current, expected, given: timeout ? "" : given,
          correct: correct ? 1 : 0, timeout: timeout ? 1 : 0, rt_ms: Math.round(now - itemOnset), limit_ms: Math.round(limit),
          onset_perf: +itemOnset.toFixed(1), response_perf: +now.toFixed(1), elapsed_ms: Math.round(now - t0), timestamp: new Date().toISOString() };
        responses.push(row);
        if (correct) {
          nCorrect++; streakOk++; streakBad = 0; current = expected; best = Math.min(best, current);
          if (streakOk >= C.ADAPT_N) { limit = Math.max(C.LIMIT_MIN_MS, limit * 0.9); streakOk = 0; }
          fb.textContent = "Correct"; fb.className = "st-fb ok";
          prev.innerHTML = `Last answer: <strong>${current}</strong>`;
        } else {
          timeout ? nTimeout++ : nWrong++; nRestarts++; streakBad++; streakOk = 0; current = C.START;
          if (streakBad >= C.ADAPT_N) { limit = Math.min(C.LIMIT_MAX_MS, limit * 1.1); streakBad = 0; }
          fb.textContent = timeout ? `Too slow. Start again from ${C.START}.` : `Incorrect. Start again from ${C.START}.`;
          fb.className = "st-fb bad";
          prev.innerHTML = `Start at <strong>${C.START}</strong>`;
        }
        row.next_limit_ms = Math.round(limit);
        onEvent && onEvent("stress_response", { correct: row.correct, timeout: row.timeout, rt_ms: row.rt_ms });
        inp.disabled = true;
        setTimeout(nextItem, C.FEEDBACK_MS);
      };
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const s = inp.value.trim();
          if (!/^-?\d+$/.test(s)) return;
          respond(parseInt(s, 10));
        }
      });
      onEvent && onEvent("stress_task_start", { config: C });
      raf = requestAnimationFrame(tick);
      nextItem();
    });
  }

  /* ---------------- quiet end math (legacy / optional) ---------------- */
  function runQuiet(host, cfg, onEvent) {
    const C = Object.assign({ START: 1022, STEP: 13, DURATION_S: 120 }, cfg || {});
    return new Promise((resolve) => {
      host.innerHTML = `<div class="stress quiet" data-end-math="1">
        <div class="stress-top"><span id="st-clock" class="st-clock"></span></div>
        <div class="st-task">Subtract ${C.STEP} each time.</div>
        <div class="st-prev" id="st-prev">Start at <strong>${C.START}</strong></div>
        <input id="st-input" class="st-input" type="text" inputmode="numeric" autocomplete="off" maxlength="5" aria-label="Your answer">
        <p class="hint">Type your answer and press Enter. Please work as quickly and accurately as you can.</p>
      </div>`;
      const inp = host.querySelector("#st-input"), prev = host.querySelector("#st-prev"), clock = host.querySelector("#st-clock");
      const t0 = performance.now();
      const responses = [];
      let current = C.START, itemOnset = 0, raf = null, locked = false, done = false;
      let nCorrect = 0, nWrong = 0, best = C.START;

      const finish = () => {
        if (done) return; done = true;
        cancelAnimationFrame(raf);
        onEvent && onEvent("end_math_end", { nCorrect, nWrong, n_responses: responses.length });
        resolve({ config: C, responses, summary: { n_responses: responses.length, n_correct: nCorrect, n_wrong: nWrong,
          n_timeout: 0, n_restarts: 0, lowest_number_reached: best,
          duration_ms: Math.round(performance.now() - t0) } });
      };
      const tick = () => {
        const now = performance.now();
        const left = Math.max(0, C.DURATION_S * 1000 - (now - t0));
        clock.textContent = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;
        if (left <= 0) { finish(); return; }
        raf = requestAnimationFrame(tick);
      };
      const nextItem = () => {
        if (done) return;
        if (performance.now() - t0 >= C.DURATION_S * 1000) { finish(); return; }
        locked = false;
        inp.value = ""; inp.disabled = false; inp.focus();
        itemOnset = performance.now();
      };
      const respond = (given) => {
        if (locked || done) return;
        locked = true;
        const now = performance.now();
        const expected = current - C.STEP;
        const correct = given === expected;
        const row = { idx: responses.length + 1, previous: current, expected, given,
          correct: correct ? 1 : 0, timeout: 0, rt_ms: Math.round(now - itemOnset), limit_ms: "",
          next_limit_ms: "", onset_perf: +itemOnset.toFixed(1), response_perf: +now.toFixed(1),
          elapsed_ms: Math.round(now - t0), timestamp: new Date().toISOString() };
        responses.push(row);
        if (correct) { nCorrect++; current = expected; }
        else { nWrong++; current = given; }
        best = Math.min(best, current);
        onEvent && onEvent("end_math_response", { correct: row.correct, rt_ms: row.rt_ms });
        prev.innerHTML = `Last answer: <strong>${current}</strong>`;
        inp.disabled = true;
        nextItem();
      };
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const s = inp.value.trim();
          if (!/^-?\d+$/.test(s)) return;
          respond(parseInt(s, 10));
        }
      });
      onEvent && onEvent("end_math_start", { config: C });
      raf = requestAnimationFrame(tick);
      nextItem();
    });
  }

  /* ---------------- MIST-style block ---------------- */
  function dialButtonsHtml() {
    const btns = [];
    for (let i = 0; i <= 9; i++) {
      const ang = (i / 10) * 2 * Math.PI - Math.PI / 2;
      const x = 50 + 40 * Math.cos(ang);
      const y = 50 + 40 * Math.sin(ang);
      btns.push(`<button type="button" class="mist-dial-btn" data-digit="${i}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%" aria-label="Answer ${i}">${i}</button>`);
    }
    return btns.join("");
  }

  function initialLimit(state, C) {
    const base = (state && state.practiceRtMs) || C.DEFAULT_MEAN_RT_MS;
    return clamp(Math.round(base * C.LIMIT_FACTOR), C.LIMIT_MIN_MS, C.LIMIT_MAX_MS);
  }

  function runMist(host, cfg, onEvent) {
    const C = Object.assign({}, MIST_DEFAULTS, cfg || {});
    const phase = C.phase === "practice" ? "practice" : "experimental";
    const isPractice = phase === "practice";
    const variant = C.variant || (isPractice ? "practice" : "experimental");
    const durationS = isPractice ? C.PRACTICE_S : C.DURATION_S;
    const state = C.state || {};
    const seed = (C.seed != null ? C.seed : Math.floor(Math.random() * 1e9)) ^ (phase === "practice" ? 0x9e3779b9 : 0x85ebca6b);
    const rng = mulberry32(seed >>> 0);
    const avgPct = clamp(C.AVERAGE_PCT, 80, 90);

    return new Promise((resolve) => {
      const title = isPractice ? MIST_COPY.practiceTitle : MIST_COPY.taskTitle;
      const hint = isPractice ? MIST_COPY.practiceHint : MIST_COPY.taskHint;
      host.innerHTML = `<div class="mist" data-mist-phase="${phase}" data-mist-variant="${variant}">
        <div class="mist-top">
          <div class="mist-kicker">${isPractice ? "Practice" : "Timed task"}</div>
          <span id="mist-clock" class="mist-clock" aria-live="polite">${fmtClock(durationS * 1000)}</span>
        </div>
        <h2 class="mist-title">${title}</h2>
        <div class="mist-perf ${isPractice ? "is-practice" : ""}" id="mist-perf" ${isPractice ? "hidden" : ""}>
          <div class="mist-perf-labels">
            <span class="mist-perf-you-lab">${MIST_COPY.yourPerf}</span>
          </div>
          <div class="mist-perf-track" role="img" aria-label="Performance comparison">
            <div class="mist-perf-you" id="mist-you" style="width:0%"></div>
            <div class="mist-perf-avg" id="mist-avg" style="left:${avgPct}%">
              <span class="mist-perf-avg-lab">${MIST_COPY.avgPerf}</span>
            </div>
          </div>
          <div class="mist-perf-scale"><span>0%</span><span>100%</span></div>
        </div>
        <div class="mist-problem" id="mist-problem" aria-live="polite">&nbsp;</div>
        <div class="mist-timer ${isPractice ? "untimed" : ""}" id="mist-timer" ${isPractice ? "hidden" : ""}>
          <div class="mist-timer-fill" id="mist-timer-fill"></div>
        </div>
        <div class="mist-fb" id="mist-fb">&nbsp;</div>
        <div class="mist-eval" id="mist-eval" hidden><p>${MIST_COPY.evalMessage}</p></div>
        <div class="mist-dial" id="mist-dial" aria-label="Number dial 0 to 9">${dialButtonsHtml()}</div>
        <p class="hint mist-hint">${hint}</p>
        <p class="exp-note draft-note" hidden>DRAFT wording (${C.wordingVersion || WORDING_VERSION}). Experimenter: Esc skips this segment.</p>
      </div>`;
      if (document.body.classList.contains("debug")) {
        const n = host.querySelector(".draft-note");
        if (n) n.hidden = false;
      }

      const elProb = host.querySelector("#mist-problem");
      const elFb = host.querySelector("#mist-fb");
      const elClock = host.querySelector("#mist-clock");
      const elFill = host.querySelector("#mist-timer-fill");
      const elYou = host.querySelector("#mist-you");
      const elEval = host.querySelector("#mist-eval");
      const elDial = host.querySelector("#mist-dial");
      const buttons = Array.from(host.querySelectorAll(".mist-dial-btn"));

      const t0 = performance.now();
      const responses = [];
      let level = isPractice ? 1 : (state.lastLevel || C.START_LEVEL);
      let limit = isPractice ? null : initialLimit(state, C);
      let streakOk = 0, streakBad = 0;
      let nCorrect = 0, nWrong = 0, nTimeout = 0;
      let itemOnset = 0, timer = null, raf = null, locked = false, done = false;
      let current = null;
      let paused = false, pauseLeft = 0;
      let activeMs = 0; // time spent on items (excludes evaluation-message pauses)
      let lastTick = t0;

      const yourPct = () => {
        const n = responses.length;
        return n ? (100 * nCorrect) / n : 0;
      };
      const updateBar = () => {
        if (!elYou || isPractice) return;
        elYou.style.width = yourPct().toFixed(1) + "%";
        const track = host.querySelector(".mist-perf-track");
        if (track) track.setAttribute("aria-label", `Your performance ${Math.round(yourPct())} percent, average performance ${avgPct} percent`);
      };
      const setDialEnabled = (on) => {
        buttons.forEach((b) => { b.disabled = !on; });
      };
      const recentAcc = () => {
        const w = responses.slice(-C.ACC_WINDOW);
        if (!w.length) return null;
        return w.filter((r) => r.correct).length / w.length;
      };

      const finish = (skipped, reason) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown", onKey, true);
        const duration_ms = Math.round(performance.now() - t0);
        const practiceRts = responses.filter((r) => r.correct && !r.timeout && r.rt_ms > 150 && r.rt_ms < 15000).map((r) => r.rt_ms);
        const practiceRtMs = median(practiceRts);
        const summary = {
          phase: phase,
          variant: variant,
          skipped: skipped ? 1 : 0,
          reason: reason || (skipped ? "skipped" : "completed"),
          n_responses: responses.length,
          n_correct: nCorrect,
          n_wrong: nWrong,
          n_timeout: nTimeout,
          pct_correct: responses.length ? Math.round(1000 * nCorrect / responses.length) / 10 : 0,
          final_level: level,
          final_limit_ms: limit == null ? "" : Math.round(limit),
          practice_rt_ms: practiceRtMs != null ? Math.round(practiceRtMs) : "",
          practice_n_rt: practiceRts.length,
          average_marker_pct: isPractice ? "" : avgPct,
          your_pct: responses.length ? Math.round(10 * yourPct()) / 10 : 0,
          duration_ms: duration_ms,
          seed: seed >>> 0,
          wordingVersion: C.wordingVersion || WORDING_VERSION,
        };
        if (isPractice && practiceRtMs != null) state.practiceRtMs = practiceRtMs;
        else if (isPractice && !state.practiceRtMs) state.practiceRtMs = C.DEFAULT_MEAN_RT_MS;
        if (!isPractice) {
          state.lastLevel = level;
          state.lastLimitMs = limit;
        }
        onEvent && onEvent("mist_offset", { phase: phase, variant: variant, skipped: skipped ? 1 : 0, summary: summary });
        resolve({ config: C, phase: phase, variant: variant, skipped: !!skipped, responses: responses, summary: summary, state: state });
      };

      const adaptAfter = (correct, timeout) => {
        if (isPractice) {
          if (correct && level < C.PRACTICE_LEVEL_MAX) level += 1;
          else if (!correct && level > C.MIN_LEVEL) level -= 1;
          return;
        }
        if (correct) {
          streakOk++; streakBad = 0;
          if (streakOk >= C.ADAPT_CORRECT_STREAK) {
            limit = clamp(limit * C.ADAPT_DOWN, C.LIMIT_MIN_MS, C.LIMIT_MAX_MS);
            if (level < C.MAX_LEVEL) level += 1;
            streakOk = 0;
          }
        } else {
          streakBad++; streakOk = 0;
          if (streakBad >= C.ADAPT_ERROR_STREAK) {
            limit = clamp(limit * C.ADAPT_UP, C.LIMIT_MIN_MS, C.LIMIT_MAX_MS);
            if (level > C.MIN_LEVEL) level -= 1;
            streakBad = 0;
          }
        }
        const acc = recentAcc();
        if (acc != null && responses.length >= 4) {
          if (acc > C.ACC_HIGH) {
            limit = clamp(limit * C.ACC_TIGHTEN, C.LIMIT_MIN_MS, C.LIMIT_MAX_MS);
            if (level < C.MAX_LEVEL) level = Math.min(C.MAX_LEVEL, level + 1);
          } else if (acc < C.ACC_LOW) {
            limit = clamp(limit * C.ACC_LOOSEN, C.LIMIT_MIN_MS, C.LIMIT_MAX_MS);
            if (level > C.MIN_LEVEL) level = Math.max(C.MIN_LEVEL, level - 1);
          }
        }
        void timeout;
      };

      const respond = (given) => {
        if (locked || done || paused || !current) return;
        locked = true;
        clearTimeout(timer);
        const now = performance.now();
        const timeout = given == null;
        const correct = !timeout && given === current.answer;
        const feedback = timeout ? "Timeout" : (correct ? "Correct" : "Incorrect");
        if (correct) nCorrect++;
        else if (timeout) nTimeout++;
        else nWrong++;
        const row = {
          idx: responses.length + 1,
          task: "mist",
          phase: phase,
          variant: variant,
          difficulty: current.level,
          level: current.level,
          problem: current.expr,
          expected: current.answer,
          given: timeout ? "" : given,
          correct: correct ? 1 : 0,
          timeout: timeout ? 1 : 0,
          feedback: feedback,
          rt_ms: Math.round(now - itemOnset),
          limit_ms: isPractice ? "" : Math.round(limit),
          onset_perf: +itemOnset.toFixed(1),
          response_perf: +now.toFixed(1),
          elapsed_ms: Math.round(now - t0),
          timestamp: new Date().toISOString(),
          your_pct: "",
          average_marker: isPractice ? "" : avgPct,
        };
        adaptAfter(correct, timeout);
        row.next_limit_ms = isPractice ? "" : Math.round(limit);
        row.next_level = level;
        responses.push(row);
        row.your_pct = Math.round(10 * yourPct()) / 10;
        updateBar();
        elFb.textContent = feedback;
        elFb.className = "mist-fb " + (correct ? "ok" : "bad");
        setDialEnabled(false);
        onEvent && onEvent("mist_response", {
          phase: phase, variant: variant, correct: row.correct, timeout: row.timeout,
          rt_ms: row.rt_ms, level: current.level, feedback: feedback,
        });
        const fbWait = C.FEEDBACK_MS;
        setTimeout(() => {
          if (done) return;
          maybeEvalThenNext();
        }, fbWait);
      };

      const showEvalThen = (cb) => {
        if (isPractice || !C.EVAL_MESSAGES) { cb(); return; }
        paused = true;
        elEval.hidden = false;
        elProb.textContent = "\u00a0";
        elFb.textContent = "\u00a0";
        elFb.className = "mist-fb";
        if (elFill) elFill.style.width = "0%";
        setDialEnabled(false);
        onEvent && onEvent("mist_eval_message", { variant: variant, duration_ms: C.EVAL_MSG_MS });
        setTimeout(() => {
          elEval.hidden = true;
          paused = false;
          lastTick = performance.now();
          cb();
        }, C.EVAL_MSG_MS);
      };

      let evalAt = [];
      if (!isPractice && C.EVAL_MESSAGES && C.EVAL_SEGMENTS > 1) {
        for (let i = 1; i < C.EVAL_SEGMENTS; i++) evalAt.push((durationS * 1000 * i) / C.EVAL_SEGMENTS);
      }
      const maybeEvalThenNext = () => {
        if (done) return;
        if (!isPractice && evalAt.length && activeMs >= evalAt[0]) {
          evalAt.shift();
          showEvalThen(nextItem);
        } else {
          nextItem();
        }
      };

      const nextItem = () => {
        if (done) return;
        if (!isPractice && activeMs >= durationS * 1000) { finish(false, "completed"); return; }
        if (isPractice && (performance.now() - t0) >= durationS * 1000) { finish(false, "completed"); return; }
        locked = false;
        elFb.textContent = "\u00a0";
        elFb.className = "mist-fb";
        elEval.hidden = true;
        const lvl = isPractice ? clamp(level, 1, C.PRACTICE_LEVEL_MAX) : clamp(level, C.MIN_LEVEL, C.MAX_LEVEL);
        current = generateProblem(lvl, rng);
        elProb.textContent = current.expr;
        setDialEnabled(true);
        itemOnset = performance.now();
        if (elFill) elFill.style.width = isPractice ? "100%" : "100%";
        clearTimeout(timer);
        if (!isPractice) timer = setTimeout(() => respond(null), limit);
        onEvent && onEvent("mist_item_onset", {
          phase: phase, variant: variant, idx: responses.length + 1,
          level: current.level, problem: current.expr, limit_ms: isPractice ? "" : Math.round(limit),
        });
      };

      const tick = (now) => {
        if (done) return;
        if (!paused) {
          activeMs += now - lastTick;
          lastTick = now;
        } else {
          lastTick = now;
        }
        const used = isPractice ? (now - t0) : activeMs;
        const left = durationS * 1000 - used;
        if (elClock) elClock.textContent = fmtClock(left);
        if (!isPractice && !locked && !paused && current && limit) {
          const frac = Math.max(0, 1 - (now - itemOnset) / limit);
          if (elFill) elFill.style.width = (100 * frac) + "%";
        }
        if (left <= 0 && !locked && !paused) { finish(false, "completed"); return; }
        raf = requestAnimationFrame(tick);
      };

      const onKey = (e) => {
        if (done) return;
        if (e.key === "Escape") {
          e.preventDefault();
          finish(true, "skipped");
          return;
        }
        if (locked || paused) return;
        const k = e.key;
        if (k >= "0" && k <= "9") {
          e.preventDefault();
          respond(parseInt(k, 10));
        }
      };

      buttons.forEach((b) => {
        b.addEventListener("click", () => {
          if (locked || paused || done) return;
          respond(parseInt(b.getAttribute("data-digit"), 10));
        });
      });

      document.addEventListener("keydown", onKey, true);
      onEvent && onEvent("mist_onset", {
        phase: phase, variant: variant, duration_s: durationS,
        average_marker_pct: isPractice ? "" : avgPct,
        limit_ms: isPractice ? "" : Math.round(limit),
        seed: seed >>> 0,
        wordingVersion: C.wordingVersion || WORDING_VERSION,
      });
      updateBar();
      if (durationS <= 0) { finish(false, "zero_duration"); return; }
      lastTick = performance.now();
      raf = requestAnimationFrame(tick);
      nextItem();
    });
  }

  window.WFStress = {
    run: run, runPrep: runPrep, runQuiet: runQuiet, runMist: runMist,
    generateProblem: generateProblem, WORDING_VERSION: WORDING_VERSION,
    PREP_COPY: PREP_COPY, MIST_DEFAULTS: MIST_DEFAULTS, MIST_COPY: MIST_COPY,
    DEBRIEF_COPY: DEBRIEF_COPY,
  };
})();

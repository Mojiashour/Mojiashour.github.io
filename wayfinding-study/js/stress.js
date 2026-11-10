/**
 * v4.8 stress-induction modules (Escape skips admin-only).
 *
 * Default: a DST-style timed math block adapted from Norden et al. (2022),
 * J Med Internet Res 24(7):e32280, with a fixed problem list and a fixed
 * per-item limit for every participant (see DST_LISTS / DST_DEFAULTS).
 *
 *   WFStress.runDstAnticipation(host, cfg, onEvent)
 *   WFStress.runDstCountdown(host, cfg, onEvent)
 *   WFStress.runDst(host, cfg, onEvent)
 *
 * Legacy modules, off unless flagged in the app:
 *   WFStress.runMist  — previous adaptive MIST-style block (?legacyMist=1)
 *   WFStress.runPrep  — anticipatory preparation screen (?prep=1)
 *   WFStress.run      — live serial subtraction with failure feedback (?liveStress=1)
 *   WFStress.runQuiet — optional short real arithmetic at the end (?endMath=1)
 *
 * Wording is DRAFT for IRB (WFStress.WORDING_VERSION).
 */
(function () {
  "use strict";
  let activeSkip = null;
  function requestSkip() {
    if (typeof activeSkip === "function") { activeSkip(); return true; }
    return false;
  }

  const WORDING_VERSION = "DRAFT_IRB_2026-11-10_v48";

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
    DURATION_S: 90,           // v4.4: shorter segment (was 180); ?mistSec overrides
    PRACTICE_S: 40,
    AVERAGE_PCT: 85,
    LIMIT_FACTOR: 1.00,       // v4.4: start at practice median RT (not 10% below)
    LIMIT_MIN_MS: 4000,       // absolute floor ~4 s
    LIMIT_MAX_MS: 14000,
    DEFAULT_MEAN_RT_MS: 5000, // gentler fallback when practice RTs are sparse
    ADAPT_CORRECT_STREAK: 3,  // slower adaptation
    ADAPT_ERROR_STREAK: 2,
    ADAPT_DOWN: 0.96,         // smaller steps when shortening
    ADAPT_UP: 1.06,           // smaller steps when lengthening
    ACC_LOW: 0.20,
    ACC_HIGH: 0.45,
    ACC_WINDOW: 8,
    ACC_TIGHTEN: 0.95,
    ACC_LOOSEN: 1.08,
    // 1.5× minimum sensible solve time by level (ms), then max'd with LIMIT_MIN_MS
    LEVEL_FLOOR_MS: { 1: 1800, 2: 2500, 3: 3200, 4: 4000, 5: 4800 },
    LEVEL_FLOOR_FACTOR: 1.5,
    FEEDBACK_MS: 700,
    START_LEVEL: 2,           // start a bit milder; ramp via adaptation
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
      <p class="draft-banner"><strong>DRAFT for IRB review</strong> — this is not final, IRB-approved debrief language. Contact details for the faculty advisor are placeholders.</p>
      <p>During the timed arithmetic checks, a bar compared your accuracy with an “average” of other participants.</p>
      <p>That average was <strong>not</strong> a real average of other participants. It was a fixed reference value (75%) used to create mild evaluative pressure. The problems were designed to be difficult in the time allowed. Performance on this task is not a measure of your ability.</p>
      <p>The time limit at each wayfinding intersection (5 seconds) was real. If you did not choose in time, that decision was recorded as too slow, and the task continued.</p>
      <p>The aim of this procedure was to create a mild, temporary feeling of pressure, similar to the everyday anxiety people often feel before a test or presentation. Some details of the procedures were not fully described at the start of the session so that the experience would be closer to ordinary time pressure. We are sorry for any discomfort this may have caused.</p>
      <p>If you have questions or would like to talk about how you felt during the task, please contact Mojtaba Ashour, student researcher, at <a href="mailto:ma2236@cornell.edu">ma2236@cornell.edu</a>, or Saleh Kalantari, Ph.D., faculty advisor, at [PLACEHOLDER: email and phone]. You may also contact the Cornell Institutional Review Board for Human Participant Research at <a href="mailto:irbhp@cornell.edu">irbhp@cornell.edu</a> or 607-255-5138.</p>
      <p>If you would prefer that your responses not be included in the analysis, you may select <strong>Exclude my data</strong> below. Because the study does not collect your name, later requests to remove data may not be possible unless you have kept your study ID.</p>
      <p><strong>[PLACEHOLDER: any further clarification the IRB requires.]</strong></p>`,
  };

  /* ---------------- utilities ---------------- */
  function isAdminMode() {
    return document.body.classList.contains("admin") || document.body.classList.contains("admin-mode");
  }
  function isAdminEscape(e) {
    return e && e.key === "Escape" && isAdminMode();
  }
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
      ["12 + 5 − 9", 8], ["18 − 7 − 6", 5], ["9 + 8 − 12", 5], ["15 − 4 − 8", 3],
      ["6 + 7 − 9", 4], ["14 − 9 + 3", 8], ["20 − 8 − 7", 5], ["11 + 6 − 10", 7],
    ],
    3: [
      ["3 × 6 − 10", 8], ["5 × 3 − 8", 7], ["4 × 4 − 9", 7], ["2 × 9 − 11", 7],
      ["7 × 3 − 14", 7], ["6 × 2 − 5", 7], ["(9 + 7) × 1 − 8", 8], ["3 × 5 − 6", 9],
    ],
    4: [
      ["(12 + 8) ÷ 4 − 1", 4], ["24 ÷ 4 + 1", 7], ["(18 − 6) ÷ 3 + 1", 5],
      ["(9 × 3 + 3) ÷ 6", 5], ["45 ÷ 9 + 2", 7], ["(16 + 8) ÷ 3 − 1", 7],
      ["72 ÷ 8 − 3", 6], ["(21 − 5) ÷ 4 + 1", 5],
    ],
    5: [
      ["(24 × 3 − 48) ÷ 6", 4], ["(18 + 14) × 2 − 60", 4], ["(45 − 18) ÷ 9 + 5", 8],
      ["(16 × 4 − 28) ÷ 9", 4], ["(13 + 17) × 3 − 84", 6], ["(72 ÷ 8 + 5) − 5", 9],
      ["(9 × 4 − 12) ÷ 6 + 1", 5], ["(32 + 16) ÷ 8 × 1 + 1", 7],
    ],
  };

  function fallbackProblem(level, rng) {
    const lvl = clamp(level | 0, 1, 5);
    const pair = rngPick(rng, FALLBACK[lvl]);
    return { expr: pair[0], answer: pair[1], level: lvl, source: "fallback" };
  }

  function treeHasOp(node, op) {
    if (!node || node.type === "num") return false;
    return node.op === op || treeHasOp(node.l, op) || treeHasOp(node.r, op);
  }

  /**
   * Generate one problem at `level` (1–5), Dedovic-style difficulty.
   * L1 two numbers +/−; L2 three numbers +/−; L3 includes ×; L4 includes ÷;
   * L5 four numbers with mixed ops and parentheses. Answer is always 0–9.
   */
  function generateProblem(level, rng) {
    const rnd = rng || Math.random;
    const lvl = clamp(level | 0, 1, 5);
    const specs = {
      1: { nOps: 1, allowMulDiv: false, requireMul: false, requireDiv: false, numMin: 1, numMax: 9 },
      2: { nOps: 2, allowMulDiv: false, requireMul: false, requireDiv: false, numMin: 1, numMax: 24 },
      3: { nOps: 2, allowMulDiv: true,  requireMul: true,  requireDiv: false, numMin: 2, numMax: 40 },
      4: { nOpsMin: 2, nOpsMax: 3, allowMulDiv: true,  requireMul: false, requireDiv: true,  numMin: 2, numMax: 72 },
      5: { nOpsMin: 3, nOpsMax: 3, allowMulDiv: true, requireMul: false, requireDiv: false, preferMixed: true, numMin: 3, numMax: 99 },
    };
    const s = specs[lvl];
    for (let attempt = 0; attempt < 50; attempt++) {
      const ans = rngInt(rnd, 0, 9);
      const nOps = s.nOps != null ? s.nOps : rngInt(rnd, s.nOpsMin, s.nOpsMax);
      // For L3/L4 bias invertOptions toward required ops by temporarily forcing allowMulDiv
      const tree = buildTree(ans, nOps, rnd, s.numMin, s.numMax, !!s.allowMulDiv);
      if (!tree || tree.type !== "op") continue;
      const val = evalNode(tree);
      if (val !== ans || !Number.isInteger(val) || val < 0 || val > 9) continue;
      const nums = leafValues(tree, []);
      if (nums.some((n) => n < 0 || n > 99 || !Number.isInteger(n))) continue;
      if (opCount(tree) < 1) continue;
      if (s.requireMul && !treeHasOp(tree, "×")) continue;
      if (s.requireDiv && !treeHasOp(tree, "÷")) continue;
      if (s.preferMixed) {
        const ops = [];
        (function collect(n) {
          if (!n || n.type === "num") return;
          ops.push(n.op); collect(n.l); collect(n.r);
        })(tree);
        const uniq = new Set(ops);
        if (uniq.size < 2) continue; // want mixed ops at L5
        if (!treeHasOp(tree, "×") && !treeHasOp(tree, "÷")) continue;
        if (nums.length < 4) continue;
      }
      if (lvl === 1 && treeHasOp(tree, "×")) continue;
      if (lvl === 1 && treeHasOp(tree, "÷")) continue;
      if (lvl === 2 && (treeHasOp(tree, "×") || treeHasOp(tree, "÷"))) continue;
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
        activeSkip = null;
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown", onKey);
        const duration_ms = Math.round(performance.now() - t0);
        onEvent && onEvent("prep_offset", { variant: C.variant, skipped: skipped ? 1 : 0, duration_ms });
        resolve({ config: C, variant: C.variant, skipped: !!skipped, duration_ms, wordingVersion: C.wordingVersion });
      };
      const onKey = (e) => { if (isAdminEscape(e)) finish(true); };
      activeSkip = () => finish(true);
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
        activeSkip = null;
        clearTimeout(timer); cancelAnimationFrame(raf);
        onEvent && onEvent("stress_task_end", { nCorrect, nWrong, nTimeout, nRestarts });
        resolve({ config: C, responses, summary: { n_responses: responses.length, n_correct: nCorrect, n_wrong: nWrong,
          n_timeout: nTimeout, n_restarts: nRestarts, lowest_number_reached: best, final_limit_ms: Math.round(limit),
          duration_ms: Math.round(performance.now() - t0) } });
      };
      activeSkip = () => finish();
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
        activeSkip = null;
        cancelAnimationFrame(raf);
        onEvent && onEvent("end_math_end", { nCorrect, nWrong, n_responses: responses.length });
        resolve({ config: C, responses, summary: { n_responses: responses.length, n_correct: nCorrect, n_wrong: nWrong,
          n_timeout: 0, n_restarts: 0, lowest_number_reached: best,
          duration_ms: Math.round(performance.now() - t0) } });
      };
      activeSkip = () => finish();
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

  function levelFloorMs(level, C) {
    const floors = C.LEVEL_FLOOR_MS || {};
    const sensible = floors[clamp(level | 0, 1, 5)] || 2500;
    const factor = C.LEVEL_FLOOR_FACTOR == null ? 1.5 : C.LEVEL_FLOOR_FACTOR;
    return Math.max(C.LIMIT_MIN_MS, Math.round(sensible * factor));
  }

  function clampLimit(ms, level, C) {
    const lo = levelFloorMs(level, C);
    return clamp(Math.round(ms), lo, C.LIMIT_MAX_MS);
  }

  function initialLimit(state, C) {
    const base = (state && state.practiceRtMs) || C.DEFAULT_MEAN_RT_MS;
    const level = (state && state.lastLevel) || C.START_LEVEL;
    return clampLimit(base * C.LIMIT_FACTOR, level, C);
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
        activeSkip = null;
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
            if (level < C.MAX_LEVEL) level += 1;
            limit = clampLimit(limit * C.ADAPT_DOWN, level, C);
            streakOk = 0;
          }
        } else {
          streakBad++; streakOk = 0;
          if (streakBad >= C.ADAPT_ERROR_STREAK) {
            if (level > C.MIN_LEVEL) level -= 1;
            limit = clampLimit(limit * C.ADAPT_UP, level, C);
            streakBad = 0;
          }
        }
        const acc = recentAcc();
        if (acc != null && responses.length >= 4) {
          if (acc > C.ACC_HIGH) {
            if (level < C.MAX_LEVEL) level = Math.min(C.MAX_LEVEL, level + 1);
            limit = clampLimit(limit * C.ACC_TIGHTEN, level, C);
          } else if (acc < C.ACC_LOW) {
            if (level > C.MIN_LEVEL) level = Math.max(C.MIN_LEVEL, level - 1);
            limit = clampLimit(limit * C.ACC_LOOSEN, level, C);
          }
        }
        // Always re-apply the level floor after level changes
        limit = clampLimit(limit, level, C);
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
        if (isAdminEscape(e)) {
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
      activeSkip = () => finish(true, "skipped");
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

  /* ========================================================================
   * DST-style math stress block (v4.7)
   *
   * Adapted from the published Digital Stress Test Math-Task
   * (Norden et al., 2022, J Med Internet Res 24(7):e32280) and the
   * study memo in /workspace/stress_review/stress_papers_review.md.
   *
   * From the paper (used as specified):
   *   - 90 s block; duration is not shown to the participant
   *   - two-number + − × ÷ problems, operands 1–99, answers 1–99
   *   - 3 s per-item limit (the paper's starting value for the DST, here
   *     held fixed for everyone: no ±10% adaptation, no keypad shuffle)
   *   - fake comparison average of 75%
   *   - feedback "Wrong answer!" / "Too slow!"; red cue; next item
   *     immediately after a correct answer
   *   - 3 s countdown before the block
   *   - no practice problems and no practice-based timing (Norden did not
   *     use a practice baseline; timing started at a fixed 3 s)
   *
   * Our choices (not a published item list):
   *   - two fixed lists (A, B), identical for every participant, written
   *     to match the paper's constraints. List A item 1 is 38 + 21, the
   *     only DST arithmetic example visible in Figure 1 of the paper.
   *     Every other item is ours (source: "study_list").
   *   - 20–30 s anticipatory screen, then "I'm ready", then the countdown
   *   - no camera, no speech, no random keypad, no "only serious results"
   *     line (the last per the study memo, for a student sample)
   * ======================================================================== */

  const DST_DEFAULTS = {
    DURATION_S: 90,
    LIMIT_MS: 3000,          // Norden et al.: first-item limit in the DST
    AVERAGE_PCT: 75,         // Norden et al.: fabricated comparison average
    COUNTDOWN_S: 3,          // Norden et al. / openDST CountdownBeforeTask
    ANTICIPATION_MIN_S: 20,  // grant/memo: 20–30 s anticipatory screen
    ANTICIPATION_MAX_S: 30,
    FEEDBACK_WRONG_MS: 1000, // openDST: 1000 ms on wrong / too slow
    FEEDBACK_CORRECT_MS: 50, // openDST: 50 ms, then next item
    MISSING_STREAK: 5,       // paper: reminder after 5 consecutive non-responses
    // Paper then swaps in an easy summation. We keep the fixed list and
    // only show the reminder, so every participant still sees the same items.
  };

  const DST_COPY = {
    first: {
      title: "Short performance check",
      html: `<p>You will now complete a short, timed arithmetic test. It is used as a brief check of performance under time pressure, of the kind people often feel before a test or presentation.</p>
        <p>You will have only a few seconds for each problem. Your accuracy will be compared with the average of other participants in this study.</p>
        <p>Enter each answer with the number keys or the keypad. Please sit still, get ready, and start when you are prepared.</p>`,
    },
    second: {
      title: "Short performance check",
      html: `<p>You will now complete a second short, timed arithmetic test. As before, this is a brief check of performance under time pressure, and your accuracy will also be compared with the average of other participants in this study.</p>
        <p>You will have only a few seconds for each problem. Enter each answer with the number keys or the keypad.</p>
        <p>Please sit still, get ready, and start when you are prepared.</p>`,
    },
    ready: "I’m ready",
    wait: "The start button will be available in {n} seconds.",
    countdownLabel: "Get ready",
    taskTitle: "Timed arithmetic",
    hint: "Enter your answer with the number keys or the keypad.",
    yourPerf: "You",
    avgPerf: "Average",
    wrong: "Wrong answer!",
    slow: "Too slow!",
    missing: "Please try to answer the question. Your participation is important for this study.",
  };


  const DST_LISTS = {
    A: [
      { a: 38, b: 21, expr: "38 + 21", answer: 59, op: "+", d: 2, source: "norden_fig1" },
      { a: 2, b: 20, expr: "2 × 20", answer: 40, op: "×", d: 0, source: "study_list" },
      { a: 35, b: 5, expr: "35 − 5", answer: 30, op: "−", d: 0, source: "study_list" },
      { a: 45, b: 5, expr: "45 ÷ 5", answer: 9, op: "÷", d: 1, source: "study_list" },
      { a: 17, b: 57, expr: "17 + 57", answer: 74, op: "+", d: 3, source: "study_list" },
      { a: 2, b: 45, expr: "2 × 45", answer: 90, op: "×", d: 0, source: "study_list" },
      { a: 39, b: 9, expr: "39 − 9", answer: 30, op: "−", d: 0, source: "study_list" },
      { a: 66, b: 2, expr: "66 ÷ 2", answer: 33, op: "÷", d: 0, source: "study_list" },
      { a: 26, b: 40, expr: "26 + 40", answer: 66, op: "+", d: 2, source: "study_list" },
      { a: 16, b: 2, expr: "16 × 2", answer: 32, op: "×", d: 0, source: "study_list" },
      { a: 26, b: 9, expr: "26 − 9", answer: 17, op: "−", d: 1, source: "study_list" },
      { a: 84, b: 6, expr: "84 ÷ 6", answer: 14, op: "÷", d: 3, source: "study_list" },
      { a: 7, b: 78, expr: "7 + 78", answer: 85, op: "+", d: 1, source: "study_list" },
      { a: 3, b: 9, expr: "3 × 9", answer: 27, op: "×", d: 1, source: "study_list" },
      { a: 58, b: 15, expr: "58 − 15", answer: 43, op: "−", d: 2, source: "study_list" },
      { a: 40, b: 5, expr: "40 ÷ 5", answer: 8, op: "÷", d: 1, source: "study_list" },
      { a: 38, b: 56, expr: "38 + 56", answer: 94, op: "+", d: 3, source: "study_list" },
      { a: 5, b: 4, expr: "5 × 4", answer: 20, op: "×", d: 1, source: "study_list" },
      { a: 61, b: 55, expr: "61 − 55", answer: 6, op: "−", d: 3, source: "study_list" },
      { a: 66, b: 6, expr: "66 ÷ 6", answer: 11, op: "÷", d: 3, source: "study_list" },
      { a: 15, b: 30, expr: "15 + 30", answer: 45, op: "+", d: 2, source: "study_list" },
      { a: 9, b: 5, expr: "9 × 5", answer: 45, op: "×", d: 1, source: "study_list" },
      { a: 90, b: 51, expr: "90 − 51", answer: 39, op: "−", d: 3, source: "study_list" },
      { a: 90, b: 10, expr: "90 ÷ 10", answer: 9, op: "÷", d: 0, source: "study_list" },
      { a: 34, b: 4, expr: "34 + 4", answer: 38, op: "+", d: 0, source: "study_list" },
      { a: 4, b: 19, expr: "4 × 19", answer: 76, op: "×", d: 2, source: "study_list" },
      { a: 52, b: 6, expr: "52 − 6", answer: 46, op: "−", d: 1, source: "study_list" },
      { a: 20, b: 5, expr: "20 ÷ 5", answer: 4, op: "÷", d: 1, source: "study_list" },
      { a: 70, b: 9, expr: "70 + 9", answer: 79, op: "+", d: 0, source: "study_list" },
      { a: 3, b: 28, expr: "3 × 28", answer: 84, op: "×", d: 2, source: "study_list" },
      { a: 61, b: 35, expr: "61 − 35", answer: 26, op: "−", d: 3, source: "study_list" },
      { a: 70, b: 5, expr: "70 ÷ 5", answer: 14, op: "÷", d: 2, source: "study_list" },
      { a: 34, b: 26, expr: "34 + 26", answer: 60, op: "+", d: 3, source: "study_list" },
      { a: 7, b: 11, expr: "7 × 11", answer: 77, op: "×", d: 3, source: "study_list" },
      { a: 73, b: 39, expr: "73 − 39", answer: 34, op: "−", d: 3, source: "study_list" },
      { a: 98, b: 7, expr: "98 ÷ 7", answer: 14, op: "÷", d: 3, source: "study_list" },
      { a: 43, b: 19, expr: "43 + 19", answer: 62, op: "+", d: 3, source: "study_list" },
      { a: 6, b: 13, expr: "6 × 13", answer: 78, op: "×", d: 3, source: "study_list" },
      { a: 79, b: 8, expr: "79 − 8", answer: 71, op: "−", d: 0, source: "study_list" },
      { a: 75, b: 15, expr: "75 ÷ 15", answer: 5, op: "÷", d: 2, source: "study_list" },
      { a: 5, b: 82, expr: "5 + 82", answer: 87, op: "+", d: 0, source: "study_list" },
      { a: 9, b: 11, expr: "9 × 11", answer: 99, op: "×", d: 3, source: "study_list" },
      { a: 41, b: 30, expr: "41 − 30", answer: 11, op: "−", d: 2, source: "study_list" },
      { a: 65, b: 5, expr: "65 ÷ 5", answer: 13, op: "÷", d: 2, source: "study_list" },
      { a: 33, b: 45, expr: "33 + 45", answer: 78, op: "+", d: 2, source: "study_list" },
      { a: 29, b: 3, expr: "29 × 3", answer: 87, op: "×", d: 2, source: "study_list" },
      { a: 84, b: 45, expr: "84 − 45", answer: 39, op: "−", d: 3, source: "study_list" },
      { a: 24, b: 4, expr: "24 ÷ 4", answer: 6, op: "÷", d: 1, source: "study_list" },
      { a: 35, b: 6, expr: "35 + 6", answer: 41, op: "+", d: 1, source: "study_list" },
      { a: 6, b: 11, expr: "6 × 11", answer: 66, op: "×", d: 3, source: "study_list" },
      { a: 64, b: 60, expr: "64 − 60", answer: 4, op: "−", d: 2, source: "study_list" },
      { a: 78, b: 6, expr: "78 ÷ 6", answer: 13, op: "÷", d: 3, source: "study_list" },
      { a: 69, b: 11, expr: "69 + 11", answer: 80, op: "+", d: 3, source: "study_list" },
      { a: 4, b: 16, expr: "4 × 16", answer: 64, op: "×", d: 2, source: "study_list" },
      { a: 93, b: 8, expr: "93 − 8", answer: 85, op: "−", d: 1, source: "study_list" },
      { a: 28, b: 7, expr: "28 ÷ 7", answer: 4, op: "÷", d: 2, source: "study_list" },
      { a: 47, b: 4, expr: "47 + 4", answer: 51, op: "+", d: 1, source: "study_list" },
      { a: 7, b: 4, expr: "7 × 4", answer: 28, op: "×", d: 1, source: "study_list" },
      { a: 83, b: 60, expr: "83 − 60", answer: 23, op: "−", d: 2, source: "study_list" },
      { a: 94, b: 2, expr: "94 ÷ 2", answer: 47, op: "÷", d: 0, source: "study_list" },
    ],
    B: [
      { a: 18, b: 31, expr: "18 + 31", answer: 49, op: "+", d: 2, source: "study_list" },
      { a: 25, b: 2, expr: "25 × 2", answer: 50, op: "×", d: 0, source: "study_list" },
      { a: 29, b: 5, expr: "29 − 5", answer: 24, op: "−", d: 0, source: "study_list" },
      { a: 28, b: 4, expr: "28 ÷ 4", answer: 7, op: "÷", d: 1, source: "study_list" },
      { a: 27, b: 24, expr: "27 + 24", answer: 51, op: "+", d: 3, source: "study_list" },
      { a: 14, b: 2, expr: "14 × 2", answer: 28, op: "×", d: 0, source: "study_list" },
      { a: 68, b: 5, expr: "68 − 5", answer: 63, op: "−", d: 0, source: "study_list" },
      { a: 60, b: 10, expr: "60 ÷ 10", answer: 6, op: "÷", d: 0, source: "study_list" },
      { a: 19, b: 80, expr: "19 + 80", answer: 99, op: "+", d: 2, source: "study_list" },
      { a: 19, b: 2, expr: "19 × 2", answer: 38, op: "×", d: 0, source: "study_list" },
      { a: 73, b: 6, expr: "73 − 6", answer: 67, op: "−", d: 1, source: "study_list" },
      { a: 77, b: 7, expr: "77 ÷ 7", answer: 11, op: "÷", d: 3, source: "study_list" },
      { a: 4, b: 26, expr: "4 + 26", answer: 30, op: "+", d: 1, source: "study_list" },
      { a: 6, b: 5, expr: "6 × 5", answer: 30, op: "×", d: 1, source: "study_list" },
      { a: 58, b: 41, expr: "58 − 41", answer: 17, op: "−", d: 2, source: "study_list" },
      { a: 40, b: 4, expr: "40 ÷ 4", answer: 10, op: "÷", d: 1, source: "study_list" },
      { a: 22, b: 59, expr: "22 + 59", answer: 81, op: "+", d: 3, source: "study_list" },
      { a: 3, b: 7, expr: "3 × 7", answer: 21, op: "×", d: 1, source: "study_list" },
      { a: 66, b: 48, expr: "66 − 48", answer: 18, op: "−", d: 3, source: "study_list" },
      { a: 91, b: 7, expr: "91 ÷ 7", answer: 13, op: "÷", d: 3, source: "study_list" },
      { a: 23, b: 50, expr: "23 + 50", answer: 73, op: "+", d: 2, source: "study_list" },
      { a: 3, b: 4, expr: "3 × 4", answer: 12, op: "×", d: 1, source: "study_list" },
      { a: 93, b: 17, expr: "93 − 17", answer: 76, op: "−", d: 3, source: "study_list" },
      { a: 72, b: 2, expr: "72 ÷ 2", answer: 36, op: "÷", d: 0, source: "study_list" },
      { a: 7, b: 51, expr: "7 + 51", answer: 58, op: "+", d: 0, source: "study_list" },
      { a: 3, b: 19, expr: "3 × 19", answer: 57, op: "×", d: 2, source: "study_list" },
      { a: 50, b: 7, expr: "50 − 7", answer: 43, op: "−", d: 1, source: "study_list" },
      { a: 24, b: 3, expr: "24 ÷ 3", answer: 8, op: "÷", d: 1, source: "study_list" },
      { a: 5, b: 40, expr: "5 + 40", answer: 45, op: "+", d: 0, source: "study_list" },
      { a: 3, b: 22, expr: "3 × 22", answer: 66, op: "×", d: 2, source: "study_list" },
      { a: 90, b: 66, expr: "90 − 66", answer: 24, op: "−", d: 3, source: "study_list" },
      { a: 48, b: 4, expr: "48 ÷ 4", answer: 12, op: "÷", d: 2, source: "study_list" },
      { a: 46, b: 15, expr: "46 + 15", answer: 61, op: "+", d: 3, source: "study_list" },
      { a: 8, b: 11, expr: "8 × 11", answer: 88, op: "×", d: 3, source: "study_list" },
      { a: 38, b: 19, expr: "38 − 19", answer: 19, op: "−", d: 3, source: "study_list" },
      { a: 88, b: 8, expr: "88 ÷ 8", answer: 11, op: "÷", d: 3, source: "study_list" },
      { a: 45, b: 48, expr: "45 + 48", answer: 93, op: "+", d: 3, source: "study_list" },
      { a: 7, b: 14, expr: "7 × 14", answer: 98, op: "×", d: 3, source: "study_list" },
      { a: 97, b: 6, expr: "97 − 6", answer: 91, op: "−", d: 0, source: "study_list" },
      { a: 60, b: 30, expr: "60 ÷ 30", answer: 2, op: "÷", d: 2, source: "study_list" },
      { a: 4, b: 44, expr: "4 + 44", answer: 48, op: "+", d: 0, source: "study_list" },
      { a: 12, b: 6, expr: "12 × 6", answer: 72, op: "×", d: 3, source: "study_list" },
      { a: 66, b: 22, expr: "66 − 22", answer: 44, op: "−", d: 2, source: "study_list" },
      { a: 87, b: 3, expr: "87 ÷ 3", answer: 29, op: "÷", d: 2, source: "study_list" },
      { a: 62, b: 33, expr: "62 + 33", answer: 95, op: "+", d: 2, source: "study_list" },
      { a: 3, b: 17, expr: "3 × 17", answer: 51, op: "×", d: 2, source: "study_list" },
      { a: 62, b: 45, expr: "62 − 45", answer: 17, op: "−", d: 3, source: "study_list" },
      { a: 20, b: 4, expr: "20 ÷ 4", answer: 5, op: "÷", d: 1, source: "study_list" },
      { a: 6, b: 34, expr: "6 + 34", answer: 40, op: "+", d: 1, source: "study_list" },
      { a: 6, b: 15, expr: "6 × 15", answer: 90, op: "×", d: 3, source: "study_list" },
      { a: 47, b: 21, expr: "47 − 21", answer: 26, op: "−", d: 2, source: "study_list" },
      { a: 96, b: 8, expr: "96 ÷ 8", answer: 12, op: "÷", d: 3, source: "study_list" },
      { a: 25, b: 45, expr: "25 + 45", answer: 70, op: "+", d: 3, source: "study_list" },
      { a: 3, b: 11, expr: "3 × 11", answer: 33, op: "×", d: 2, source: "study_list" },
      { a: 56, b: 9, expr: "56 − 9", answer: 47, op: "−", d: 1, source: "study_list" },
      { a: 28, b: 14, expr: "28 ÷ 14", answer: 2, op: "÷", d: 2, source: "study_list" },
      { a: 19, b: 7, expr: "19 + 7", answer: 26, op: "+", d: 1, source: "study_list" },
      { a: 5, b: 10, expr: "5 × 10", answer: 50, op: "×", d: 1, source: "study_list" },
      { a: 96, b: 23, expr: "96 − 23", answer: 73, op: "−", d: 2, source: "study_list" },
      { a: 70, b: 10, expr: "70 ÷ 10", answer: 7, op: "÷", d: 0, source: "study_list" },
    ],
  };


  function dstPadHtml() {
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    return `<div class="dst-pad" role="group" aria-label="Number keypad">` +
      keys.map((d) => `<button type="button" class="dst-pad-btn" data-digit="${d}" aria-label="Digit ${d}">${d}</button>`).join("") +
      `</div>`;
  }

  function dstEnsureFlash() {
    let el = document.getElementById("dst-flash");
    if (!el) {
      el = document.createElement("div");
      el.id = "dst-flash";
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
    }
    return el;
  }

  function dstFlash(on) {
    const el = dstEnsureFlash();
    el.classList.toggle("on", !!on);
  }

  function dstAnswerSlots(answer, typed) {
    const n = String(answer).length;
    const chars = String(typed || "");
    let html = "";
    for (let i = 0; i < n; i++) {
      const ch = i < chars.length ? chars[i] : "";
      html += `<span class="dst-slot${ch ? " filled" : ""}">${ch || "&nbsp;"}</span>`;
    }
    return html;
  }

  function runDstAnticipation(host, cfg, onEvent) {
    const C = Object.assign({}, DST_DEFAULTS, cfg || {});
    const variant = C.variant === "second" ? "second" : "first";
    const copy = DST_COPY[variant];
    const minS = C.ANTICIPATION_MIN_S;
    const maxS = C.ANTICIPATION_MAX_S;
    return new Promise((resolve) => {
      host.innerHTML = `<div class="dst dst-anticipation" data-dst-variant="${variant}">
        <p class="dst-kicker">Performance check</p>
        <h2 class="dst-title">${copy.title}</h2>
        <div class="dst-copy">${copy.html}</div>
        <p class="dst-wait" id="dst-wait"></p>
        <div class="btn-row">
          <button type="button" class="dst-ready" id="dst-ready" disabled>${DST_COPY.ready}</button>
        </div>
        <p class="exp-note draft-note" hidden>DRAFT wording (${C.wordingVersion || WORDING_VERSION}). Experimenter: Esc skips.</p>
      </div>`;
      if (document.body.classList.contains("debug")) {
        const n = host.querySelector(".draft-note");
        if (n) n.hidden = false;
      }
      const btn = host.querySelector("#dst-ready");
      const wait = host.querySelector("#dst-wait");
      const t0 = performance.now();
      let done = false;
      let raf = null;

      const finish = (reason) => {
        if (done) return;
        done = true;
        activeSkip = null;
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown", onKey, true);
        dstFlash(false);
        const duration_ms = Math.round(performance.now() - t0);
        const result = { variant: variant, reason: reason, duration_ms: duration_ms, min_s: minS, max_s: maxS };
        onEvent && onEvent("dst_anticipation_end", result);
        resolve(result);
      };

      const onKey = (e) => {
        if (isAdminEscape(e)) { e.preventDefault(); finish("skipped"); }
      };

      const tick = (now) => {
        if (done) return;
        const elapsed = (now - t0) / 1000;
        const leftMin = Math.max(0, Math.ceil(minS - elapsed));
        if (elapsed >= minS) {
          if (btn.disabled) {
            btn.disabled = false;
            if (wait) wait.textContent = "";
          }
        } else if (wait) {
          wait.textContent = DST_COPY.wait.replace("{n}", String(leftMin));
        }
        if (elapsed >= maxS) { finish("auto"); return; }
        raf = requestAnimationFrame(tick);
      };

      btn.addEventListener("click", () => finish("ready"));
      document.addEventListener("keydown", onKey, true);
      activeSkip = () => finish("skipped");
      onEvent && onEvent("dst_anticipation_start", { variant: variant, min_s: minS, max_s: maxS, wordingVersion: C.wordingVersion || WORDING_VERSION });
      raf = requestAnimationFrame(tick);
    });
  }

  function runDstCountdown(host, cfg, onEvent) {
    const C = Object.assign({}, DST_DEFAULTS, cfg || {});
    const total = Math.max(1, C.COUNTDOWN_S | 0);
    return new Promise((resolve) => {
      host.innerHTML = `<div class="dst dst-countdown">
        <p class="dst-kicker">${DST_COPY.countdownLabel}</p>
        <div class="dst-count-num" id="dst-count-num" aria-live="assertive">${total}</div>
      </div>`;
      const el = host.querySelector("#dst-count-num");
      const t0 = performance.now();
      let remaining = total;
      let done = false;
      let iv = null;
      const finish = (reason) => {
        if (done) return;
        done = true;
        activeSkip = null;
        clearInterval(iv);
        document.removeEventListener("keydown", onKey, true);
        onEvent && onEvent("dst_countdown_end", { reason: reason, duration_ms: Math.round(performance.now() - t0) });
        resolve({ reason: reason, duration_ms: Math.round(performance.now() - t0) });
      };
      const onKey = (e) => { if (isAdminEscape(e)) { e.preventDefault(); finish("skipped"); } };
      document.addEventListener("keydown", onKey, true);
      activeSkip = () => finish("skipped");
      onEvent && onEvent("dst_countdown_start", { seconds: total });
      iv = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) { finish("completed"); return; }
        if (el) el.textContent = String(remaining);
      }, 1000);
    });
  }

  function runDst(host, cfg, onEvent) {
    const C = Object.assign({}, DST_DEFAULTS, cfg || {});
    const variant = C.variant === "second" ? "second" : "first";
    const listId = C.listId || (variant === "second" ? "B" : "A");
    const list = (C.list && C.list.length ? C.list : (DST_LISTS[listId] || DST_LISTS.A)).map(function (it, i) {
      return Object.assign({ idx: i + 1 }, it);
    });
    const limitMs = Math.max(500, C.LIMIT_MS | 0);
    const durationS = Math.max(1, C.DURATION_S | 0);
    const avgPct = clamp(C.AVERAGE_PCT, 0, 100);

    return new Promise((resolve) => {
      host.innerHTML = `<div class="dst dst-task" data-dst-variant="${variant}" data-dst-list="${listId}">
        <div class="dst-top">
          <p class="dst-kicker">${DST_COPY.taskTitle}</p>
          <span id="dst-clock" class="dst-clock" hidden></span>
        </div>
        <div class="dst-perf" id="dst-perf">
          <div class="dst-bar-row">
            <span class="dst-bar-lab">${DST_COPY.yourPerf}</span>
            <div class="dst-bar-track" role="img" id="dst-you-track" aria-label="Your accuracy">
              <div class="dst-bar-fill dst-bar-you" id="dst-you" style="width:0%"></div>
            </div>
            <span class="dst-bar-pct" id="dst-you-pct">0%</span>
          </div>
          <div class="dst-bar-row">
            <span class="dst-bar-lab">${DST_COPY.avgPerf}</span>
            <div class="dst-bar-track" role="img" aria-label="Average ${avgPct} percent">
              <div class="dst-bar-fill dst-bar-avg" id="dst-avg" style="width:${avgPct}%"></div>
            </div>
            <span class="dst-bar-pct">${avgPct}%</span>
          </div>
        </div>
        <div class="dst-problem-wrap">
          <div class="dst-problem" id="dst-problem" aria-live="polite">&nbsp;</div>
          <div class="dst-equals">=</div>
          <div class="dst-answer" id="dst-answer" aria-live="polite"></div>
        </div>
        <div class="dst-timer" id="dst-timer" aria-hidden="true">
          <div class="dst-timer-fill" id="dst-timer-fill"></div>
        </div>
        <div class="dst-fb" id="dst-fb">&nbsp;</div>
        <div class="dst-missing" id="dst-missing" hidden><p>${DST_COPY.missing}</p></div>
        ${dstPadHtml()}
        <p class="hint dst-hint">${DST_COPY.hint}</p>
        <p class="exp-note draft-note" hidden>DRAFT wording (${C.wordingVersion || WORDING_VERSION}). Experimenter: Esc skips this segment.</p>
      </div>`;
      if (document.body.classList.contains("debug") || document.body.classList.contains("admin")) {
        const n = host.querySelector(".draft-note");
        if (n && document.body.classList.contains("debug")) n.hidden = false;
        const clock = host.querySelector("#dst-clock");
        if (clock && document.body.classList.contains("admin")) clock.hidden = false;
      }

      const elProb = host.querySelector("#dst-problem");
      const elAns = host.querySelector("#dst-answer");
      const elFb = host.querySelector("#dst-fb");
      const elFill = host.querySelector("#dst-timer-fill");
      const elYou = host.querySelector("#dst-you");
      const elYouPct = host.querySelector("#dst-you-pct");
      const elYouTrack = host.querySelector("#dst-you-track");
      const elClock = host.querySelector("#dst-clock");
      const elMissing = host.querySelector("#dst-missing");
      const buttons = Array.from(host.querySelectorAll(".dst-pad-btn"));

      const t0 = performance.now();
      const responses = [];
      let nCorrect = 0, nWrong = 0, nTimeout = 0;
      let itemOnset = 0, timer = null, raf = null, locked = false, done = false;
      let current = null, currentIndex = 0, typed = "";
      let noAnswerStreak = 0;
      let itemTimerStart = 0;

      const yourPct = () => {
        const n = responses.length;
        return n ? (100 * nCorrect) / n : 0;
      };
      const updateBar = () => {
        const p = yourPct();
        if (elYou) elYou.style.width = p.toFixed(1) + "%";
        if (elYouPct) elYouPct.textContent = Math.round(p) + "%";
        if (elYouTrack) elYouTrack.setAttribute("aria-label", `Your accuracy ${Math.round(p)} percent, average ${avgPct} percent`);
      };
      const setPadEnabled = (on) => { buttons.forEach((b) => { b.disabled = !on; }); };
      const renderAnswer = () => {
        if (!current) { elAns.innerHTML = ""; return; }
        elAns.innerHTML = dstAnswerSlots(current.answer, typed);
      };

      const finish = (skipped, reason) => {
        if (done) return;
        done = true;
        activeSkip = null;
        clearTimeout(timer);
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown", onKey, true);
        dstFlash(false);
        const duration_ms = Math.round(performance.now() - t0);
        const summary = {
          phase: "experimental",
          variant: variant,
          list_id: listId,
          skipped: skipped ? 1 : 0,
          reason: reason || (skipped ? "skipped" : "completed"),
          n_responses: responses.length,
          n_correct: nCorrect,
          n_wrong: nWrong,
          n_timeout: nTimeout,
          pct_correct: responses.length ? Math.round(1000 * nCorrect / responses.length) / 10 : 0,
          average_marker_pct: avgPct,
          your_pct: responses.length ? Math.round(10 * yourPct()) / 10 : 0,
          limit_ms: limitMs,
          duration_s: durationS,
          duration_ms: duration_ms,
          wordingVersion: C.wordingVersion || WORDING_VERSION,
          protocol: "dst_norden_2022",
        };
        onEvent && onEvent("dst_offset", { variant: variant, list_id: listId, skipped: skipped ? 1 : 0, summary: summary });
        resolve({
          config: { DURATION_S: durationS, LIMIT_MS: limitMs, AVERAGE_PCT: avgPct, listId: listId },
          phase: "experimental",
          variant: variant,
          list_id: listId,
          skipped: !!skipped,
          responses: responses,
          summary: summary,
        });
      };

      const respond = (kind, givenStr) => {
        if (locked || done || !current) return;
        locked = true;
        clearTimeout(timer);
        const now = performance.now();
        const timeout = kind === "timeout" || kind === "block_end";
        const given = timeout ? (givenStr || typed || "") : String(givenStr);
        const correct = !timeout && given !== "" && Number(given) === current.answer;
        let feedback;
        if (correct) feedback = "correct";
        else if (timeout) feedback = DST_COPY.slow;
        else feedback = DST_COPY.wrong;
        if (correct) { nCorrect++; noAnswerStreak = 0; }
        else if (timeout) { nTimeout++; noAnswerStreak++; }
        else { nWrong++; noAnswerStreak = 0; }

        const row = {
          idx: responses.length + 1,
          task: "dst",
          phase: "experimental",
          variant: variant,
          list_id: listId,
          item_index: current.idx,
          problem: current.expr,
          operand_a: current.a,
          operand_b: current.b,
          operator: current.op,
          source: current.source || "study_list",
          expected: current.answer,
          given: given,
          correct: correct ? 1 : 0,
          timeout: timeout ? 1 : 0,
          feedback: feedback,
          rt_ms: Math.round(now - itemOnset),
          limit_ms: limitMs,
          cutoff_reason: kind === "block_end" ? "block_end" : (timeout ? "item_limit" : ""),
          onset_perf: +itemOnset.toFixed(1),
          response_perf: +now.toFixed(1),
          elapsed_ms: Math.round(now - t0),
          timestamp: new Date().toISOString(),
          average_marker: avgPct,
          your_pct: "",
        };
        responses.push(row);
        row.your_pct = Math.round(10 * yourPct()) / 10;
        updateBar();
        const card = host.querySelector(".dst");
        if (correct) {
          elFb.textContent = "";
          elFb.className = "dst-fb";
          dstFlash(false);
          if (card) card.classList.remove("is-bad");
        } else {
          elFb.textContent = feedback;
          elFb.className = "dst-fb bad";
          dstFlash(true);
          if (card) card.classList.add("is-bad");
        }
        setPadEnabled(false);
        onEvent && onEvent("dst_response", {
          variant: variant, list_id: listId, correct: row.correct, timeout: row.timeout,
          rt_ms: row.rt_ms, feedback: feedback, problem: current.expr, given: given,
        });

        const wait = correct ? C.FEEDBACK_CORRECT_MS : C.FEEDBACK_WRONG_MS;
        const afterFb = () => {
          dstFlash(false);
          const card = host.querySelector(".dst");
          if (card) card.classList.remove("is-bad");
          if (done) return;
          if (kind === "block_end") { finish(false, "completed"); return; }
          nextItem();
        };
        if (wait <= 0) afterFb();
        else setTimeout(afterFb, wait);
      };

      const nextItem = () => {
        if (done) return;
        const used = performance.now() - t0;
        if (used >= durationS * 1000) { finish(false, "completed"); return; }
        if (currentIndex >= list.length) { finish(false, "list_exhausted"); return; }
        locked = false;
        typed = "";
        elFb.textContent = "\u00a0";
        elFb.className = "dst-fb";
        dstFlash(false);
        if (elMissing) {
          const showRem = noAnswerStreak >= C.MISSING_STREAK;
          elMissing.hidden = !showRem;
        }
        current = list[currentIndex];
        currentIndex += 1;
        if (elProb) elProb.textContent = current.expr;
        renderAnswer();
        setPadEnabled(true);
        itemOnset = performance.now();
        itemTimerStart = itemOnset;
        if (elFill) elFill.style.width = "100%";
        clearTimeout(timer);
        const remainBlock = durationS * 1000 - (itemOnset - t0);
        const thisLimit = Math.max(0, Math.min(limitMs, remainBlock));
        timer = setTimeout(() => {
          if (remainBlock <= limitMs + 16 && (performance.now() - t0) >= durationS * 1000 - 30) {
            respond("block_end", typed);
          } else {
            respond("timeout", typed);
          }
        }, thisLimit);
        onEvent && onEvent("dst_item_onset", {
          variant: variant, list_id: listId, idx: responses.length + 1,
          item_index: current.idx, problem: current.expr, limit_ms: thisLimit,
          source: current.source || "study_list",
        });
      };

      const tick = (now) => {
        if (done) return;
        const left = durationS * 1000 - (now - t0);
        if (elClock && !elClock.hidden) elClock.textContent = fmtClock(left);
        if (!locked && current && elFill) {
          const frac = Math.max(0, 1 - (now - itemTimerStart) / limitMs);
          elFill.style.width = (100 * frac) + "%";
        }
        if (left <= 0 && !locked) {
          if (current && typed === "") { respond("block_end", ""); return; }
          if (current) { respond("block_end", typed); return; }
          finish(false, "completed");
          return;
        }
        raf = requestAnimationFrame(tick);
      };

      const acceptDigit = (d) => {
        if (locked || done || !current) return;
        const next = typed + String(d);
        const need = String(current.answer).length;
        typed = next.slice(0, need);
        renderAnswer();
        if (typed.length >= need) respond("answer", typed);
      };

      const onKey = (e) => {
        if (done) return;
        if (isAdminEscape(e)) { e.preventDefault(); finish(true, "skipped"); return; }
        if (locked) return;
        if (e.key >= "0" && e.key <= "9") {
          e.preventDefault();
          acceptDigit(e.key);
        }
      };

      buttons.forEach((b) => {
        b.addEventListener("click", () => {
          if (locked || done) return;
          acceptDigit(b.getAttribute("data-digit"));
        });
      });

      document.addEventListener("keydown", onKey, true);
      activeSkip = () => finish(true, "skipped");
      onEvent && onEvent("dst_onset", {
        variant: variant, list_id: listId, duration_s: durationS,
        limit_ms: limitMs, average_marker_pct: avgPct,
        n_items: list.length, wordingVersion: C.wordingVersion || WORDING_VERSION,
        protocol: "dst_norden_2022",
      });
      updateBar();
      lastTickSafe();
      function lastTickSafe() {
        raf = requestAnimationFrame(tick);
        nextItem();
      }
    });
  }

  function dstSummaryHtml(summary) {
    const s = summary || {};
    const you = s.your_pct == null ? 0 : s.your_pct;
    const avg = s.average_marker_pct == null ? 75 : s.average_marker_pct;
    const n = s.n_responses || 0;
    const ok = s.n_correct || 0;
    return `<p class="dst-kicker">Performance check</p>
      <h2 class="dst-title">Your results</h2>
      <p>Your accuracy: <strong>${you}%</strong> (${ok} of ${n} problems correct).</p>
      <p>Comparison average: <strong>${avg}%</strong>.</p>`;
  }

  window.WFStress = {
    run: run, runPrep: runPrep, runQuiet: runQuiet, runMist: runMist, skipCurrent: requestSkip,
    runDstAnticipation: runDstAnticipation, runDstCountdown: runDstCountdown, runDst: runDst,
    dstSummaryHtml: dstSummaryHtml, DST_LISTS: DST_LISTS, DST_DEFAULTS: DST_DEFAULTS, DST_COPY: DST_COPY,
    generateProblem: generateProblem, WORDING_VERSION: WORDING_VERSION,
    PREP_COPY: PREP_COPY, MIST_DEFAULTS: MIST_DEFAULTS, MIST_COPY: MIST_COPY,
    DEBRIEF_COPY: DEBRIEF_COPY,
  };

})();

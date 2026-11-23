/**
 * Timed arithmetic task used in the Hospital Wayfinding Study (v5.7).
 *
 * The task follows Norden et al. (2022), J Med Internet Res 24(7):e32280:
 * 90-second blocks, two-number problems (operands and answers 1–99), a starting
 * 3-second limit that adapts (×0.9 after three correct in a row, ×1.1 after
 * three wrong or timed-out in a row), a keypad that shuffles after each
 * three-correct streak, and a fixed 75% comparison average. Keyboard digits
 * are disabled; answers are entered on the on-screen keypad. A short
 * anticipation screen and countdown precede each block.
 *
 * WFStress.runDstAnticipation / runDstCountdown / runDst
 * WFStress.generateDstItems / dstSummaryHtml / DEBRIEF_COPY
 */
(function () {
  "use strict";
  let activeSkip = null;
  function requestSkip() {
    if (typeof activeSkip === "function") { activeSkip(); return true; }
    return false;
  }

  const WORDING_VERSION = "DRAFT_IRB_2026-11-11_v49";

  const DEBRIEF_COPY = {
    title: "Debriefing",
    html: `
      <p class="draft-banner"><strong>DRAFT for IRB review</strong> — debrief body pending final IRB-approved language.</p>
      <p class="irb-placeholder">[placeholder]</p>`,
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
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------------- arithmetic task ---------------- */
  const DST_DEFAULTS = {
    DURATION_S: 90,
    LIMIT_MS: 3000,          // Norden et al.: first item 3 s, then adaptive
    LIMIT_MIN_MS: 1000,      // safety floor / ceiling for the adaptive limit (not in the paper)
    LIMIT_MAX_MS: 10000,
    ADAPT_N: 3,              // 3 consecutive correct -> x0.9; 3 consecutive wrong/timeout -> x1.1
    ADAPT_FAST: 0.9,
    ADAPT_SLOW: 1.1,
    SHUFFLE_ITEMS: 4,        // keypad digits shuffled for the 4 items after each 3-correct streak
    AVERAGE_PCT: 75,         // Norden et al.: fabricated comparison average
    COUNTDOWN_S: 3,          // Norden et al. / openDST CountdownBeforeTask
    ANTICIPATION_MIN_S: 20,  // grant/memo: 20–30 s anticipatory screen
    ANTICIPATION_MAX_S: 30,
    FEEDBACK_WRONG_MS: 1000, // openDST: 1000 ms on wrong / too slow
    FEEDBACK_CORRECT_MS: 50, // openDST: 50 ms, then next item
    MISSING_STREAK: 5,       // paper: reminder after 5 consecutive non-responses, next item an easy addition
  };

  const DST_COPY = {
    first: {
      title: "Cognitive Performance Evaluation",
      html: `<p class="read-note read-first"><strong>Please read all instructions carefully.</strong></p>
        <p>Your individual cognitive performance will now be evaluated under time pressure.</p>
        <p>You will solve simple arithmetic problems, and each problem is timed. Your accuracy will be compared with that of other participants in this study.</p>
        <p>Enter each answer by clicking the on-screen keypad. You cannot use the keyboard in this task. Sit still, and press <strong>I’m ready</strong> when you are prepared. The test starts only after you press it.</p>
        <p class="effort-note"><strong>Please give this task your full effort.</strong></p>`,
    },
    second: {
      title: "Cognitive Performance Evaluation",
      html: `<p class="read-note read-first"><strong>Please read all instructions carefully.</strong></p>
        <p>Your individual cognitive performance will now be evaluated under time pressure.</p>
        <p>You will solve simple arithmetic problems, and each problem is timed. Your accuracy will be compared with that of other participants in this study.</p>
        <p>Enter each answer by clicking the on-screen keypad. You cannot use the keyboard in this task. Sit still, and press <strong>I’m ready</strong> when you are prepared. The test starts only after you press it.</p>
        <p class="effort-note"><strong>Please give this task your full effort.</strong></p>`,
    },
    ready: "I’m ready",
    wait: "Available in {n} s",
    countdownLabel: "Get ready",
    taskTitle: "Cognitive Performance Evaluation",
    hint: "Click the keypad to enter your answer.",
    recorded: "Your performance is being recorded",
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


  const DST_PAD_STANDARD = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  function dstPadHtml(layout) {
    const keys = layout || DST_PAD_STANDARD;
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

  function dstItemLimitLabel(ms) {
    const n = (ms == null || !isFinite(+ms) || +ms <= 0) ? DST_DEFAULTS.LIMIT_MS : +ms;
    const s = n / 1000;
    const txt = Number.isInteger(s) ? String(s) : String(Math.round(s * 10) / 10);
    return txt + (s === 1 ? " second" : " seconds");
  }

  function runDstAnticipation(host, cfg, onEvent) {

    const C = Object.assign({}, DST_DEFAULTS, cfg || {});
    const variant = C.variant === "second" ? "second" : "first";
    const copy = DST_COPY[variant];
    const minS = C.ANTICIPATION_MIN_S;
    const maxS = C.ANTICIPATION_MAX_S;
    const limitLabel = dstItemLimitLabel(C.LIMIT_MS);
    const copyHtml = String(copy.html || "").replace(/\{limit\}/g, limitLabel);
    return new Promise((resolve) => {
      host.innerHTML = `<div class="dst dst-anticipation" data-dst-variant="${variant}">
        <p class="dst-kicker">Performance evaluation</p>
        <h2 class="dst-title">${copy.title}</h2>
        <div class="dst-copy">${copyHtml}</div>
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
        } // NO auto-start. The test begins only when the participant presses "I'm ready" (maxS no longer used to start it).
        raf = requestAnimationFrame(tick);
      };

      btn.addEventListener("click", () => finish("ready"));
      document.addEventListener("keydown", onKey, true);
      activeSkip = () => finish("skipped");
      onEvent && onEvent("dst_anticipation_start", { variant: variant, min_s: minS, max_s: maxS, limit_ms: C.LIMIT_MS, wordingVersion: C.wordingVersion || WORDING_VERSION });
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

  /* * Norden et al.-style generated DST items. Deterministic for a given seed. */
  function dstRng(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function generateDstItems(seed, n) {
    const rnd = dstRng(seed >>> 0);
    const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1)); // inclusive
    const make = {
      "+": () => { const sum = ri(2, 99), a = ri(1, sum - 1); return { a, b: sum - a, answer: sum }; },
      "\u2212": () => { const r = ri(1, 98), b = ri(1, 99 - r); return { a: r + b, b, answer: r }; },
      "\u00d7": () => { let a = ri(2, 49), b = ri(2, Math.floor(99 / a)); if (rnd() < 0.5) { const t = a; a = b; b = t; } return { a, b, answer: a * b }; },
      "\u00f7": () => { const q = ri(2, 49), b = ri(2, Math.floor(99 / q)); return { a: q * b, b, answer: q }; },
    };
    const ops = Object.keys(make);
    const out = [];
    let bag = [], prev = "";
    while (out.length < n) {
      if (!bag.length) { bag = ops.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = bag[i]; bag[i] = bag[j]; bag[j] = t; } }
      const op = bag.pop();
      const it = make[op]();
      const expr = it.a + " " + op + " " + it.b;
      if (expr === prev) { bag.push(op); continue; }
      prev = expr;
      out.push({ idx: out.length + 1, a: it.a, b: it.b, op, expr, answer: it.answer, source: "generated" });
    }
    return out;
  }

  function runDst(host, cfg, onEvent) {
    const C = Object.assign({}, DST_DEFAULTS, cfg || {});
    const variant = C.variant === "second" ? "second" : "first";
    const listId = C.listId || (variant === "second" ? "B" : "A");
    const list = (C.list && C.list.length ? C.list : (DST_LISTS[listId] || DST_LISTS.A)).map(function (it, i) {
      return Object.assign({ idx: i + 1 }, it);
    });
    const limit0 = Math.max(500, C.LIMIT_MS | 0);
    let limitMs = limit0;
    const durationS = Math.max(1, C.DURATION_S | 0);
    const avgPct = clamp(C.AVERAGE_PCT, 0, 100);

    return new Promise((resolve) => {
      host.innerHTML = `<div class="dst dst-task" data-dst-variant="${variant}" data-dst-list="${listId}">
        <div class="dst-top">
          <p class="dst-kicker">${DST_COPY.taskTitle}</p>
          <span id="dst-clock" class="dst-clock" hidden></span>
        </div>
        <div class="dst-recorded" id="dst-recorded" role="status"><span class="dst-rec-dot" aria-hidden="true"></span>${DST_COPY.recorded}</div>
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
      const padRng = mulberry32((((C.seed >>> 0) || 0x5eed) ^ (variant === "second" ? 0x2545f491 : 0x1b873593)) >>> 0);
      let streakOk = 0, streakBad = 0, shuffleLeft = 0, padLayout = DST_PAD_STANDARD.slice(), easyNext = false;
      let curShuffled = 0, curEasy = 0, curLimit = limitMs;
      const easyRng = mulberry32((((C.seed >>> 0) || 0x5eed) ^ 0x68e31da4) >>> 0);
      const makeEasy = () => { const a = 1 + Math.floor(easyRng() * 9), b = 1 + Math.floor(easyRng() * 9);
        return { a, b, op: "+", expr: a + " + " + b, answer: a + b, source: "easy_addition" }; };
      const setPadLayout = (layout) => {
        padLayout = layout;
        buttons.forEach((b, i) => { b.setAttribute("data-digit", String(layout[i])); b.textContent = String(layout[i]); b.setAttribute("aria-label", "Digit " + layout[i]); });
        const pad = host.querySelector(".dst-pad"); if (pad) pad.classList.toggle("shuffled", layout.join() !== DST_PAD_STANDARD.join());
      };
      const shuffledLayout = () => {
        let a;
        do { a = DST_PAD_STANDARD.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(padRng() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } }
        while (a.join() === DST_PAD_STANDARD.join());
        return a;
      };

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
          limit_ms: limit0,
          limit_start_ms: limit0,
          limit_final_ms: Math.round(limitMs),
          adaptive: 1,
          n_shuffled_items: responses.filter((r) => r.keypad_shuffled === 1).length,
          n_easy_items: responses.filter((r) => r.easy_item === 1).length,
          duration_s: durationS,
          duration_ms: duration_ms,
          wordingVersion: C.wordingVersion || WORDING_VERSION,
          protocol: "dst_norden_2022",
        };
        onEvent && onEvent("dst_offset", { variant: variant, list_id: listId, skipped: skipped ? 1 : 0, summary: summary });
        resolve({
          config: { DURATION_S: durationS, LIMIT_MS: limit0, ADAPTIVE: 1, AVERAGE_PCT: avgPct, listId: listId, KEYPAD_ONLY: 1 },
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
        // Norden et al. adaptation (applies from the next item)
        const limitBefore = curLimit;
        let adapt = "";
        if (kind !== "block_end") {
          if (correct) { streakOk++; streakBad = 0; } else { streakBad++; streakOk = 0; }
          if (streakOk >= C.ADAPT_N) { limitMs = clamp(limitMs * C.ADAPT_FAST, C.LIMIT_MIN_MS, C.LIMIT_MAX_MS); streakOk = 0; shuffleLeft = C.SHUFFLE_ITEMS; adapt = "faster_shuffle"; }
          else if (streakBad >= C.ADAPT_N) { limitMs = clamp(limitMs * C.ADAPT_SLOW, C.LIMIT_MIN_MS, C.LIMIT_MAX_MS); streakBad = 0; adapt = "slower"; }
          if (noAnswerStreak >= C.MISSING_STREAK) easyNext = true;
        }

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
          limit_ms: Math.round(limitBefore),
          next_limit_ms: Math.round(limitMs),
          adapt_event: adapt,
          keypad_shuffled: curShuffled,
          keypad_layout: padLayout.join(""),
          easy_item: curEasy,
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
        const showRem = easyNext;
        if (elMissing) elMissing.hidden = !showRem;
        if (easyNext) {
          current = Object.assign(makeEasy(), { idx: "easy" });
          easyNext = false;
          noAnswerStreak = 0; // another 5 non-responses trigger the reminder again
          curEasy = 1;
          onEvent && onEvent("dst_easy_item", { variant: variant, problem: current.expr });
        } else {
          current = list[currentIndex];
          currentIndex += 1;
          curEasy = 0;
        }
        if (shuffleLeft > 0) { setPadLayout(shuffledLayout()); shuffleLeft -= 1; curShuffled = 1; }
        else { if (padLayout.join() !== DST_PAD_STANDARD.join()) setPadLayout(DST_PAD_STANDARD.slice()); curShuffled = 0; }
        curLimit = limitMs;
        if (elProb) elProb.textContent = current.expr;
        renderAnswer();
        setPadEnabled(true);
        itemOnset = performance.now();
        itemTimerStart = itemOnset;
        if (elFill) elFill.style.width = "100%";
        clearTimeout(timer);
        const remainBlock = durationS * 1000 - (itemOnset - t0);
        const thisLimit = Math.max(0, Math.min(Math.round(curLimit), remainBlock));
        timer = setTimeout(() => {
          if (remainBlock <= curLimit + 16 && (performance.now() - t0) >= durationS * 1000 - 30) {
            respond("block_end", typed);
          } else {
            respond("timeout", typed);
          }
        }, thisLimit);
        onEvent && onEvent("dst_item_onset", {
          variant: variant, list_id: listId, idx: responses.length + 1,
          item_index: current.idx, problem: current.expr, limit_ms: thisLimit,
          source: current.source || "study_list", keypad_shuffled: curShuffled, keypad_layout: padLayout.join(""), easy_item: curEasy,
        });
      };

      const tick = (now) => {
        if (done) return;
        const left = durationS * 1000 - (now - t0);
        if (elClock && !elClock.hidden) elClock.textContent = fmtClock(left);
        if (!locked && current && elFill) {
          const frac = Math.max(0, 1 - (now - itemTimerStart) / curLimit);
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
        if (isAdminEscape(e)) { e.preventDefault(); finish(true, "skipped"); return; } // keyboard digits disabled (keypad only); swallowed so they do nothing
        if (e.key >= "0" && e.key <= "9") { e.preventDefault(); e.stopPropagation(); onEvent && onEvent("dst_keyboard_blocked", { key: e.key }); }
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
        limit_ms: limit0, adaptive: 1, keypad_only: 1, average_marker_pct: avgPct,
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
    return `<p class="dst-kicker">Performance evaluation</p>
      <h2 class="dst-title">Your results</h2>
      <p>Your accuracy: <strong>${you}%</strong> (${ok} of ${n} problems correct).</p>
      <p>Comparison average: <strong>${avg}%</strong>.</p>`;
  }

  window.WFStress = {
    skipCurrent: requestSkip,
    runDstAnticipation: runDstAnticipation,
    runDstCountdown: runDstCountdown,
    runDst: runDst,
    dstSummaryHtml: dstSummaryHtml,
    generateDstItems: generateDstItems,
    DST_LISTS: DST_LISTS,
    DST_DEFAULTS: DST_DEFAULTS,
    DST_COPY: DST_COPY,
    WORDING_VERSION: WORDING_VERSION,
    DEBRIEF_COPY: DEBRIEF_COPY,
  };

})();

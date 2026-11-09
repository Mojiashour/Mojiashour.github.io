/**
 * Wayfinding SPA v4.4 — full session: intro, consent, today's-state questions, questionnaires, practice,
 * a MIST-style stress induction (Dedovic et al., 2005; original HTML/JS, not Inquisit) before each
 * wayfinding condition, Nature + Poster(Abstract) conditions on the FINAL 6000x3000 renders, a short
 * corridor-transition animation after each left/right choice, per-block stress sliders, a debrief
 * (comparison bar was not real) then a single end-of-session performance summary (Part 1 / Part 2,
 * no condition names), post-experiment measures, export.
 * Trial logic (mulberry32 seed, 3 blocks x 14 trials per condition, 3 lag-3 recall probes per block, board
 * table seed 20261007, CSV columns) is unchanged from v3 apart from what is listed in README_v4.4.md.
 *
 * URL options (combine with &)
 *   ?mode=lab | remote        lab = EEG/ECG marker hook + experimenter setup/rest screens (default remote)
 *   ?pid=TEST_ABC            optional study code (testing); otherwise auto-assigned / lab typed
 *   ?seed=12345               participant randomisation seed (default random, logged)
 *   ?order=NA | AN            condition order (default: derived from a hash bit of the random participant ID)
 *   ?res=6k | 4k              panorama derivative (default 6k = 6000x3000 JPEG; 4k = 4096x2048)
 *   ?trialsPerBlock=4         pilot / debugging (default 14)
 *   ?mistSec=90               duration of each MIST experimental segment in seconds (default 90)
 *   ?mistPracticeSec=40       untimed MIST practice at first use only (default 40; 0 skips practice)
 *   ?mistAvg=85               fixed "average performance" marker, 80–90 (default 85)
 *   ?mistMsg=1                brief negative-evaluative messages between MIST sub-segments (default off)
 *   ?trans=2200               total exit+entry corridor transition in ms (default 2200 walking pace; 0 disables)
 *   ?fov=102                  horizontal field of view in degrees (default 102; was 90 in v4.3)
 *   ?prep=1                   use the legacy anticipatory-prep screen instead of MIST
 *   ?prepSec=45               duration of that legacy prep screen (default 45; the old 120 s default is gone)
 *   ?liveStress=1             use the legacy live serial-subtraction module (failure feedback) instead of MIST
 *   ?endMath=1                optional short arithmetic task at the end (default off)
 *   ?mathSec=120              duration of the end arithmetic task when endMath=1 (default 120)
 *   ?stressSec=300            duration of the legacy live stress task when liveStress=1 (default 300)
 *   ?sam=1                    include SAM (disabled by default)
 *   ?summary=0                hide the end-of-session performance summary (default shown at the end only)
 *   ?rest=180                 resting-baseline duration in s (default 180 in lab mode, 0 in remote)
 *   ?restBaseline=180         override resting-baseline only (defaults to ?rest=)
 *   ?restBetween=180          between-condition rest in s (default 0; off because a second induction follows)
 *   ?skipQ=1                  skip all questionnaires (task testing only; logged)
 *   ?interview=1              show the experimenter interview-notes screen (default on in lab, off in remote)
 *   ?interview=0              hide it even in lab
 *   ?boardFit=panel|contain|stretch  sign board on the 1.20 x 1.371 m panel. Default panel = sign-generator v1.5
 *                             panel-format boards (assets/boards_panel/, 0.875:1) filling the panel, no stretching.
 *                             contain / stretch = the old v1.4 2:3 boards (assets/boards/): full height with ~14 cm
 *                             side gaps / stretched 31% wider (comparison only)
 *   ?abstract=real|placeholder|disabled   Poster condition source (default real = R01–R07_PST finals)
 *   ?tone=off  ?oversize=1.015  ?resident=all  ?debug=1   (as in v3)
 */
(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const num = (k, d) => (params.has(k) && params.get(k) !== "" && isFinite(+params.get(k)) ? +params.get(k) : d);
  const modeParam = (params.get("mode") || "remote").toLowerCase();
  const mode = modeParam === "lab" ? "lab" : "remote";
  const DEBUG = params.get("debug") === "1";
  const RES = params.get("res") === "6k" ? "6k" : "4k"; // hosted/default 4k

  function stressModeFromParams() {
    if (params.get("liveStress") === "1") return "live";
    if (params.get("prep") === "1") return "anticipatory";
    return "mist";
  }

  const CONFIG = {
    DECISION_DELAY_MS: 500,
    PROBE_DELAY_MS: 500,
    PROBE_LAG: 3,
    PROBES_PER_BLOCK: 3,
    PROBE_MIN_SPACING: 3,
    TRIALS_PER_BLOCK: num("trialsPerBlock", 14),
    HFOV: Math.max(70, Math.min(140, num("fov", 102))), // v4.4: zoomed out vs 90°; ?fov= overrides
    START_YAW: 0,
    START_PITCH: 0,
    ABSTRACT_MODE: ["placeholder", "disabled"].includes(params.get("abstract")) ? params.get("abstract") : "real",
    SIGN_OVERSIZE: num("oversize", 1.015),
    BOARD_FIT: ["contain", "stretch"].includes(params.get("boardFit")) ? params.get("boardFit") : "panel",
    GPU_WINDOW: params.get("resident") === "all" ? Infinity : Math.max(2, num("resident", 3)),
    TONE: { on: params.get("tone") !== "off", lift: 0.1, gain: 0.88, shadeStrength: 0.4 },
    RES,
    PANO_DIR: `assets/pano/${RES}/`,
    // v4 panel boards (sign-generator v1.5, 1400x1600, 7:8) or the legacy v1.4 2:3 boards (1200x1800)
    BOARD_DIR: ["contain", "stretch"].includes(params.get("boardFit")) ? "assets/boards/" : "assets/boards_panel/",
    BOARD_ASPECT: ["contain", "stretch"].includes(params.get("boardFit")) ? 2 / 3 : 700 / 800,
    SKIP_Q: params.get("skipQ") === "1",
    REST_S: num("rest", mode === "lab" ? 180 : 0), // convenience alias; sets the baseline rest default only
    REST_BASELINE_S: num("restBaseline", num("rest", mode === "lab" ? 180 : 0)),
    REST_BETWEEN_S: num("restBetween", 0), // default off: a second induction follows condition 1
    INTERVIEW: params.get("interview") === "1" || (mode === "lab" && params.get("interview") !== "0"),
    SCREEN_ITEM13_EXCLUDES: false, // docx: item 13 excludes only if the investigator adopts it
    MRT: "pending", // UNDECIDED (Peters MRT-A needs answer key + permission): no MRT items are included
    SHOW_SAM: params.get("sam") === "1", // SAM kept in instruments.js but omitted from the flow unless ?sam=1
    SHOW_SUMMARY: params.get("summary") !== "0", // shown once at the end, never after each condition
    STRESS_MODE: stressModeFromParams(), // default mist; ?prep=1 or ?liveStress=1 select the legacy modules
    PREP_S: num("prepSec", 45), // used only when STRESS_MODE === "anticipatory"; 2-minute default removed
    MIST_S: num("mistSec", 90), // v4.4 default 90 s
    MIST_PRACTICE_S: num("mistPracticeSec", 40),
    MIST_AVG: Math.max(80, Math.min(90, num("mistAvg", 85))),
    MIST_EVAL_MESSAGES: params.get("mistMsg") === "1",
    // v4.4 two-sided walking transition: ?trans= is TOTAL exit+entry duration (~2–2.5 s default).
    TRANS_MS: num("trans", 2200), // 0 disables both halves
    TRANS_YAW: num("transYaw", 32), // exit turn amplitude
    TRANS_HFOV: num("transHfov", Math.round(Math.max(70, Math.min(140, num("fov", 102))) * 0.78)), // exit mid zoom (~78% of base)
    // Entry starts slightly WIDE then narrows to base FOV (continues forward motion; not zoom-out/backwards).
    TRANS_ENTER_HFOV: num("transEnterHfov", Math.min(140, Math.round(Math.max(70, Math.min(140, num("fov", 102))) + 14))),
    TRANS_BOB: num("transBob", 0.55), // low-amplitude walking bob
    TRANS_BOB_CYCLES: num("transBobCycles", 2.2), // ~2 steps/sec over each half (~1.1 s)
    TRANS_OUT_FRAC: 0.55, // exit share of TRANS_MS; entry gets the rest
    END_MATH: params.get("endMath") === "1", // default off
    END_MATH_S: num("mathSec", 120),
    WORDING_VERSION: "DRAFT_IRB_2026-11-09_v44",
    STRESS: { START: 1022, STEP: 13, DURATION_S: num("stressSec", 300), LIMIT0_MS: 7000, LIMIT_MIN_MS: 2500,
      LIMIT_MAX_MS: 10000, FEEDBACK_MS: 900, ADAPT_N: 3 },
  };

  // layout token (sign-generator CSV `layout`) -> FINAL render ids (file names in assets/pano/<res>/)
  const NATURE_RENDERS = {
    L: "R01_NAT_L", R: "R02_NAT_R", Both: "R03_NAT_Both", On: "R04_NAT_On",
    OnL: "R05_NAT_OnL", OnR: "R06_NAT_OnR", OnBoth: "R07_NAT_OnBoth",
  };
  // Poster condition = the "Abstract" condition of the board codebook (condition value stays "Abstract").
  // v2/v3 reserved R08–R14 for it; the finals are named R01–R07_PST (same layout order).
  const ABSTRACT_RENDERS = {
    L: "R01_PST_L", R: "R02_PST_R", Both: "R03_PST_Both", On: "R04_PST_On",
    OnL: "R05_PST_OnL", OnR: "R06_PST_OnR", OnBoth: "R07_PST_OnBoth",
  };
  const LEGACY_SCENE_ID = { R01_PST_L: "R08", R02_PST_R: "R09", R03_PST_Both: "R10", R04_PST_On: "R11",
    R05_PST_OnL: "R12", R06_PST_OnR: "R13", R07_PST_OnBoth: "R14" };
  const ABSTRACT_PLACEHOLDER_RENDER = "R16_TRN_Sign";
  const COND_LABEL = { Nature: "Nature", Abstract: "Poster" };

  // Training: T1 wall, T2 green-wall cue, T2P poster cue (v4, added because the Poster finals now exist; the cue of the
  // participant's first condition is shown first), T3/T4 sign with the Admissions boards.
  const TRAINING_BASE = {
    T1: { trainingId: "T1", renderId: "R15_TRN_Wall", boardId: null, correctDirection: "",
      prompt: "Practice: there is no sign here. Choose either direction with ← or →." },
    T2: { trainingId: "T2", renderId: "R17_TRN_GW", boardId: null, correctDirection: "",
      prompt: "Practice: there is no sign here. Choose either direction with ← or →." },
    T2P: { trainingId: "T2P", renderId: "R17_TRN_PST", boardId: null, correctDirection: "",
      prompt: "Practice: there is no sign here. Choose either direction with ← or →." },
    T3: { trainingId: "T3", renderId: "R16_TRN_Sign", boardId: "TRN_T3_Admissions_corrL", correctDirection: "left",
      prompt: "Practice: use the sign to find Admissions. Press ← or →." },
    T4: { trainingId: "T4", renderId: "R16_TRN_Sign", boardId: "TRN_T4_Admissions_corrR", correctDirection: "right",
      prompt: "Practice: use the sign to find Admissions. Press ← or →." },
  };
  let TRAINING = [];

  const STIM = window.WF_STIMULI;
  const INSTR = window.WF_INSTRUMENTS;
  const SCORE = window.WF_SCORING;
  const BOARDS = {};
  STIM.boards.forEach((b) => (BOARDS[b.board_id] = b));

  /* ---------------- seeded RNG (mulberry32) ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------------- state ---------------- */
  let pano = null;
  let eventQueue = [];        // events of the trial segment currently running
  let pendingSegments = [];   // queues of later trial segments (for GPU residency look-ahead)
  let segmentDone = null;     // resolver of the running trial segment
  let currentEvent = null;
  let decisionOnsetPerf = null;
  let sceneOnsetPerf = null;
  let choiceEnabled = false;
  let decisionTimer = null;
  let responding = false;
  let decisionChoicesByIndex = {};
  let preloadPromise = null;
  let nTestDecisions = 0;
  let currentPhase = "setup";
  let surveyRnd = null;
  let eventSeq = 0;
  let fadeCovered = false;   // white overlay is fully up after a corridor exit, waiting for the next scene
  let transitionBusy = false; // true from exit start until entry finishes; choices ignored

  const session = {
    appVersion: "v4.4",
    participantId: "",
    participantIdSource: "",
    mode,
    seed: null,
    conditionOrder: "",
    conditionOrderSource: "",
    abstractMode: CONFIG.ABSTRACT_MODE,
    boardSeed: STIM.boardSeed,
    trialsPerBlock: CONFIG.TRIALS_PER_BLOCK,
    startedAt: null,
    completedAt: null,
    endReason: "",
    // privacy: no user agent, IP, names, contact details or dates of birth are collected (README_v4.md)
    display: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
    config: CONFIG,
    consent: null,
    eligibility: null,
    preload: null,
    plan: null,
    trials: [],
    responses: [],   // questionnaire items, long format
    scores: [],      // one row per questionnaire administration
    stress: { mode: CONFIG.STRESS_MODE, preps: [], live: null, endMath: null, mist: { practice: null, segments: [], state: {} }, debriefShown: false },
    summaries: [],
    interview: null,
    events: [],      // every phase / instruction / trial marker, always logged (lab mode also sends to the hook)
  };

  const $ = (id) => document.getElementById(id);
  const screens = {
    page: $("screen-page"),
    instructions: $("screen-instructions"),
    trial: $("screen-trial"),
    end: $("screen-end"),
  };
  function showScreen(name) {
    Object.keys(screens).forEach((k) => screens[k].classList.toggle("active", k === name));
    if (name !== "trial") clearTransitionVisuals();
    if (name === "trial" && pano) pano.resize();
    window.scrollTo(0, 0);
  }
  /** 12-character Crockford base32 ID from crypto.getRandomValues (60 bits, unbiased). */
  const CROCKFORD32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  function uid() {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    let s = "";
    for (let i = 0; i < 12; i++) s += CROCKFORD32[bytes[i] % 32]; // 256 is divisible by 32
    return s;
  }
  /** Lowest bit of FNV-1a hash of the ID; used to counterbalance condition order. */
  function idHashBit(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) & 1;
  }
  const isoNow = () => new Date().toISOString();
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** Every marker is logged; in lab mode it is also passed to window.WF_MARKER_HOOK (EEG/ECG trigger bridge stub). */
  function logEvent(type, extra) {
    const evt = { seq: ++eventSeq, event: type, phase: currentPhase, perf: +performance.now().toFixed(1), timestamp: isoNow(),
      trialIndex: currentEvent && currentEvent.trialIndex != null ? currentEvent.trialIndex : "", ...extra };
    session.events.push(evt);
    if (mode === "lab") {
      console.log("[marker]", evt);
      if (typeof window.WF_MARKER_HOOK === "function") { try { window.WF_MARKER_HOOK(evt); } catch (e) { console.error(e); } }
    }
    return evt;
  }
  const pushMarker = logEvent; // v3 name used by the trial code

  /* ---------------- autosave (localStorage + pluggable backend) ---------------- */
  let serverOk = null;
  let lastSave = { ok: null, adapter: "", error: "" };
  function autosave(reason) {
    if (!session.participantId) return Promise.resolve(lastSave);
    const json = JSON.stringify(session);
    try { localStorage.setItem("wf_v44_" + session.participantId, json); } catch (e) { /* quota: ignore */ }
    const meta = {
      appVersion: session.appVersion, startedAt: session.startedAt, completedAt: session.completedAt || "",
      endReason: session.endReason || "", reason, savedAt: isoNow(),
    };
    const payload = { participantId: session.participantId, reason, files: exportFiles(), meta };
    const p = (window.WFBackend && window.WFBackend.save)
      ? window.WFBackend.save(payload)
      : Promise.resolve({ ok: false, adapter: "none", error: "no_backend" });
    return p.then((res) => {
      lastSave = res;
      serverOk = !!res.ok;
      logEvent("backend_save", { reason, ok: res.ok ? 1 : 0, adapter: res.adapter || "", error: res.error || "" });
      return res;
    }).catch((e) => {
      lastSave = { ok: false, adapter: "unknown", error: String(e && e.message || e) };
      serverOk = false;
      logEvent("backend_save", { reason, ok: 0, error: lastSave.error });
      return lastSave;
    });
  }

  /* ---------------- asset paths & preload ---------------- */
  const panoUrl = (id) => CONFIG.PANO_DIR + id + ".jpg";
  const boardUrl = (id) => CONFIG.BOARD_DIR + BOARDS[id].png_file;

  function ensureViewer() {
    if (pano) return pano;
    const ov = STIM.signOverlay.sign_world_m;
    pano = new window.Pano3D($("pano"), {
      hfov: CONFIG.HFOV,
      sign: { xMin: ov.x[0], xMax: ov.x[1], yFront: ov.y_front_face, zMin: ov.z[0], zMax: ov.z[1],
        eyeZ: STIM.signOverlay.camera.position_m[2] },
      oversize: CONFIG.SIGN_OVERSIZE,
      boardFit: CONFIG.BOARD_FIT,
      boardAspect: CONFIG.BOARD_ASPECT,
      tone: CONFIG.TONE,
      preserveDrawingBuffer: DEBUG,
    });
    return pano;
  }

  function decisionAssetUrls(ev) {
    const out = [{ url: panoUrl(ev.renderId), kind: "pano" }];
    if (ev.boardId) out.push({ url: boardUrl(ev.boardId), kind: "board" });
    return out;
  }

  /** URLs that must be on the GPU now: the next CONFIG.GPU_WINDOW decision scenes still to come. */
  function residentTargets() {
    const out = [];
    const seen = new Set();
    let n = 0;
    const evs = (currentEvent && currentEvent.kind === "decision" && !responding ? [currentEvent] : []).concat(eventQueue, ...pendingSegments);
    for (const ev of evs) {
      if (ev.kind !== "decision") continue;
      if (n++ >= CONFIG.GPU_WINDOW) break;
      for (const u of decisionAssetUrls(ev)) if (!seen.has(u.url)) { seen.add(u.url); out.push(u); }
    }
    return out;
  }

  let residencyChain = Promise.resolve();
  /** Evict textures no longer needed, upload the upcoming ones (called in the post-response pause). */
  function syncResidency() {
    const v = ensureViewer();
    const targets = residentTargets();
    const keep = new Set(targets.map((u) => u.url));
    for (const url of Array.from(v.cache.keys())) if (!keep.has(url)) v.evict(url);
    residencyChain = residencyChain.then(async () => {
      for (const u of targets) {
        if (!v.cache.has(u.url)) {
          try { await v.load(u.url, u.kind); } catch (e) { console.error("[residency]", e); }
        }
      }
      session.gpuPeak = Math.max(session.gpuPeak || 0, v.stats().gpu_mb_total_est);
    });
    return residencyChain;
  }

  /** Preload: fetch every file this session can show into RAM, then decode + upload the first GPU window. */
  function preloadAll(urls) {
    const v = ensureViewer();
    const t0 = performance.now();
    let done = 0;
    const failed = [];
    const status = $("preload-status");
    const upd = () => {
      if (status) status.textContent = `Loading scenes… ${done}/${urls.length}`;
    };
    upd();
    const queue = urls.slice();
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const u = queue.shift();
        await v.prefetch(u.url).catch((e) => { failed.push(u.url); console.error(e); });
        done++;
        upd();
      }
    });
    let tFetched;
    return Promise.all(workers)
      .then(() => {
        if (failed.length) throw new Error("could not fetch " + failed.join(", "));
        tFetched = performance.now();
        if (status) status.textContent = "Preparing scenes…";
        return syncResidency();
      })
      .then(() => {
        const ms = Math.round(performance.now() - t0);
        const mem = performance.memory
          ? { jsHeapUsedMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1),
              jsHeapTotalMB: +(performance.memory.totalJSHeapSize / 1048576).toFixed(1) }
          : null;
        const info = {
          total_ms: ms,
          fetch_ms: Math.round(tFetched - t0),
          gpu_first_window_ms: Math.round(performance.now() - tFetched),
          n_assets: urls.length,
          gpu_window: CONFIG.GPU_WINDOW === Infinity ? "all" : CONFIG.GPU_WINDOW,
          resident: Array.from(v.cache.values()).map((e) => ({ url: e.url, kind: e.kind, w: e.width, h: e.height,
            ms_total: e.ms_total, ms_upload: e.ms_upload })),
          gpu: v.stats(),
          memory: mem,
        };
        session.preload = info;
        if (status) { status.textContent = ""; status.hidden = true; }
        console.log("[preload]", info);
        return info;
      });
  }

  /* ---------------- session plan ---------------- */
  /** Counterbalancing: ?order= wins; otherwise the lowest bit of a hash of the participant ID
      (id_hash_bit; 1 = NA, 0 = AN). The RNG draw is still consumed so trial orders for a given
      seed do not depend on the source. The source and bit are logged. */
  function chooseOrder(rnd) {
    const draw = rnd(); // always consumed (as in v3) so block/trial orders for a given seed do not depend on the source
    const p = params.get("order");
    if (p === "NA" || p === "AN") return { order: p, source: "url", idBit: idHashBit(session.participantId) };
    const bit = idHashBit(session.participantId || "");
    return { order: bit ? "NA" : "AN", source: "id_hash_bit", idBit: bit };
  }

  function intendedRender(cond, layout) { return cond === "Nature" ? NATURE_RENDERS[layout] : ABSTRACT_RENDERS[layout]; }

  function buildPlan(seed) {
    const rnd = mulberry32(seed);
    let order = "N", orderSource = "abstract_disabled";
    if (CONFIG.ABSTRACT_MODE !== "disabled") { const o = chooseOrder(rnd); order = o.order; orderSource = o.source; }
    const conds = order.split("").map((c) => (c === "N" ? "Nature" : "Abstract"));
    TRAINING = ["T1"].concat(order[0] === "A" ? ["T2P", "T2"] : ["T2", "T2P"], ["T3", "T4"])
      .filter((t) => !(t === "T2P" && CONFIG.ABSTRACT_MODE !== "real")).map((t) => TRAINING_BASE[t]);
    const practice = [{ kind: "blockIntro", isPractice: true, practiceIntro: "free", condition: "Training", block: 0 }];
    TRAINING.forEach((t, i) => {
      if (t.trainingId === "T3") {
        const b = BOARDS[t.boardId];
        practice.push({ kind: "blockIntro", isPractice: true, condition: "Training", block: 0, destination: b.destination, level: b.dest_level });
      }
      practice.push({ kind: "decision", isPractice: true, trialIndex: 0, trainingId: t.trainingId,
        condition: "Training", block: 0, blockPos: i + 1, renderId: t.renderId, intendedRenderId: t.renderId, boardId: t.boardId,
        correctDirection: t.correctDirection, prompt: t.prompt,
        destination: t.boardId ? BOARDS[t.boardId].destination : "", stimulusPlaceholder: 0 });
    });
    let trialIndex = 0, probeSerial = 0;
    const plan = { seed, order, orderSource, training: TRAINING.map((t) => t.trainingId), blocks: [] };
    const condQueues = conds.map((cond, ci) => {
      const queue = [];
      shuffle([1, 2, 3], rnd).forEach((blockNo, bi) => {
        const boards = STIM.boards.filter((b) => b.condition === cond && +b.block === blockNo);
        const trials = shuffle(boards, rnd).slice(0, CONFIG.TRIALS_PER_BLOCK);
        const n = trials.length;
        const probeAfter = pickProbePositions(n, rnd);
        const dest = boards[0].destination;
        plan.blocks.push({ condition: cond, conditionPosition: ci + 1, blockOrder: bi + 1, block: blockNo, destination: dest,
          level: boards[0].dest_level, boards: trials.map((b) => b.board_id), probesAfter: probeAfter });
        queue.push({ kind: "blockIntro", condition: cond, conditionPosition: ci + 1, block: blockNo, blockOrder: bi + 1,
          destination: dest, level: boards[0].dest_level });
        trials.forEach((b, i) => {
          trialIndex++;
          const placeholder = cond === "Abstract" && CONFIG.ABSTRACT_MODE === "placeholder";
          queue.push({ kind: "decision", isPractice: false, trialIndex, trainingId: "",
            condition: cond, conditionPosition: ci + 1, block: blockNo, blockOrder: bi + 1, blockPos: i + 1,
            renderId: placeholder ? ABSTRACT_PLACEHOLDER_RENDER : intendedRender(cond, b.layout),
            intendedRenderId: intendedRender(cond, b.layout),
            boardId: b.board_id, correctDirection: b.correct_side, destination: b.destination,
            prompt: `Find the way to ${b.destination}. Press ← or →.`,
            stimulusPlaceholder: placeholder ? 1 : 0 });
          if (probeAfter.indexOf(i + 1) >= 0) {
            probeSerial++;
            queue.push({ kind: "probe", trialIndex: 1000 + probeSerial, isPractice: false,
              condition: cond, conditionPosition: ci + 1, block: blockNo, blockOrder: bi + 1, probeLag: CONFIG.PROBE_LAG,
              referencedTrialIndex: trialIndex - (CONFIG.PROBE_LAG - 1) });
          }
        });
      });
      return { condition: cond, queue };
    });
    nTestDecisions = trialIndex;
    return { practice, condQueues, conds, plan };
  }

  /** PROBES_PER_BLOCK positions in [PROBE_LAG, n], pairwise ≥ PROBE_MIN_SPACING apart (rejection sampling). */
  function pickProbePositions(n, rnd) {
    const k = CONFIG.PROBES_PER_BLOCK, lo = CONFIG.PROBE_LAG;
    const cand = [];
    for (let p = lo; p <= n; p++) cand.push(p);
    for (let tries = 0; tries < 2000; tries++) {
      const pick = shuffle(cand, rnd).slice(0, k).sort((a, b) => a - b);
      let ok = pick.length === k;
      for (let i = 1; i < pick.length; i++) if (pick[i] - pick[i - 1] < CONFIG.PROBE_MIN_SPACING) ok = false;
      if (ok) return pick;
    }
    // short (pilot) blocks: as many as fit
    const out = [];
    for (let p = lo; p <= n && out.length < k; p += CONFIG.PROBE_MIN_SPACING) out.push(p);
    return out;
  }

  function sessionAssetUrls(queues) {
    const seen = new Set();
    const urls = [];
    queues.flat().forEach((e) => {
      if (e.kind !== "decision") return;
      [[e.renderId && panoUrl(e.renderId), "pano"], [e.boardId && boardUrl(e.boardId), "board"]].forEach(([u, k]) => {
        if (u && !seen.has(u)) { seen.add(u); urls.push({ url: u, kind: k }); }
      });
    });
    return urls;
  }

  /* ---------------- UI helpers ---------------- */
  function setDecisionUI(enabled) {
    choiceEnabled = enabled;
    $("btn-left").disabled = !enabled;
    $("btn-right").disabled = !enabled;
    const hint = $("decision-key-hint");
    hint.textContent = enabled ? "Ready — press ← or →" : "Waiting… look around first";
    hint.classList.toggle("ready", enabled);
  }
  function setProbeUI(enabled) {
    choiceEnabled = enabled;
    $("btn-probe-left").disabled = !enabled;
    $("btn-probe-right").disabled = !enabled;
    const hint = $("probe-key-hint");
    hint.textContent = enabled ? "Ready — press ← or →" : "Waiting…";
    hint.classList.toggle("ready", enabled);
  }
  function showPanel(which) {
    $("decision-panel").hidden = which !== "decision";
    $("probe-panel").hidden = which !== "probe";
    $("intro-panel").hidden = which !== "intro";
    $("probe-placeholder").hidden = which === "decision";
    $("pano").style.visibility = which === "decision" ? "visible" : "hidden";
  }
  function resetResponseState() {
    choiceEnabled = false;
    responding = false;
    decisionOnsetPerf = null;
    ["btn-left", "btn-right", "btn-probe-left", "btn-probe-right"].forEach((id) => ($(id).disabled = true));
    setDecisionUI(false);
    setProbeUI(false);
  }
  function showLoadError(message) {
    const overlay = $("loading-overlay");
    overlay.classList.add("visible", "error");
    overlay.innerHTML = message;
  }

  /* v3: thin progress bar. Main task = completed non-practice decisions / nTestDecisions.
     Practice shows its own separate count. Display only; no effect on logic or logging. */
  function updateProgress(spec) {
    const fill = $("progress-fill"), lbl = $("progress-label");
    if (!fill || !lbl) return;
    if (spec && spec.isPractice) {
      const n = TRAINING.length || 1, done = Math.max(0, (spec.blockPos || 1) - 1);
      fill.style.width = (100 * done / n) + "%";
      fill.classList.add("practice");
      lbl.textContent = `Practice ${spec.blockPos || 1}/${n}`;
      return;
    }
    fill.classList.remove("practice");
    const done = session.trials.filter((t) => t.trialType === "decision" && !t.isPractice).length;
    const pct = nTestDecisions ? Math.round(100 * done / nTestDecisions) : 0;
    fill.style.width = pct + "%";
    lbl.textContent = pct + "%";
  }

  /* ---------------- events ---------------- */
  function introText(spec) {
    if (spec.practiceIntro === "free") {
      return { big: "Practice", html:
        "<p>First, a few practice intersections.</p>" +
        "<p>At the first ones there is no sign: simply choose either direction with ← or →.</p>" +
        "<p>Look around with the mouse if you like.</p>" };
    }
    const dest = escapeHtml(spec.destination);
    const lvl = spec.level != null && spec.level !== "" ? ` (Level ${escapeHtml(String(spec.level))})` : "";
    return { big: spec.destination, html:
      "<p>You are in a hospital environment.</p>" +
      `<p>Your task is to <strong>find \u201c${dest}\u201d${lvl}</strong>.</p>` +
      "<p>You will go through a series of intersections, and at each one you will be asked to select a direction (left or right).</p>" +
      "<p>Please make your decision as <strong>quickly</strong>, and as <strong>accurately</strong> as you can.</p>" };
  }
  function startBlockIntro(spec) {
    currentEvent = spec;
    resetResponseState();
    showPanel("intro");
    const tx = introText(spec);
    $("placeholder-text").textContent = tx.big;
    const subEl = $("placeholder-sub");
    subEl.classList.add("intro-lines");
    subEl.innerHTML = tx.html;
    $("probe-placeholder").classList.add("intro");
    $("task-header").textContent = spec.isPractice ? "Hospital Wayfinding Task: Practice" : "Hospital Wayfinding Task: New destination";
    updateProgress(spec.isPractice ? { isPractice: true, blockPos: 1 } : spec);
    $("trial-badge").textContent = spec.isPractice ? "Practice" : "New destination";
    $("trial-hint").textContent = "Press Space or Continue";
    $("intro-prompt").textContent = spec.isPractice && spec.practiceIntro ? "Practice" : `Your destination: ${spec.destination}`;
    $("intro-sub").textContent = "Press Space or click Continue to start.";
    showScreen("trial");
    const markIntro = () => {
      if (currentEvent !== spec) return;
      spec._shownPerf = performance.now();
      pushMarker("instruction_shown", { condition: spec.condition, conditionPosition: spec.conditionPosition || "",
      block: spec.block, blockOrder: spec.blockOrder || "", destination: spec.destination || "", level: spec.level || "",
      isPractice: !!spec.isPractice });
    pushMarker("block_onset", { condition: spec.condition, block: spec.block, destination: spec.destination || "" });
    };
    if (fadeCovered) playEnterTransition().then(markIntro);
    else markIntro();
  }
  function dismissIntro() {
    const spec = currentEvent;
    if (!spec || spec.kind !== "blockIntro") return;
    pushMarker("instruction_dismissed", { condition: spec.condition, block: spec.block, destination: spec.destination || "",
      viewing_ms: Math.round(performance.now() - (spec._shownPerf || performance.now())) });
    $("probe-placeholder").classList.remove("intro");
    advance();
  }

  function peekNextEvent() { return eventQueue[0] || null; }
  function transOverlay() { return $("transition-overlay"); }
  function setOverlayOpacity(op) {
    const el = transOverlay();
    if (!el) return;
    el.style.opacity = String(Math.max(0, Math.min(1, op)));
    el.classList.toggle("on", op > 0.02);
  }
  function setPanoBlur(px) {
    const el = $("pano");
    if (!el) return;
    if (px > 0.05) {
      el.classList.add("trans-animating");
      el.style.filter = "blur(" + px.toFixed(2) + "px)";
      el.style.transform = "scale(" + (1 + Math.min(0.08, px / 80)).toFixed(4) + ")";
    } else {
      el.style.filter = "";
      el.style.transform = "";
      el.classList.remove("trans-animating");
    }
  }
  function clearTransitionVisuals() {
    setPanoBlur(0);
    setOverlayOpacity(0);
    fadeCovered = false;
    transitionBusy = false;
    if (pano) pano.interactive = true;
  }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  async function ensureEventAssets(ev) {
    if (!ev || ev.kind !== "decision") return { waited: 0 };
    const v = ensureViewer();
    const need = [];
    const pu = panoUrl(ev.renderId);
    if (!v.cache.get(pu)) need.push(v.load(pu, "pano"));
    if (ev.boardId) {
      const bu = boardUrl(ev.boardId);
      if (!v.cache.get(bu)) need.push(v.load(bu, "board"));
    }
    if (!need.length) return { waited: 0 };
    const t0 = performance.now();
    await Promise.all(need);
    return { waited: Math.round(performance.now() - t0) };
  }
  /** Exit half: walk forward (yaw + zoom-in), blur and fade out. RT already stamped at key press. */
  async function playExitTransition(choice) {
    const dur = CONFIG.TRANS_MS;
    const next = peekNextEvent();
    const preload = await ensureEventAssets(next);
    setDecisionUI(false);
    choiceEnabled = false;
    if (!dur || dur <= 0 || !pano) {
      fadeCovered = false;
      transitionBusy = false;
      const pad = 150 - preload.waited;
      if (pad > 0) await sleep(pad);
      return { disabled: 1, preload_wait_ms: preload.waited };
    }
    transitionBusy = true;
    const outMs = Math.max(160, Math.round(dur * (CONFIG.TRANS_OUT_FRAC == null ? 0.55 : CONFIG.TRANS_OUT_FRAC)));
    const t0 = performance.now();
    logEvent("transition_start", {
      choice: choice, duration_ms: dur, out_ms: outMs, phase: "out",
      nextKind: next && next.kind || "", preload_wait_ms: preload.waited,
      base_hfov: CONFIG.HFOV, mid_hfov: CONFIG.TRANS_HFOV,
    });
    pano.interactive = false;
    const targetYaw = choice === "left" ? -CONFIG.TRANS_YAW : CONFIG.TRANS_YAW;
    const overlay = transOverlay();
    if (overlay) overlay.classList.add("on");
    try {
      await pano.animateTo({
        yaw: targetYaw, pitch: 0, hfov: CONFIG.TRANS_HFOV,
        duration: outMs, bobAmp: CONFIG.TRANS_BOB, bobCycles: CONFIG.TRANS_BOB_CYCLES,
        ease: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
      }, (t) => {
        const b = Math.max(0, Math.min(1, (t - 0.18) / 0.72));
        setPanoBlur(3.2 * b);
        const f = Math.max(0, Math.min(1, (t - 0.50) / 0.50));
        setOverlayOpacity(f * f);
      });
    } catch (err) {
      console.error("[transition]", err);
    }
    setPanoBlur(3.2);
    setOverlayOpacity(1);
    fadeCovered = true;
    logEvent("transition_end", {
      choice: choice, elapsed_ms: Math.round(performance.now() - t0),
      phase: "out", preload_wait_ms: preload.waited,
    });
    return { disabled: 0, preload_wait_ms: preload.waited, elapsed_ms: Math.round(performance.now() - t0), out_ms: outMs };
  }

  /**
   * Entry half: new scene loads under the white overlay starting slightly WIDE (base FOV + ~14°),
   * faded and blurred, then narrows to base FOV while fading in and sharpening — continues forward
   * motion (not zooming out / backing up). Exit half is unchanged (narrow mid zoom).
   * Choice keys stay ignored until this resolves; decision_onset is scheduled by the caller afterward.
   */
  async function playEnterTransition() {
    if (!fadeCovered) { transitionBusy = false; return { skipped: 1 }; }
    const dur = CONFIG.TRANS_MS > 0 ? CONFIG.TRANS_MS : 2200;
    const outFrac = CONFIG.TRANS_OUT_FRAC == null ? 0.55 : CONFIG.TRANS_OUT_FRAC;
    const inMs = Math.max(160, Math.round(dur * (1 - outFrac)));
    const enterHfov = CONFIG.TRANS_ENTER_HFOV != null ? CONFIG.TRANS_ENTER_HFOV : Math.min(140, CONFIG.HFOV + 14);
    const t0 = performance.now();
    transitionBusy = true;
    setDecisionUI(false);
    choiceEnabled = false;
    if (pano) {
      pano.interactive = false;
      // Start wide under the cover, then walk forward into base FOV
      pano.setView(CONFIG.START_YAW, CONFIG.START_PITCH, enterHfov);
    }
    setPanoBlur(3.2);
    setOverlayOpacity(1);
    const overlay = transOverlay();
    if (overlay) overlay.classList.add("on");
    logEvent("transition_start", {
      phase: "in", duration_ms: dur, in_ms: inMs,
      base_hfov: CONFIG.HFOV, enter_hfov: enterHfov, exit_mid_hfov: CONFIG.TRANS_HFOV,
    });
    try {
      if (pano) {
        await pano.animateTo({
          yaw: CONFIG.START_YAW, pitch: CONFIG.START_PITCH, hfov: CONFIG.HFOV,
          duration: inMs,
          bobAmp: CONFIG.TRANS_BOB * 0.7,
          bobCycles: Math.max(1.2, CONFIG.TRANS_BOB_CYCLES * 0.7),
          ease: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
        }, (t) => {
          const b = Math.max(0, 1 - Math.min(1, (t - 0.05) / 0.75));
          setPanoBlur(3.2 * b);
          const f = Math.max(0, 1 - Math.min(1, (t - 0.08) / 0.70));
          setOverlayOpacity(f * f);
        });
      } else {
        await sleep(inMs);
      }
    } catch (err) {
      console.error("[transition-in]", err);
    }
    setPanoBlur(0);
    setOverlayOpacity(0);
    fadeCovered = false;
    transitionBusy = false;
    if (pano) {
      pano.setView(CONFIG.START_YAW, CONFIG.START_PITCH, CONFIG.HFOV);
      pano.interactive = true;
    }
    logEvent("transition_end", { elapsed_ms: Math.round(performance.now() - t0), phase: "in", in_ms: inMs, enter_hfov: enterHfov });
    return { skipped: 0, in_ms: inMs, elapsed_ms: Math.round(performance.now() - t0) };
  }

  function startDecisionTrial(spec) {
    currentEvent = spec;
    resetResponseState();
    if (decisionTimer) { clearTimeout(decisionTimer); decisionTimer = null; }
    const label = spec.isPractice ? `Practice ${spec.trainingId}` : `Trial ${spec.trialIndex} of ${nTestDecisions}`;
    $("trial-badge").textContent = label;
    $("trial-hint").textContent = spec.destination ? `Destination: ${spec.destination}` : "Drag to look · then press ← or →";
    $("decision-prompt").textContent = spec.prompt;
    $("decision-sub").textContent = (spec.isPractice && !spec.boardId) ? spec.prompt
      : "You can look around with the mouse, and press ← or → to make a decision to turn.";
    $("task-header").textContent = spec.isPractice
      ? (spec.destination ? `Hospital Wayfinding Task: Practice · Find the way to ${spec.destination}` : "Hospital Wayfinding Task: Practice")
      : `Hospital Wayfinding Task: Find the way to ${spec.destination}`;
    showPanel("decision");
    updateProgress(spec);
    showScreen("trial");

    const v = ensureViewer();
    const pe = v.cache.get(panoUrl(spec.renderId));
    const be = spec.boardId ? v.cache.get(boardUrl(spec.boardId)) : null;
    const go = (pe2, be2) => {
      $("loading-overlay").classList.remove("visible", "error");
      // If mid-corridor, start slightly WIDE then narrow to base (forward); else open at base FOV.
      const entering = !!fadeCovered;
      const startHfov = entering
        ? (CONFIG.TRANS_ENTER_HFOV != null ? CONFIG.TRANS_ENTER_HFOV : Math.min(140, CONFIG.HFOV + 14))
        : CONFIG.HFOV;
      setDecisionUI(false);
      choiceEnabled = false;
      v.show(pe2, be2, { yaw: CONFIG.START_YAW, pitch: CONFIG.START_PITCH, hfov: startHfov }).then(async (tFrame) => {
        if (currentEvent !== spec) return;
        if (entering) await playEnterTransition();
        if (currentEvent !== spec) return;
        // Scene is fully visible only after entry finishes (or immediately if no transition).
        sceneOnsetPerf = performance.now();
        pushMarker("scene_onset", {
          renderId: spec.renderId, boardId: spec.boardId, frame_perf: +tFrame.toFixed(1),
          entered_via_transition: entering ? 1 : 0, hfov: CONFIG.HFOV,
        });
        // Decision-latency clock starts only once the new scene is fully visible.
        decisionTimer = setTimeout(() => {
          if (currentEvent !== spec || transitionBusy) return;
          decisionOnsetPerf = performance.now();
          setDecisionUI(true);
          pushMarker("decision_onset", {
            renderId: spec.renderId, boardId: spec.boardId, condition: spec.condition,
            note: "rt_clock_starts_after_entry_visible",
          });
        }, CONFIG.DECISION_DELAY_MS);
      });
    };
    if (pe && (!spec.boardId || be)) {
      go(pe, be);
    } else {
      // should not happen after preload; fall back to on-demand load
      console.warn("[trial] asset not resident, loading on demand", spec.renderId, spec.boardId);
      session.residencyMisses = (session.residencyMisses || 0) + 1;
      const overlay = $("loading-overlay");
      overlay.textContent = "Loading scene…";
      overlay.classList.add("visible");
      Promise.all([v.load(panoUrl(spec.renderId), "pano"), spec.boardId ? v.load(boardUrl(spec.boardId), "board") : null])
        .then(([a, b]) => { if (currentEvent === spec) go(a, b); })
        .catch((err) => { showLoadError("Could not load scene: " + (err && err.message)); console.error(err); });
    }
  }

  function startProbe(spec) {
    currentEvent = spec;
    resetResponseState();
    if (decisionTimer) { clearTimeout(decisionTimer); decisionTimer = null; }
    showPanel("probe");
    $("placeholder-text").textContent = `Which way did you turn ${CONFIG.PROBE_LAG} intersections ago?`;
    $("placeholder-sub").classList.remove("intro-lines");
    $("placeholder-sub").textContent = "";
    $("task-header").textContent = "Hospital Wayfinding Task: Recall";
    updateProgress(spec);
    $("trial-badge").textContent = "Recall probe";
    $("trial-hint").textContent = "Answer with ← or →";
    $("probe-prompt").textContent = `Which way did you turn ${CONFIG.PROBE_LAG} intersections ago?`;
    $("loading-overlay").classList.remove("visible", "error");
    showScreen("trial");
    const beginProbe = () => {
      if (currentEvent !== spec) return;
      decisionTimer = setTimeout(() => {
        decisionOnsetPerf = performance.now();
        setProbeUI(true);
        pushMarker("probe_onset", { probeLag: CONFIG.PROBE_LAG, referencedTrialIndex: spec.referencedTrialIndex });
      }, CONFIG.PROBE_DELAY_MS);
    };
    if (fadeCovered) playEnterTransition().then(beginProbe);
    else beginProbe();
  }

  function baseRow(ev) {
    return {
      participantId: session.participantId, mode: session.mode, seed: session.seed,
      conditionOrder: session.conditionOrder, condition: ev.condition || "", block: ev.block != null ? ev.block : "",
      blockPos: ev.blockPos != null ? ev.blockPos : "", trainingId: ev.trainingId || "",
      conditionPosition: ev.conditionPosition || "", blockOrder: ev.blockOrder || "",
      conditionName: ev.condition ? (COND_LABEL[ev.condition] || ev.condition) : "",
    };
  }

  function recordDecisionResponse(choice) {
    if (!choiceEnabled || responding || !currentEvent || decisionOnsetPerf == null) return;
    if (currentEvent.kind !== "decision") return;
    responding = true;
    choiceEnabled = false;
    $("btn-left").disabled = true;
    $("btn-right").disabled = true;
    const ev = currentEvent;
    const responsePerf = performance.now();
    const rt_ms = Math.round(responsePerf - decisionOnsetPerf);
    const b = ev.boardId ? BOARDS[ev.boardId] : null;
    pushMarker("response", { choice, rt_ms, trialType: "decision" });
    const row = {
      ...baseRow(ev),
      trialType: "decision",
      trialIndex: ev.trialIndex,
      isPractice: !!ev.isPractice,
      stimulusId: ev.renderId,
      conditionLabel: ev.condition + (ev.stimulusPlaceholder ? "_PLACEHOLDER" : ""),
      choice,
      correctDirection: ev.correctDirection,
      accuracy: ev.correctDirection ? (choice === ev.correctDirection ? 1 : 0) : "",
      rt_ms,
      scene_onset_perf: sceneOnsetPerf != null ? +sceneOnsetPerf.toFixed(1) : "",
      decision_onset_perf: +decisionOnsetPerf.toFixed(1),
      response_perf: +responsePerf.toFixed(1),
      yaw_at_response: +pano.getYaw().toFixed(2),
      pitch_at_response: +pano.getPitch().toFixed(2),
      probeLag: "",
      referencedTrialIndex: "",
      renderId: ev.renderId,
      intendedRenderId: ev.intendedRenderId || ev.renderId,
      stimulusPlaceholder: ev.stimulusPlaceholder ? 1 : 0,
      boardId: ev.boardId || "",
      boardFile: b ? b.png_file : "",
      destination: ev.destination || "",
      layout: b ? b.layout : "",
      cellId: b ? b.cell_id : "",
      congruence: b ? b.congruence : "",
      targetRow: b ? b.target_row : "",
      cueType: b ? b.cue_type : "",
      legacySceneId: LEGACY_SCENE_ID[ev.renderId] || "",
      panoRes: CONFIG.RES,
      timestamp: isoNow(),
    };
    session.trials.push(row);
    console.log("[trial]", row);
    if (!ev.isPractice) decisionChoicesByIndex[ev.trialIndex] = choice;
    syncResidency(); // evict this scene, upload the one GPU_WINDOW trials ahead, during the transition
    Promise.resolve()
      .then(() => playExitTransition(choice))
      .catch((err) => { console.error("[transition]", err); clearTransitionVisuals(); })
      .then(() => {
        resetResponseState();
        advance();
      });
  }

  function recordProbeResponse(choice) {
    if (!choiceEnabled || responding || !currentEvent || decisionOnsetPerf == null) return;
    if (currentEvent.kind !== "probe") return;
    responding = true;
    choiceEnabled = false;
    $("btn-probe-left").disabled = true;
    $("btn-probe-right").disabled = true;
    const ev = currentEvent;
    const responsePerf = performance.now();
    const rt_ms = Math.round(responsePerf - decisionOnsetPerf);
    const correct = decisionChoicesByIndex[ev.referencedTrialIndex] || null;
    pushMarker("probe_response", { choice, rt_ms, referencedTrialIndex: ev.referencedTrialIndex });
    const row = {
      ...baseRow(ev),
      trialType: "recall_probe",
      trialIndex: ev.trialIndex,
      isPractice: false,
      stimulusId: "",
      conditionLabel: "",
      choice,
      correctDirection: correct != null ? correct : "",
      accuracy: correct != null ? (choice === correct ? 1 : 0) : "",
      rt_ms,
      decision_onset_perf: +decisionOnsetPerf.toFixed(1),
      response_perf: +responsePerf.toFixed(1),
      yaw_at_response: "",
      probeLag: CONFIG.PROBE_LAG,
      referencedTrialIndex: ev.referencedTrialIndex,
      timestamp: isoNow(),
    };
    session.trials.push(row);
    console.log("[probe]", row);
    setTimeout(() => { resetResponseState(); advance(); }, 350);
  }

  function advance() {
    if (eventQueue.length === 0) {
      currentEvent = null;
      const r = segmentDone; segmentDone = null;
      if (r) r();
      return;
    }
    const next = eventQueue.shift();
    if (next.kind === "probe") startProbe(next);
    else if (next.kind === "blockIntro") startBlockIntro(next);
    else startDecisionTrial(next);
  }

  /* ================= session timeline (v4) ================= */
  const pageHost = () => $("page-host");

  function setPhase(name, extra) {
    if (currentPhase && currentPhase !== name) logEvent("phase_end", { endedPhase: currentPhase });
    currentPhase = name;
    logEvent("phase_start", extra || {});
  }

  /** a simple page with HTML body and buttons; resolves with the id of the button pressed */
  function page(html, buttons, opts) {
    return new Promise((resolve) => {
      const o = opts || {};
      pageHost().innerHTML = `<div class="page ${o.cls || ""}">${html}<div class="btn-row">` +
        buttons.map((b) => `<button type="button" data-btn="${b.id}" class="${b.cls || ""}" ${b.disabled ? "disabled" : ""}>${escapeHtml(b.label)}</button>`).join("") +
        `</div></div>`;
      showScreen("page");
      if (o.onShow) o.onShow(pageHost());
      pageHost().querySelectorAll("button[data-btn]").forEach((el) => el.addEventListener("click", () => {
        if (o.validate && !o.validate(el.dataset.btn)) return;
        resolve(el.dataset.btn);
      }));
    });
  }

  async function survey(instId, administration, stepLabel, extra) {
    const inst = INSTR[instId];
    if (CONFIG.SKIP_Q) { logEvent("questionnaire_skipped", { instrument: instId, administration }); return null; }
    showScreen("page");
    logEvent("questionnaire_onset", { instrument: instId, administration });
    const res = await window.WFSurvey.run(pageHost(), inst, {
      stepLabel, rnd: surveyRnd, onEvent: (t, x) => logEvent(t, x),
    });
    const ctx = { participantId: session.participantId, seed: session.seed, conditionOrder: session.conditionOrder,
      phase: currentPhase, administration, ...(extra || {}) };
    res.rows.forEach((r) => session.responses.push({ ...ctx, ...r }));
    const sc = SCORE[instId] ? SCORE[instId](res.values, { screenItem13Excludes: CONFIG.SCREEN_ITEM13_EXCLUDES }) : {};
    session.scores.push({ ...ctx, instrument: instId, duration_ms: res.duration_ms,
      presentedOrder: res.presentedOrder.join(" "), submit_time: res.rows.length ? res.rows[0].submit_time : isoNow(), ...sc });
    logEvent("questionnaire_offset", { instrument: instId, administration, duration_ms: res.duration_ms });
    autosave(instId + "_" + administration);
    return { ...res, score: sc };
  }

  async function surveySet(list, administration, extra) {
    const ids = CONFIG.SHOW_SAM ? list : list.filter((id) => id !== "SAM");
    for (let i = 0; i < ids.length; i++) await survey(ids[i], administration, "", extra);
  }

  function splitQueueByBlocks(queue) {
    const blocks = [];
    let cur = [];
    queue.forEach((ev) => {
      if (ev.kind === "blockIntro" && cur.length) { blocks.push(cur); cur = []; }
      cur.push(ev);
    });
    if (cur.length) blocks.push(cur);
    return blocks;
  }

  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function pct(n, d) { return d ? r1((100 * n) / d) : null; }

  /** Performance numbers shown to the participant for one condition (own data only; no norms). */
  function conditionPerformance(condition, pos) {
    const dec = session.trials.filter((t) => t.trialType === "decision" && !t.isPractice && t.condition === condition);
    const probes = session.trials.filter((t) => t.trialType === "recall_probe" && t.condition === condition);
    const nCorrect = dec.filter((t) => t.accuracy === 1).length;
    const nDec = dec.length;
    const meanMs = nDec ? dec.reduce((s, t) => s + t.rt_ms, 0) / nDec : null;
    const nProbeOk = probes.filter((t) => t.accuracy === 1).length;
    const blockKeys = [];
    dec.forEach((t) => {
      const k = t.blockOrder || t.block;
      if (!blockKeys.includes(k)) blockKeys.push(k);
    });
    const blocks = blockKeys.map((k) => {
      const d = dec.filter((t) => (t.blockOrder || t.block) === k);
      const p = probes.filter((t) => (t.blockOrder || t.block) === k);
      const ok = d.filter((t) => t.accuracy === 1).length;
      const pok = p.filter((t) => t.accuracy === 1).length;
      return {
        block: d[0] ? d[0].block : k,
        blockOrder: d[0] ? d[0].blockOrder : k,
        destination: d[0] ? d[0].destination : "",
        n_decisions: d.length,
        n_correct: ok,
        pct_correct: pct(ok, d.length),
        mean_decision_latency_s: d.length ? r2(d.reduce((s, t) => s + t.rt_ms, 0) / d.length / 1000) : null,
        n_probes: p.length,
        n_probes_correct: pok,
        pct_probes_correct: pct(pok, p.length),
      };
    });
    return {
      condition,
      conditionName: COND_LABEL[condition] || condition,
      conditionPosition: pos,
      n_decisions: nDec,
      n_correct: nCorrect,
      pct_correct: pct(nCorrect, nDec),
      mean_decision_latency_s: meanMs != null ? r2(meanMs / 1000) : null,
      n_probes: probes.length,
      n_probes_correct: nProbeOk,
      pct_probes_correct: pct(nProbeOk, probes.length),
      blocks,
    };
  }

  function restScreen(label, durationS) {
    const dur = durationS != null ? durationS : CONFIG.REST_S;
    if (!dur) return Promise.resolve();
    return new Promise((resolve) => {
      const t0 = performance.now();
      logEvent("rest_onset", { label, duration_s: dur });
      pageHost().innerHTML = `<div class="page rest"><div class="fixation">+</div>
        <p class="hint">Please sit still, relax, and look at the cross. The screen will continue automatically.</p>
        <p class="hint exp-note">Experimenter: Esc skips.</p></div>`;
      showScreen("page");
      let tm = null;
      const end = (skipped) => {
        clearTimeout(tm); document.removeEventListener("keydown", onKey);
        logEvent("rest_offset", { label, skipped: skipped ? 1 : 0, actual_ms: Math.round(performance.now() - t0) });
        resolve();
      };
      const onKey = (e) => { if (e.key === "Escape") end(true); };
      document.addEventListener("keydown", onKey);
      tm = setTimeout(() => end(false), dur * 1000);
    });
  }

  function runSegment(queue, later) {
    return new Promise((resolve) => {
      eventQueue = queue.slice();
      pendingSegments = later || [];
      segmentDone = resolve;
      syncResidency();
      advance();
    });
  }

  /* ---------- individual steps ---------- */
  function beginSession(typedId) {
    const typed = (typedId || "").trim().replace(/[^A-Za-z0-9_-]/g, "");
    session.participantId = typed || uid();
    session.participantIdSource = typed ? "experimenter" : "auto_crypto";
    session.idAlphabet = typed ? "experimenter_charset" : "crockford_base32";
    session.idLength = session.participantId.length;
    session.seed = params.has("seed") ? (+params.get("seed") >>> 0) : crypto.getRandomValues(new Uint32Array(1))[0];
    session.startedAt = isoNow();
    surveyRnd = mulberry32((session.seed ^ 0x5a5a1234) >>> 0); // questionnaire item shuffles (SAS), separate stream
    const { practice, condQueues, conds, plan } = buildPlan(session.seed);
    session.plan = plan;
    session.conditionOrder = plan.order;
    session.conditionOrderSource = plan.orderSource;
    logEvent("session_start", { participantIdSource: session.participantIdSource, seed: session.seed,
      conditionOrder: plan.order, conditionOrderSource: plan.orderSource, idBit: idHashBit(session.participantId),
      startedAt: session.startedAt, stressMode: CONFIG.STRESS_MODE,
      showSam: CONFIG.SHOW_SAM ? 1 : 0, showSummary: CONFIG.SHOW_SUMMARY ? 1 : 0, endMath: CONFIG.END_MATH ? 1 : 0,
      wordingVersion: CONFIG.WORDING_VERSION });
    pendingSegments = [practice].concat(condQueues.map((c) => c.queue)); // GPU look-ahead for the first window
    preloadPromise = preloadAll(sessionAssetUrls([practice].concat(condQueues.map((c) => c.queue))));
    preloadPromise.catch((err) => console.error("[preload]", err));
    return { practice, condQueues, conds };
  }

  async function stepSetup() {
    setPhase("setup");
    const fileWarn = location.protocol === "file:"
      ? '<p class="protocol-warn">Opened as a file. Run <code>python3 tools/server.py</code> (or <code>python3 -m http.server 8080</code>) and open http://localhost:8080/.</p>'
      : "";
    const urlPid = (params.get("pid") || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24);
    if (mode === "lab") {
      await page(`
        <h2>Hospital Wayfinding Study</h2>
        <p class="exp-note">Experimenter setup. Enter a study code if you have one (no names or initials), or leave this blank and the session will assign a unique ID.</p>
        <div class="field"><label for="participant-id">Participant ID (optional)</label>
          <input id="participant-id" type="text" autocomplete="off" maxlength="24" placeholder="assigned automatically if blank" value="${urlPid.replace(/"/g, "")}" /></div>
        ${fileWarn}`,
        [{ id: "go", label: "Start session", disabled: location.protocol === "file:" }],
        { onShow: (h) => { const i = h.querySelector("#participant-id"); if (i) i.focus(); } });
      const typed = ($("participant-id") && $("participant-id").value) || "";
      return beginSession(typed || urlPid);
    }
    await page(`
      <h2>Hospital Wayfinding Study</h2>
      <p>Click Begin to start.</p>
      ${fileWarn}`,
      [{ id: "go", label: "Begin", disabled: location.protocol === "file:" }]);
    return beginSession(urlPid);
  }

  async function stepIntro() {
    setPhase("intro");
    logEvent("intro_shown", { wordingVersion: CONFIG.WORDING_VERSION });
    const t0 = performance.now();
    const nearby = mode === "lab"
      ? " The experimenter will be nearby if you have questions."
      : "";
    await page(`
      <h2>Welcome</h2>
      <p>Thank you for taking part in this study. In this session you will complete a hospital wayfinding task on the computer, along with a few brief questionnaires about how you feel and how you find your way.</p>
      <p>The session has several parts:</p>
      <ul class="intro-list">
        <li>A short set of questions about how you feel today.</li>
        <li>A few practice intersections so you can get used to the controls.</li>
        <li>Two wayfinding parts, each with several destinations in a hospital environment.</li>
        <li>A few questionnaires at the end of the session.</li>
      </ul>
      <p>You will go through a series of intersections, and at each one you will be asked to select a direction (left or right). Please try to make your decision as soon as you can, while still trying to be accurate.${nearby}</p>
      <p class="privacy-note"><strong>Nothing that identifies you is collected. You are known in the data only by a study code.</strong></p>
      ${document.body.classList.contains("debug") ? `<p class="exp-note draft-note">DRAFT wording (${CONFIG.WORDING_VERSION}) — confirm before use.</p>` : ""}`,
      [{ id: "go", label: "Continue" }]);
    logEvent("intro_dismissed", { viewing_ms: Math.round(performance.now() - t0) });
  }

  async function stepConsent() {
    setPhase("consent");
    logEvent("consent_shown");
    const btn = await page(`
      <h2>Information and consent</h2>
      <div class="irb-placeholder">
        <p><strong>[PLACEHOLDER: IRB protocol number]</strong></p>
        <p><strong>[PLACEHOLDER: study title]</strong></p>
        <p><strong>[PLACEHOLDER: principal investigator and contact information]</strong></p>
        <p><strong>[PLACEHOLDER: IRB-approved consent text: purpose, procedures, duration, risks, benefits, voluntary participation and withdrawal, confidentiality, compensation, contacts]</strong></p>
      </div>
      <div class="field"><label for="consent-date">Date (any format)</label>
        <input id="consent-date" type="text" autocomplete="off" maxlength="80" placeholder="e.g. 9 November 2026" /></div>
      <p>If you agree to take part, select <em>I agree</em>. If you do not agree, select <em>I do not agree</em> and the session will end.</p>
      <p class="survey-err" id="consent-date-err" hidden>Please enter the date before continuing.</p>`,
      [{ id: "agree", label: "I agree – Continue" }, { id: "decline", label: "I do not agree", cls: "secondary" }],
      { validate: (id) => {
        if (id !== "agree") return true;
        const v = (($("consent-date") && $("consent-date").value) || "").trim();
        const err = $("consent-date-err");
        if (!v) { if (err) err.hidden = false; return false; }
        if (err) err.hidden = true;
        return true;
      } });
    const dateEntered = (($("consent-date") && $("consent-date").value) || "").trim();
    session.consent = { decision: btn === "agree" ? "agreed" : "declined", timestamp: isoNow(), perf: +performance.now().toFixed(1),
      text_version: "PLACEHOLDER (no IRB text yet)", dateEntered };
    logEvent(btn === "agree" ? "consent_agreed" : "consent_declined", { dateEntered });
    autosave("consent");
    return btn === "agree";
  }

  async function stepToday() {
    setPhase("today_state");
    await survey("TODAY", "today", "");
    return true;
  }

  async function stepExperimenter(title, text, evt) {
    setPhase(evt);
    await page(`<h2>${escapeHtml(title)}</h2><p class="exp-note">${escapeHtml(text)}</p>`, [{ id: "ok", label: "Continue" }]);
    logEvent(evt + "_done");
  }

  async function stepTaskInstructions() {
    setPhase("task_instructions");
    showScreen("instructions");
    const st = $("preload-status"), btn = $("btn-to-practice");
    btn.disabled = true;
    btn.textContent = "Loading…";
    try {
      await preloadPromise;
      if (st) { st.textContent = ""; st.hidden = true; }
      btn.textContent = "Start practice";
      btn.disabled = false;
    } catch (err) {
      if (st) {
        st.hidden = false;
        st.textContent = "Could not load scenes: " + (err && err.message) + " — serve with python3 tools/server.py, not file://";
      }
      btn.textContent = "Start practice";
      logEvent("preload_error", { message: String(err && err.message) });
      throw err;
    }
    await new Promise((res) => btn.addEventListener("click", res, { once: true }));
    logEvent("task_instructions_done");
  }

  async function stepLiveStress() {
    setPhase("stress_instructions");
    await page(`<h2>Arithmetic task</h2>
      <p>In the next task you will count backwards from <strong>${CONFIG.STRESS.START}</strong> in steps of <strong>${CONFIG.STRESS.STEP}</strong>.</p>
      <p>Type each answer and press Enter. Please answer as quickly and accurately as you can. There is a time limit for each answer.
      If you make a mistake or run out of time, you will start again from ${CONFIG.STRESS.START}.</p>
      <p>The task lasts about ${Math.max(1, Math.round(CONFIG.STRESS.DURATION_S / 60))} minute(s).</p>
      ${document.body.classList.contains("debug") ? `<p class="exp-note draft-note">DRAFT wording (${CONFIG.WORDING_VERSION}). Legacy live-stress module (?liveStress=1).</p>` : ""}`,
      [{ id: "go", label: "Start" }]);
    setPhase("stress_induction", { config: CONFIG.STRESS });
    showScreen("page");
    session.stress.live = await window.WFStress.run(pageHost(), CONFIG.STRESS, (t, x) => logEvent(t, x));
    autosave("stress");
  }

  async function stepPrep(variant) {
    setPhase(variant === "first" ? "prep_1" : "prep_2", { variant, duration_s: CONFIG.PREP_S });
    showScreen("page");
    const result = await window.WFStress.runPrep(pageHost(), {
      DURATION_S: CONFIG.PREP_S, variant, wordingVersion: CONFIG.WORDING_VERSION,
    }, (t, x) => logEvent(t, x));
    session.stress.preps.push(result);
    autosave("prep_" + variant);
  }

  function mistCfg(extra) {
    return Object.assign({
      DURATION_S: CONFIG.MIST_S,
      PRACTICE_S: CONFIG.MIST_PRACTICE_S,
      AVERAGE_PCT: CONFIG.MIST_AVG,
      EVAL_MESSAGES: CONFIG.MIST_EVAL_MESSAGES,
      wordingVersion: CONFIG.WORDING_VERSION,
      seed: (session.seed || 1) * 10007,
      state: session.stress.mist.state,
    }, extra || {});
  }

  async function stepMist(variant) {
    const first = variant === "first";
    const draft = document.body.classList.contains("debug")
      ? `<p class="exp-note draft-note">DRAFT wording (${CONFIG.WORDING_VERSION}). MIST-style task after Dedovic et al. (2005). Experimenter: Esc skips a segment.</p>`
      : "";
    if (first) {
      setPhase("mist_instructions_1");
      const practiceNote = CONFIG.MIST_PRACTICE_S > 0
        ? `<p>First you will have a short practice with no time limit. After that, each problem will be timed.</p>`
        : `<p>Each problem will be timed.</p>`;
      await page(`<h2>Mental arithmetic</h2>
        <p>You will now complete a short mental arithmetic task. Solve each problem in your head and enter a single-digit answer (0–9) by clicking a number on the dial or pressing a number key.</p>
        ${practiceNote}
        <p>Please work as quickly and accurately as you can.</p>
        ${draft}`, [{ id: "go", label: CONFIG.MIST_PRACTICE_S > 0 ? "Start practice" : "Start" }]);
      if (CONFIG.MIST_PRACTICE_S > 0 && !session.stress.mist.practice) {
        setPhase("mist_practice", { duration_s: CONFIG.MIST_PRACTICE_S });
        showScreen("page");
        session.stress.mist.practice = await window.WFStress.runMist(pageHost(), mistCfg({ phase: "practice", variant: "practice" }), (t, x) => logEvent(t, x));
        autosave("mist_practice");
      }
      setPhase("mist_ready_1");
      await page(`<h2>Timed problems</h2>
        <p>The timed arithmetic task will now begin. Each problem has a time limit. A bar will show your performance compared with average performance.</p>
        <p>Please work as quickly and accurately as you can.</p>
        ${draft}`, [{ id: "go", label: "Start" }]);
    } else {
      setPhase("mist_instructions_2");
      await page(`<h2>Mental arithmetic</h2>
        <p>You will now complete the mental arithmetic task again. Each problem is timed. Please work as quickly and accurately as you can.</p>
        ${draft}`, [{ id: "go", label: "Start" }]);
    }
    const phaseName = first ? "mist_1" : "mist_2";
    setPhase(phaseName, { variant: variant, duration_s: CONFIG.MIST_S, average_pct: CONFIG.MIST_AVG });
    showScreen("page");
    const seg = await window.WFStress.runMist(pageHost(), mistCfg({ phase: "experimental", variant: variant }), (t, x) => logEvent(t, x));
    session.stress.mist.segments.push(seg);
    autosave(phaseName);
  }

  /** Default: MIST. Legacy anticipatory prep (?prep=1) or live subtraction (?liveStress=1). */
  async function stepInduction(variant) {
    if (CONFIG.STRESS_MODE === "mist") {
      await stepMist(variant);
    } else if (CONFIG.STRESS_MODE === "live") {
      // The live module is used at the first induction point; the second point stays anticipatory.
      if (variant === "first") await stepLiveStress();
      else await stepPrep(variant);
    } else {
      await stepPrep(variant);
    }
  }

  async function stepDebrief() {
    const copy = (window.WFStress && window.WFStress.DEBRIEF_COPY) || { title: "Debriefing", html: "<p>[PLACEHOLDER: IRB-approved debrief text.]</p>" };
    setPhase("debrief");
    await page(`<h2>${copy.title}</h2>${copy.html}`, [{ id: "go", label: "Continue" }], { cls: "debrief-page" });
    session.stress.debriefShown = true;
    logEvent("debrief_shown", { wordingVersion: CONFIG.WORDING_VERSION, stressMode: CONFIG.STRESS_MODE });
    // Await so this checkpoint cannot race/overwrite the final "complete" save on Drive.
    await autosave("debrief");
  }

  function fmtLatency(s) { return s == null ? "—" : s.toFixed(2) + " s"; }
  function fmtCount(n, d, p) {
    if (!d) return "—";
    return `${n} of ${d}` + (p != null ? ` (${p}%)` : "");
  }

  function performanceCardHTML(stats, pos, nParts) {
    const blockRows = stats.blocks.map((b) =>
      `<tr><td>${escapeHtml(b.destination || ("Block " + b.block))}</td>` +
      `<td>${fmtCount(b.n_correct, b.n_decisions, b.pct_correct)}</td>` +
      `<td>${fmtLatency(b.mean_decision_latency_s)}</td>` +
      `<td>${fmtCount(b.n_probes_correct, b.n_probes, b.pct_probes_correct)}</td></tr>`).join("");
    return `<div class="perf-card">
        <h2>Your results — Part ${pos} of ${nParts}</h2>
        <p class="perf-lead">Here is a summary of your wayfinding performance in this part. These numbers are from your own responses only.</p>
        <div class="perf-stats">
          <div class="perf-stat"><div class="val">${fmtLatency(stats.mean_decision_latency_s)}</div><div class="lbl">Average decision time</div></div>
          <div class="perf-stat"><div class="val">${stats.n_decisions ? stats.pct_correct + "%" : "—"}</div><div class="lbl">Correct direction choices<br>${fmtCount(stats.n_correct, stats.n_decisions, null)}</div></div>
          <div class="perf-stat"><div class="val">${stats.n_probes ? stats.pct_probes_correct + "%" : "—"}</div><div class="lbl">Recall questions correct<br>${fmtCount(stats.n_probes_correct, stats.n_probes, null)}</div></div>
        </div>
        ${stats.blocks.length ? `<table class="perf-blocks"><thead><tr><th>Destination</th><th>Direction choices</th><th>Average time</th><th>Recall</th></tr></thead><tbody>${blockRows}</tbody></table>` : ""}
      </div>`;
  }

  /** Overall stats across both conditions (own data only). */
  function overallPerformance() {
    const dec = session.trials.filter((t) => t.trialType === "decision" && !t.isPractice);
    const probes = session.trials.filter((t) => t.trialType === "recall_probe");
    const nCorrect = dec.filter((t) => t.accuracy === 1).length;
    const nDec = dec.length;
    const meanMs = nDec ? dec.reduce((s, t) => s + t.rt_ms, 0) / nDec : null;
    const nProbeOk = probes.filter((t) => t.accuracy === 1).length;
    return {
      scope: "overall",
      condition: "Overall",
      conditionName: "Overall",
      conditionPosition: 0,
      n_decisions: nDec,
      n_correct: nCorrect,
      pct_correct: pct(nCorrect, nDec),
      mean_decision_latency_s: meanMs != null ? r2(meanMs / 1000) : null,
      n_probes: probes.length,
      n_probes_correct: nProbeOk,
      pct_probes_correct: pct(nProbeOk, probes.length),
      blocks: [],
    };
  }

  /**
   * Fill session.summaries with: 1 overall row, 1 row per condition (with blocks[]),
   * and 1 row per destination block. Safe to call more than once (rebuilds).
   */
  function ensureSummaries(conds) {
    const list = (conds && conds.length) ? conds : condsFromPlan();
    const rows = [overallPerformance()];
    list.forEach((cond, i) => {
      const stats = conditionPerformance(cond, i + 1);
      rows.push(Object.assign({ scope: "condition" }, stats));
      (stats.blocks || []).forEach((b, bi) => {
        rows.push({
          scope: "block",
          condition: cond,
          conditionName: (COND_LABEL[cond] || cond) + " · " + (b.destination || ("Block " + (bi + 1))),
          conditionPosition: i + 1,
          n_decisions: b.n_decisions,
          n_correct: b.n_correct,
          pct_correct: b.pct_correct,
          mean_decision_latency_s: b.mean_decision_latency_s,
          n_probes: b.n_probes,
          n_probes_correct: b.n_probes_correct,
          pct_probes_correct: b.pct_probes_correct,
          blocks: [b],
          block: b.block,
          blockOrder: b.blockOrder,
          destination: b.destination || "",
        });
      });
    });
    session.summaries = rows;
    return list;
  }

  /** Build Part 1 / Part 2 HTML cards (no condition names shown) and ensure summaries are stored. */
  function collectSummaries(conds) {
    const list = ensureSummaries(conds);
    const nParts = list.length;
    return list.map((cond, i) => {
      const stats = session.summaries.find((s) => s.scope === "condition" && s.condition === cond && s.conditionPosition === i + 1)
        || conditionPerformance(cond, i + 1);
      return performanceCardHTML(stats, i + 1, nParts);
    }).join("");
  }

  async function stepCondition(c, pos, later, nParts) {
    const parts = nParts || 2;
    setPhase(`condition_${pos === 1 ? "A" : "B"}`, { condition: c.condition, conditionName: COND_LABEL[c.condition] });
    await page(`<h2>Part ${pos} of ${parts}</h2>
      <p>In this part you will find your way to three destinations in the hospital, one after another.
      Before each destination you will see a short instruction.</p>`, [{ id: "go", label: "Continue" }]);
    logEvent("condition_onset", { condition: c.condition, conditionPosition: pos });
    const blocks = splitQueueByBlocks(c.queue);
    for (let bi = 0; bi < blocks.length; bi++) {
      const laterSegs = blocks.slice(bi + 1).concat(later || []);
      await runSegment(blocks[bi], laterSegs);
      const ev0 = blocks[bi][0] || {};
      setPhase(`post_block_${pos === 1 ? "A" : "B"}`, {
        condition: c.condition, block: ev0.block, blockOrder: ev0.blockOrder, destination: ev0.destination || "",
      });
      await survey("VAS", `post_block_${pos}_${ev0.blockOrder || bi + 1}`, "After this destination", {
        condition: c.condition, conditionName: COND_LABEL[c.condition], conditionPosition: pos,
        block: ev0.block, blockOrder: ev0.blockOrder, destination: ev0.destination || "",
      });
    }
    // Performance summary is shown once at the end (debrief), not after each condition.
    logEvent("condition_offset", { condition: c.condition, conditionPosition: pos });
    autosave("condition_" + pos);
  }

  async function stepEndMath() {
    if (!CONFIG.END_MATH) return;
    setPhase("end_math_instructions");
    await page(`<h2>Arithmetic task</h2>
      <p>You will now complete the short mental arithmetic task you prepared for.</p>
      <p>Count backwards from <strong>${CONFIG.STRESS.START}</strong> in steps of <strong>${CONFIG.STRESS.STEP}</strong>.
      Type each answer and press Enter. The task is timed and scored, and lasts about ${Math.max(1, Math.round(CONFIG.END_MATH_S / 60))} minute(s).
      Please work as quickly and accurately as you can.</p>
      ${document.body.classList.contains("debug") ? `<p class="exp-note draft-note">DRAFT wording (${CONFIG.WORDING_VERSION}). No failure feedback.</p>` : ""}`,
      [{ id: "go", label: "Start" }]);
    setPhase("end_math", { duration_s: CONFIG.END_MATH_S });
    showScreen("page");
    session.stress.endMath = await window.WFStress.runQuiet(pageHost(), {
      START: CONFIG.STRESS.START, STEP: CONFIG.STRESS.STEP, DURATION_S: CONFIG.END_MATH_S,
    }, (t, x) => logEvent(t, x));
    autosave("end_math");
  }

  async function stepInterview() {
    if (!CONFIG.INTERVIEW) return;
    setPhase("interview");
    const btn = await page(`<h2>Post-session interview (optional, experimenter)</h2>
      <p class="exp-note">Ask the participant, then type brief notes. Do not record names or other identifying details.</p>
      <div class="field"><label for="iv-q1">1. Which part (condition) did you find easier, and why?</label><textarea id="iv-q1" rows="3"></textarea></div>
      <div class="field"><label for="iv-q2">2. What helped you find your way?</label><textarea id="iv-q2" rows="3"></textarea></div>
      <div class="field"><label for="iv-q3">Other notes</label><textarea id="iv-q3" rows="2"></textarea></div>`,
      [{ id: "save", label: "Save notes and continue" }, { id: "skip", label: "Skip", cls: "secondary" }]);
    session.interview = btn === "skip" ? { skipped: true, timestamp: isoNow() } : {
      skipped: false, timestamp: isoNow(), prompts_version: "DRAFT wording (confirm with Moj)",
      q1_easier_condition: $("iv-q1").value, q2_what_helped: $("iv-q2").value, notes: $("iv-q3").value };
    logEvent("interview_" + (btn === "skip" ? "skipped" : "saved"));
  }

  async function runSession() {
    const s = await stepSetup();
    await stepIntro();
    if (!(await stepConsent())) return finishSession("consent_declined");
    await stepToday();
    setPhase("baseline");
    await surveySet(["VAS", "SAM", "STICSA_S", "STICSA_T"], "baseline");
    if (mode === "lab") {
      await stepExperimenter("Equipment setup", "Experimenter: fit and check the EEG/ECG equipment, then press Continue.", "equipment_setup");
      setPhase("rest_baseline"); await restScreen("baseline", CONFIG.REST_BASELINE_S);
    }
    await stepTaskInstructions();
    setPhase("practice");
    await runSegment(s.practice, s.condQueues.map((c) => c.queue));
    await stepInduction("first");
    setPhase("post_mist_1");
    await surveySet(["VAS"], "post_mist_1");
    const nParts = s.condQueues.length;
    for (let i = 0; i < s.condQueues.length; i++) {
      const c = s.condQueues[i];
      await stepCondition(c, i + 1, s.condQueues.slice(i + 1).map((x) => x.queue), nParts);
      setPhase(`post_condition_${i === 0 ? "A" : "B"}`, { condition: c.condition });
      await surveySet(["VAS", "SAM", "STICSA_S", "TLX"], i === 0 ? "post_condition_A" : "post_condition_B",
        { condition: c.condition, conditionName: COND_LABEL[c.condition], conditionPosition: i + 1 });
      if (i < s.condQueues.length - 1) {
        if (CONFIG.REST_BETWEEN_S) { setPhase("rest_between"); await restScreen("between_conditions", CONFIG.REST_BETWEEN_S); }
        await stepInduction("second");
        setPhase("post_mist_2");
        await surveySet(["VAS"], "post_mist_2");
      }
    }
    setPhase("post_experiment");
    await surveySet(["SBSOD", "SAS", "EHI", "DEMO"], "post_experiment");
    // MRT: UNDECIDED (CONFIG.MRT = "pending"). Disabled module slot; no MRT items are included in v4.
    if (CONFIG.MRT !== "pending") logEvent("mrt_slot", { status: CONFIG.MRT });
    else logEvent("mrt_slot", { status: "pending_disabled" });
    await stepEndMath();
    await stepInterview();
    await stepDebrief();
    finishSession("completed");
  }

  /* ---------------- end + export ---------------- */
  function condsFromPlan() {
    if (session.plan && session.plan.order) {
      return session.plan.order.split("").map((c) => (c === "N" ? "Nature" : "Abstract"));
    }
    const seen = [];
    session.trials.forEach((t) => {
      if (t.trialType === "decision" && !t.isPractice && t.condition && seen.indexOf(t.condition) < 0) seen.push(t.condition);
    });
    return seen;
  }

  function finishSession(reason) {
    setPhase("end");
    session.completedAt = isoNow();
    session.endReason = reason;
    logEvent("session_end", { reason });
    const decisions = session.trials.filter((t) => t.trialType === "decision" && !t.isPractice);
    const probes = session.trials.filter((t) => t.trialType === "recall_probe");
    const nAcc = decisions.filter((t) => t.accuracy === 1).length;
    const meanRt = decisions.length ? Math.round(decisions.reduce((s, t) => s + t.rt_ms, 0) / decisions.length) : 0;
    const nProbeAcc = probes.filter((t) => t.accuracy === 1).length;
    const thanks = reason === "completed" ? "Thank you, the session is complete." :
      reason === "consent_declined" ? "You chose not to take part. Thank you for your time." : "Thank you. The session has ended.";
    $("end-thanks").textContent = thanks;

    const debrief = $("end-debrief");
    const results = $("end-results");
    if (debrief) {
      // The full MIST/IRB debrief is its own screen (stepDebrief), shown before these results.
      debrief.innerHTML = "";
    }
    // Always compute & store summaries (overall + per condition + per block) before the final save,
    // even if the on-screen cards are hidden.
    const conds = condsFromPlan();
    ensureSummaries(conds);
    if (results) {
      if (CONFIG.SHOW_SUMMARY && reason === "completed" && decisions.length) {
        results.innerHTML = collectSummaries(conds);
        logEvent("performance_summary_shown", { at: "end", nParts: conds.length, nSummaryRows: session.summaries.length });
      } else {
        results.innerHTML = "";
        logEvent("performance_summary_stored", { at: "end", shown: 0, nSummaryRows: session.summaries.length });
      }
    }

    const exp = $("end-experimenter");
    if (exp) exp.hidden = !(mode === "lab" || DEBUG);
    if ((mode === "lab" || DEBUG) && $("end-summary")) {
      $("end-summary").innerHTML = `
      <div><strong>Participant:</strong> <code>${escapeHtml(session.participantId || "(none)")}</code> · seed <code>${session.seed}</code> · end: <code>${reason}</code> · started <code>${escapeHtml(session.startedAt || "")}</code></div>
      <div><strong>Mode:</strong> <code>${session.mode}</code> · order <code>${session.conditionOrder}</code> (${session.conditionOrderSource}) · Poster <code>${session.abstractMode}</code></div>
      <div><strong>Test decisions:</strong> ${decisions.length} · accuracy ${nAcc}/${decisions.length} · mean RT ${meanRt} ms</div>
      <div><strong>Recall probes:</strong> ${probes.length} · accuracy ${nProbeAcc}/${probes.length}</div>
      <div><strong>Questionnaire items:</strong> ${session.responses.length} · administrations ${session.scores.length}</div>
      <div><strong>Summaries:</strong> ${session.summaries.length} rows · completedAt <code>${escapeHtml(session.completedAt || "")}</code></div>
      <div><strong>Stress:</strong> mode <code>${CONFIG.STRESS_MODE}</code> · MIST items ${((session.stress.mist && session.stress.mist.practice && session.stress.mist.practice.responses) || []).length + (session.stress.mist && session.stress.mist.segments || []).reduce((n, s) => n + ((s.responses || []).length), 0)} · preps ${session.stress.preps.length} · live answers ${(session.stress.live && session.stress.live.responses || []).length} · end-math answers ${(session.stress.endMath && session.stress.endMath.responses || []).length} · events ${session.events.length}</div>`;
      if ($("log-preview")) $("log-preview").value = JSON.stringify(session, null, 2);
    }
    showScreen("end");
    const status = $("end-save-status");
    if (status) { status.className = "save-status"; status.textContent = "Saving your responses…"; }
    // Final Drive/local save: reason "complete" with completedAt, endReason, and summaries populated.
    Promise.resolve(autosave("complete")).then((res) => {
      const row = $("end-fallback-row");
      if (res && res.ok) {
        if (status) {
          status.className = "save-status ok";
          status.textContent = res.unconfirmed
            ? "Your responses were sent. You may close this window."
            : "Your responses were saved. You may close this window.";
        }
        if (row) row.hidden = true;
      } else {
        if (status) {
          status.className = "save-status failed";
          status.textContent = "Your responses could not be saved automatically. Please click the button below to download a copy of your data.";
        }
        if (row) row.hidden = false;
      }
    });
  }

  function downloadBlob(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  // v0 columns first (unchanged order), v2 additions, then v4 additions
  const CSV_HEADERS = [
    "participantId", "mode", "trialType", "trialIndex", "isPractice", "stimulusId", "conditionLabel", "choice",
    "correctDirection", "accuracy", "rt_ms", "decision_onset_perf", "response_perf", "yaw_at_response",
    "probeLag", "referencedTrialIndex", "timestamp",
    "seed", "conditionOrder", "condition", "block", "blockPos", "trainingId", "destination", "renderId",
    "intendedRenderId", "stimulusPlaceholder", "boardId", "boardFile", "layout", "cellId", "congruence",
    "targetRow", "scene_onset_perf", "pitch_at_response",
    "conditionName", "conditionPosition", "blockOrder", "cueType", "legacySceneId", "panoRes",
  ];
  const Q_HEADERS = ["participantId", "seed", "conditionOrder", "phase", "administration", "condition", "conditionName",
    "conditionPosition", "block", "blockOrder", "destination", "instrument", "itemId", "itemPosition", "value", "valueLabel", "otherText", "nChanges",
    "page_onset_perf", "first_response_perf", "last_response_perf", "rt_ms", "submit_perf",
    "first_response_time", "last_response_time", "submit_time", "itemText", "vasMoved", "pages_total"];
  const SCORE_HEADERS = ["participantId", "seed", "conditionOrder", "phase", "administration", "condition", "conditionName",
    "conditionPosition", "block", "blockOrder", "destination", "instrument", "submit_time", "duration_ms", "eligible", "exclusion_items", "vas_stress",
    "sam_valence", "sam_arousal", "somatic", "cognitive", "total", "raw_tlx", "performance_reversed", "sbsod_mean",
    "sas_mean", "n_answered", "lq", "handedness", "presentedOrder"];
  const STRESS_HEADERS = ["participantId", "task", "phase", "variant", "idx", "difficulty", "level", "problem",
    "previous", "expected", "given", "correct", "timeout", "feedback", "rt_ms", "limit_ms", "next_limit_ms", "next_level",
    "your_pct", "average_marker", "onset_perf", "response_perf", "elapsed_ms", "timestamp"];
  const SUMMARY_HEADERS = ["participantId", "scope", "condition", "conditionName", "conditionPosition", "block", "blockOrder", "destination",
    "n_decisions", "n_correct", "pct_correct", "mean_decision_latency_s", "n_probes", "n_probes_correct", "pct_probes_correct", "blocks_json"];
  function stressRows() {
    const rows = [];
    const add = (res, task) => {
      if (!res || !res.responses) return;
      res.responses.forEach((r) => rows.push({ participantId: session.participantId, task, ...r }));
    };
    add(session.stress && session.stress.live, "live");
    add(session.stress && session.stress.endMath, "end_math");
    const mist = session.stress && session.stress.mist;
    if (mist && mist.practice) add(mist.practice, "mist");
    (mist && mist.segments || []).forEach((seg) => add(seg, "mist"));
    return rows;
  }
  function summaryRows() {
    return (session.summaries || []).map((sm) => ({
      participantId: session.participantId, ...sm, blocks_json: JSON.stringify(sm.blocks || []),
    }));
  }
  function toCsv(headers, rows, extra) {
    const cell = (v) => {
      if (v == null) return "";
      if (typeof v === "object") v = JSON.stringify(v);
      v = String(v);
      return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const lines = [headers.join(",")];
    rows.forEach((r) => lines.push(headers.map((h) => cell(r[h] != null ? r[h] : extra && extra[h])).join(",")));
    return lines.join("\n");
  }
  function sessionToCsv(sess) { return toCsv(CSV_HEADERS, sess.trials); }
  function eventHeaders() {
    const base = ["seq", "event", "phase", "perf", "timestamp", "trialIndex"];
    const more = new Set();
    session.events.forEach((e) => Object.keys(e).forEach((k) => { if (!base.includes(k)) more.add(k); }));
    return base.concat(Array.from(more).sort());
  }
  function exportFiles() {
    const pid = session.participantId || "unknown";
    const pre = `wayfinding_v44_${pid}_`;
    return {
      [pre + "session.json"]: JSON.stringify(session, null, 2),
      [pre + "trials.csv"]: sessionToCsv(session),
      [pre + "questionnaires.csv"]: toCsv(Q_HEADERS, session.responses),
      [pre + "scores.csv"]: toCsv(SCORE_HEADERS, session.scores),
      [pre + "events.csv"]: toCsv(eventHeaders(), session.events),
      [pre + "stress.csv"]: toCsv(STRESS_HEADERS, stressRows()),
      [pre + "summaries.csv"]: toCsv(SUMMARY_HEADERS, summaryRows()),
    };
  }

  function onKeyDown(e) {
    if (!screens.trial.classList.contains("active") || !currentEvent) return;
    const k = e.key.toLowerCase();
    if (currentEvent.kind === "blockIntro") {
      if (k === " " || k === "enter") { e.preventDefault(); dismissIntro(); }
      return;
    }
    // Ignore left/right during the corridor exit+entry (RT for the new trial starts only after entry).
    if (transitionBusy || fadeCovered) return;
    if (!choiceEnabled) return;
    if (k === "arrowleft" || k === "a") {
      e.preventDefault();
      if (currentEvent.kind === "probe") recordProbeResponse("left"); else recordDecisionResponse("left");
    } else if (k === "arrowright" || k === "d") {
      e.preventDefault();
      if (currentEvent.kind === "probe") recordProbeResponse("right"); else recordDecisionResponse("right");
    }
  }

  function init() {
    if (mode === "remote") {
      try {
        if (sessionStorage.getItem("wf_gate_ok") !== "1") {
          location.replace("/participate.html");
          return;
        }
      } catch (e) {
        location.replace("/participate.html");
        return;
      }
    }
    $("header-meta").textContent = `v4.4 · mode: ${mode} · ${CONFIG.RES}`;
    if (mode === "lab") $("lab-banner").classList.add("visible");
    if (DEBUG) document.body.classList.add("debug");
    document.addEventListener("visibilitychange", () => {
      if (!session.startedAt) return;
      logEvent("visibility_change", { state: document.visibilityState, hidden: document.hidden ? 1 : 0 });
    });
    window.addEventListener("blur", () => {
      if (session.startedAt && !session.completedAt) logEvent("window_blur", {});
    });
    window.addEventListener("focus", () => {
      if (session.startedAt && !session.completedAt) logEvent("window_focus", {});
    });
    $("btn-intro-continue").addEventListener("click", () => dismissIntro());
    $("btn-left").addEventListener("click", () => recordDecisionResponse("left"));
    $("btn-right").addEventListener("click", () => recordDecisionResponse("right"));
    $("btn-probe-left").addEventListener("click", () => recordProbeResponse("left"));
    $("btn-probe-right").addEventListener("click", () => recordProbeResponse("right"));
    const dl = (suffix, mime) => () => {
      const files = exportFiles();
      const name = Object.keys(files).find((n) => n.endsWith(suffix));
      downloadBlob(name, files[name], mime);
    };
    $("btn-download-json").addEventListener("click", dl("session.json", "application/json"));
    $("btn-download-csv").addEventListener("click", dl("trials.csv", "text/csv"));
    $("btn-download-q").addEventListener("click", dl("questionnaires.csv", "text/csv"));
    $("btn-download-scores").addEventListener("click", dl("scores.csv", "text/csv"));
    $("btn-download-events").addEventListener("click", dl("events.csv", "text/csv"));
    $("btn-download-stress").addEventListener("click", dl("stress.csv", "text/csv"));
    if ($("btn-download-summaries")) $("btn-download-summaries").addEventListener("click", dl("summaries.csv", "text/csv"));
    if ($("btn-restart")) $("btn-restart").addEventListener("click", () => location.reload());
    if ($("btn-fallback-download")) $("btn-fallback-download").addEventListener("click", () => {
      const files = exportFiles();
      const name = Object.keys(files).find((n) => n.endsWith("session.json")) || ("wayfinding_v44_" + (session.participantId || "data") + "_session.json");
      downloadBlob(name, files[name] || JSON.stringify(session, null, 2), "application/json");
    });
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", (e) => {
      if (session.startedAt && !session.completedAt) { autosave("beforeunload"); e.preventDefault(); e.returnValue = ""; }
    });
    if (DEBUG) {
      window.__wf = { CONFIG, session, sessionToCsv, exportFiles, get pano() { return pano; }, get currentEvent() { return currentEvent; },
        get choiceEnabled() { return choiceEnabled; }, get queueLength() { return eventQueue.length; }, get phase() { return currentPhase; },
        preloaded: () => preloadPromise, BOARDS, NATURE_RENDERS, ABSTRACT_RENDERS, ensureViewer, panoUrl, boardUrl,
        autofill: () => window.WFSurvey.autofill(pageHost()), dismissIntro, get serverOk() { return serverOk; },
        get lastSave() { return lastSave; }, conditionPerformance, overallPerformance, ensureSummaries, stressRows, summaryRows, collectSummaries,
        playExitTransition, playEnterTransition, clearTransitionVisuals, peekNextEvent };
    }
    console.log("[wayfinding v4.4] ready", { mode, abstract: CONFIG.ABSTRACT_MODE, res: CONFIG.RES,
      trialsPerBlock: CONFIG.TRIALS_PER_BLOCK, stressMode: CONFIG.STRESS_MODE, showSam: CONFIG.SHOW_SAM,
      showSummary: CONFIG.SHOW_SUMMARY, endMath: CONFIG.END_MATH, mistSec: CONFIG.MIST_S, transMs: CONFIG.TRANS_MS });
    runSession().catch((err) => { console.error("[session]", err); logEvent("session_error", { message: String(err && err.message) }); });
  }

  function boot() {
    if (window.Pano3D || location.protocol === "file:") init();
    else window.addEventListener("pano3d-ready", init, { once: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

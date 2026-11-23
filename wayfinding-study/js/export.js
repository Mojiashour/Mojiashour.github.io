/**
 * Data export for the Hospital Wayfinding Study (v5.7).
 *
 * For each participant:
 *   <id>_questionnaires.csv   one row per questionnaire timepoint
 *   <id>_trials.csv           one row per test decision or recall probe (practice excluded)
 *   raw/<id>_session.json     full session object
 *   raw/<id>_events.csv       event log
 *   raw/<id>_dst_items.csv    item-level arithmetic-task data
 *   raw/<id>_questionnaire_items.csv   item-level questionnaire rows with timings
 *
 * Condition order is written as Nature_first / Poster_first. A file name that
 * starts with "raw/" is placed in a raw subfolder by the Apps Script backend,
 * the local save server, and the zip download.
 */
(function (root) {
  "use strict";

  /* ---------------- label helpers ---------------- */
  /** Internal order code (NA / AN / N) or an existing label -> output label. */
  function orderLabel(v) {
    const s = String(v == null ? "" : v);
    if (s === "NA" || s === "Nature_first") return "Nature_first";
    if (s === "AN" || s === "Poster_first") return "Poster_first";
    if (s === "N" || s === "Nature_only") return "Nature_only";
    return s;
  }
  /** Output label -> ordered internal condition names. */
  function condsFromOrderLabel(label) {
    const l = orderLabel(label);
    if (l === "Nature_first") return ["Nature", "Abstract"];
    if (l === "Poster_first") return ["Abstract", "Nature"];
    if (l === "Nature_only") return ["Nature"];
    return [];
  }
  /** Internal condition name -> output label (Abstract is the internal name of the Poster condition). */
  function condLabel(c) {
    if (c === "Abstract" || c === "Poster") return "Poster";
    if (c === "Nature") return "Nature";
    return c || "";
  }

  /* ---------------- csv ---------------- */
  function csvCell(v) {
    if (v == null) return "";
    if (typeof v === "boolean") return v ? "1" : "0";
    if (typeof v === "object") v = JSON.stringify(v);
    v = String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function toCsv(headers, rows) {
    const lines = [headers.join(",")];
    rows.forEach((r) => lines.push(headers.map((h) => csvCell(r[h])).join(",")));
    return lines.join("\n");
  }

  /* ---------------- questionnaires (long, one row per timepoint) ---------------- */
  const pad2 = (n) => String(n).padStart(2, "0");
  const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

  const DEM_IDS = ["DEM_age", "DEM_gender", "DEM_education", "DEM_race", "DEM_english",
    "DEM_hospfamiliar", "DEM_hospvisits", "DEM_healthcarework", "DEM_videogames", "DEM_vrexp", "DEM_nature_visit", "DEM_nature_media"];
  const WEEKLY = ["more_than_once_day", "every_day", "several_times_week", "once_week"];

  const PARTICIPANT_COLS = ["participant_id", "app_version", "seed", "cond_order", "order_source", "end_reason", "exclude_flag"]
    .concat(DEM_IDS.map((x) => x.toLowerCase()), ["nature_visit_weekly", "attn_sticsa_t_pass", "attn_sbsod_pass", "attn_fail_count"]);
  const KEY_COLS = ["timepoint_no", "timepoint", "cond_position", "condition", "block_no", "block_order", "destination", "submit_time"];

  // [output column, source item id or score key]
  const MEASURE_SPEC = [];
  ["SCR14", "SCR15", "SCR16", "SCR17"].forEach((id) => MEASURE_SPEC.push(["today_" + id.toLowerCase(), "item", id]));
  ["stressed", "frustrated", "overstrained", "ashamed"].forEach((k) => MEASURE_SPEC.push(["vas_" + k, "item", "VAS_" + k]));
  const IPANAS = ["upset", "hostile", "alert", "ashamed", "inspired", "nervous", "determined", "attentive", "afraid", "active"];
  IPANAS.forEach((k) => MEASURE_SPEC.push(["ipanas_" + k, "item", "IPANAS_" + k]));
  MEASURE_SPEC.push(["ipanas_pa", "score", "IPANAS", "pa"], ["ipanas_na", "score", "IPANAS", "na"]);
  range(21).forEach((i) => MEASURE_SPEC.push(["sticsa_t_" + pad2(i), "item", "STT" + pad2(i)]));
  MEASURE_SPEC.push(["sticsa_t_attn", "item", "STT_ATTN"]);
  MEASURE_SPEC.push(["sticsa_t_somatic", "score", "STICSA_T", "somatic"], ["sticsa_t_cognitive", "score", "STICSA_T", "cognitive"],
    ["sticsa_t_total", "score", "STICSA_T", "total"]);
  ["mental", "physical", "temporal", "performance", "effort", "frustration"].forEach((k) => MEASURE_SPEC.push(["tlx_" + k, "item", "TLX_" + k]));
  MEASURE_SPEC.push(["tlx_raw", "score", "TLX", "raw_tlx"]);
  range(15).forEach((i) => MEASURE_SPEC.push(["sbsod_" + pad2(i), "item", "SBSOD" + pad2(i)]));
  MEASURE_SPEC.push(["sbsod_attn", "item", "SBSOD_ATTN"]);
  MEASURE_SPEC.push(["sbsod_mean", "score", "SBSOD", "sbsod_mean"]);
  range(13).forEach((i) => MEASURE_SPEC.push(["sas_" + pad2(i), "item", "SAS" + pad2(i)]));
  MEASURE_SPEC.push(["sas_mean", "score", "SAS", "sas_mean"]);
  ["writing", "throwing", "toothbrush", "spoon"].forEach((k) => MEASURE_SPEC.push(["ehi_" + k, "item", "EHI_" + k]));
  MEASURE_SPEC.push(["ehi_lq", "score", "EHI", "lq"], ["ehi_handedness", "score", "EHI", "handedness"]);
  range(6).forEach((i) => MEASURE_SPEC.push(["nr6_" + pad2(i), "item", "NR6_" + pad2(i)]));
  MEASURE_SPEC.push(["nr6_mean", "score", "NR6", "nr6_mean"]);
  const DST_COLS = ["dst_n_items", "dst_n_correct", "dst_n_wrong", "dst_n_timeout", "dst_pct_correct", "dst_mean_rt_ms",
    "dst_limit_start_ms", "dst_limit_final_ms", "dst_n_shuffled", "dst_n_easy"];

  const Q_COLUMNS = PARTICIPANT_COLS.concat(KEY_COLS, MEASURE_SPEC.map((m) => m[0]), DST_COLS);

  /** administration string (internal) -> fixed timepoint number / label / condition position. */
  function timepointOf(administration) {
    const a = String(administration || "");
    let m;
    if (a === "today") return { no: 1, label: "today" };
    if (a === "baseline") return { no: 2, label: "baseline" };
    if (a === "post_mist_1" || a === "post_dst_1") return { no: 3, label: "post_dst_1", dst: "first" };
    if ((m = a.match(/^post_block_([12])_([123])$/))) {
      const pos = +m[1], ord = +m[2];
      return { no: (pos === 1 ? 3 : 8) + ord, label: "post_block_" + pos + "_" + ord, pos };
    }
    if (a === "post_condition_A") return { no: 7, label: "post_condition_1", pos: 1 };
    if (a === "post_mist_2" || a === "post_dst_2") return { no: 8, label: "post_dst_2", dst: "second" };
    if (a === "post_condition_B") return { no: 12, label: "post_condition_2", pos: 2 };
    if (a === "post_experiment") return { no: 13, label: "post_experiment" };
    return { no: 99, label: a };
  }

  function dstSummaryFor(session, which) {
    const segs = (session.stress && session.stress.dst && session.stress.dst.segments) || [];
    const seg = segs.find((s) => s && s.variant === which && !s.skipped);
    if (!seg) return null;
    const rs = seg.responses || [];
    const sm = seg.summary || {};
    const rts = rs.filter((r) => !+r.timeout && typeof r.rt_ms === "number").map((r) => r.rt_ms);
    return {
      dst_n_items: sm.n_responses != null ? sm.n_responses : rs.length,
      dst_n_correct: sm.n_correct != null ? sm.n_correct : rs.filter((r) => +r.correct === 1).length,
      dst_n_wrong: sm.n_wrong != null ? sm.n_wrong : rs.filter((r) => !+r.correct && !+r.timeout).length,
      dst_n_timeout: sm.n_timeout != null ? sm.n_timeout : rs.filter((r) => +r.timeout === 1).length,
      dst_pct_correct: sm.pct_correct != null ? sm.pct_correct : (rs.length ? Math.round(1000 * rs.filter((r) => +r.correct === 1).length / rs.length) / 10 : ""),
      dst_mean_rt_ms: rts.length ? Math.round(rts.reduce((s, x) => s + x, 0) / rts.length) : "",
      dst_limit_start_ms: sm.limit_start_ms != null ? sm.limit_start_ms : (sm.limit_ms != null ? sm.limit_ms : ""),
      dst_limit_final_ms: sm.limit_final_ms != null ? sm.limit_final_ms : "",
      dst_n_shuffled: rs.filter((r) => +r.keypad_shuffled === 1).length,
      dst_n_easy: rs.filter((r) => +r.easy_item === 1).length,
    };
  }

  function participantCols(session) {
    const p = {
      participant_id: session.participantId,
      app_version: session.appVersion,
      seed: session.seed,
      cond_order: orderLabel(session.conditionOrder),
      order_source: session.conditionOrderSource,
      end_reason: session.endReason,
      exclude_flag: session.excludeFromAnalysis ? 1 : 0,
    };
    const attn = {};
    (session.responses || []).forEach((r) => {
      if (DEM_IDS.indexOf(r.itemId) >= 0) p[r.itemId.toLowerCase()] = r.value;
      if (r.itemId === "STT_ATTN") attn.sticsa = String(r.value) === "3" ? 1 : 0;
      if (r.itemId === "SBSOD_ATTN") attn.sbsod = String(r.value) === "5" ? 1 : 0;
    });
    const nv = p.dem_nature_visit;
    p.nature_visit_weekly = nv == null || nv === "" || nv === "pna" ? "" : (WEEKLY.indexOf(String(nv)) >= 0 ? 1 : 0);
    p.attn_sticsa_t_pass = attn.sticsa != null ? attn.sticsa : "";
    p.attn_sbsod_pass = attn.sbsod != null ? attn.sbsod : "";
    p.attn_fail_count = (attn.sticsa != null || attn.sbsod != null) ? [attn.sticsa, attn.sbsod].filter((x) => x === 0).length : "";
    return p;
  }

  function questionnaireRows(session) {
    const byAdmin = new Map();
    const slot = (admin) => {
      if (!byAdmin.has(admin)) byAdmin.set(admin, { admin, items: {}, scores: {}, keys: {}, times: [] });
      return byAdmin.get(admin);
    };
    (session.responses || []).forEach((r) => {
      const s = slot(r.administration);
      s.items[r.itemId] = r.value;
      ["condition", "conditionPosition", "block", "blockOrder", "destination"].forEach((k) => {
        if (r[k] !== undefined && r[k] !== "" && r[k] != null) s.keys[k] = r[k];
      });
      if (r.submit_time) s.times.push(r.submit_time);
    });
    (session.scores || []).forEach((sc) => {
      const s = slot(sc.administration);
      s.scores[sc.instrument] = sc;
      ["condition", "conditionPosition", "block", "blockOrder", "destination"].forEach((k) => {
        if (sc[k] !== undefined && sc[k] !== "" && sc[k] != null && s.keys[k] == null) s.keys[k] = sc[k];
      });
      if (sc.submit_time) s.times.push(sc.submit_time);
    });
    const base = participantCols(session);
    const rows = [];
    byAdmin.forEach((s) => {
      const tp = timepointOf(s.admin);
      const row = Object.assign({}, base);
      row.timepoint_no = tp.no;
      row.timepoint = tp.label;
      const pos = s.keys.conditionPosition != null ? s.keys.conditionPosition : tp.pos;
      row.cond_position = pos != null ? pos : "";
      row.condition = condLabel(s.keys.condition);
      row.block_no = s.keys.block != null ? s.keys.block : "";
      row.block_order = s.keys.blockOrder != null ? s.keys.blockOrder : "";
      row.destination = s.keys.destination || "";
      row.submit_time = s.times.length ? s.times.slice().sort().pop() : "";
      MEASURE_SPEC.forEach((m) => {
        if (m[1] === "item") { if (s.items[m[2]] !== undefined) row[m[0]] = s.items[m[2]]; }
        else if (s.scores[m[2]] && s.scores[m[2]][m[3]] !== undefined) row[m[0]] = s.scores[m[2]][m[3]];
      });
      if (tp.dst) Object.assign(row, dstSummaryFor(session, tp.dst) || {});
      rows.push(row);
    });
    rows.sort((a, b) => a.timepoint_no - b.timepoint_no);
    return rows;
  }

  /* ---------------- trials ---------------- */
  const TRIAL_COLUMNS = ["participant_id", "cond_order", "seq", "trial_type", "trial_no", "condition", "cond_position", "block_no",
    "block_order", "trial_in_block", "destination", "layout", "cue_side", "sign_on_cue", "congruence", "correct_side", "target_row",
    "choice", "accuracy", "timed_out", "rt_ms", "decision_limit_ms", "yaw_at_response", "board_id", "render_id",
    "probe_ref_trial", "probe_lag", "probe_ref_timed_out", "timestamp"];

  function trialRows(session, boards) {
    const B = boards || {};
    const out = [];
    (session.trials || []).forEach((t) => {
      if (t.isPractice === true || t.isPractice === "true" || t.isPractice === 1) return;
      const isDec = t.trialType === "decision";
      const b = t.boardId ? B[t.boardId] : null;
      const cong = t.congruence === "NA" ? "neutral" : (t.congruence === "n/a" ? "" : t.congruence);
      out.push({
        participant_id: session.participantId,
        cond_order: orderLabel(session.conditionOrder),
        seq: out.length + 1,
        trial_type: t.trialType,
        trial_no: isDec ? t.trialIndex : "",
        condition: condLabel(t.condition),
        cond_position: t.conditionPosition,
        block_no: t.block,
        block_order: t.blockOrder,
        trial_in_block: isDec ? t.blockPos : "",
        destination: t.destination || "",
        layout: t.layout || "",
        cue_side: b ? b.extra_cue_side : "",
        sign_on_cue: b ? b.sign_on_cue : "",
        congruence: isDec ? (cong || "") : "",
        correct_side: t.correctDirection,
        target_row: isDec ? t.targetRow : "",
        choice: t.choice,
        accuracy: t.accuracy,
        timed_out: isDec ? t.timedOut : "",
        rt_ms: t.rt_ms,
        decision_limit_ms: isDec ? t.decisionLimitMs : "",
        yaw_at_response: isDec ? t.yaw_at_response : "",
        board_id: t.boardId || "",
        render_id: isDec ? t.renderId : "",
        probe_ref_trial: isDec ? "" : t.referencedTrialIndex,
        probe_lag: isDec ? "" : t.probeLag,
        probe_ref_timed_out: isDec ? "" : t.referencedTimedOut,
        timestamp: t.timestamp,
      });
    });
    return out;
  }

  /* ---------------- raw files ---------------- */
  const Q_ITEM_HEADERS = ["participantId", "seed", "conditionOrder", "phase", "administration", "condition", "conditionName",
    "conditionPosition", "block", "blockOrder", "destination", "instrument", "itemId", "itemPosition", "value", "valueLabel", "nChanges",
    "page_onset_perf", "first_response_perf", "last_response_perf", "rt_ms", "submit_perf",
    "first_response_time", "last_response_time", "submit_time", "itemText", "vasMoved", "pages_total"];
  const DST_ITEM_HEADERS = ["participantId", "task", "phase", "variant", "list_id", "idx", "item_index", "problem",
    "operand_a", "operand_b", "operator", "source", "expected", "given", "correct", "timeout", "feedback",
    "rt_ms", "limit_ms", "next_limit_ms", "adapt_event", "keypad_shuffled", "keypad_layout", "easy_item", "cutoff_reason", "your_pct", "average_marker", "onset_perf", "response_perf", "elapsed_ms", "timestamp"];

  function stressRows(session) {
    const rows = [];
    const add = (res, task) => {
      if (!res || !res.responses) return;
      res.responses.forEach((r) => rows.push(Object.assign({ participantId: session.participantId, task }, r)));
    };
    const dst = session.stress && session.stress.dst;
    ((dst && dst.segments) || []).forEach((seg) => add(seg, "dst"));
    return rows;
  }
  function eventHeaders(events) {
    const base = ["seq", "event", "phase", "perf", "timestamp", "trialIndex"];
    const more = new Set();
    events.forEach((e) => Object.keys(e).forEach((k) => { if (base.indexOf(k) < 0) more.add(k); }));
    return base.concat(Array.from(more).sort());
  }

  /** All files for one participant: { "<pid>_questionnaires.csv": text, ..., "raw/<pid>_session.json": text }. */
  function buildFiles(session, deps) {
    const boards = (deps && deps.boards) || {};
    const pid = session.participantId || "unknown";
    const sessionOut = JSON.parse(JSON.stringify(session));
    sessionOut.conditionOrder = orderLabel(sessionOut.conditionOrder);
    if (sessionOut.plan && sessionOut.plan.order) sessionOut.plan.order = orderLabel(sessionOut.plan.order);
    ["trials", "responses", "scores", "events"].forEach((k) => (sessionOut[k] || []).forEach((r) => {
      if (r && r.conditionOrder !== undefined) r.conditionOrder = orderLabel(r.conditionOrder);
    }));
    const qItems = (session.responses || []).map((r) => Object.assign({}, r, { conditionOrder: orderLabel(r.conditionOrder) }));
    const files = {};
    files[pid + "_questionnaires.csv"] = toCsv(Q_COLUMNS, questionnaireRows(session));
    files[pid + "_trials.csv"] = toCsv(TRIAL_COLUMNS, trialRows(session, boards));
    files["raw/" + pid + "_session.json"] = JSON.stringify(sessionOut, null, 2);
    files["raw/" + pid + "_events.csv"] = toCsv(eventHeaders(session.events || []), session.events || []);
    files["raw/" + pid + "_dst_items.csv"] = toCsv(DST_ITEM_HEADERS, stressRows(session));
    files["raw/" + pid + "_questionnaire_items.csv"] = toCsv(Q_ITEM_HEADERS, qItems);
    return files;
  }

  /* ---------------- zip (store only, no compression) so a local download keeps the raw/ folder ---------------- */
  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
    }
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function buildZip(files, when) {
    const enc = new TextEncoder();
    const d = when instanceof Date ? when : new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const chunks = [], central = [];
    let offset = 0;
    Object.keys(files).forEach((name) => {
      const nameB = enc.encode(name), data = enc.encode(files[name]), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nameB.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), nameB, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nameB.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameB);
      offset += 30 + nameB.length + data.length;
    });
    const csize = central.reduce((n, c) => n + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, Object.keys(files).length, true); end.setUint16(10, Object.keys(files).length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    const all = chunks.concat(central, [new Uint8Array(end.buffer)]);
    const total = all.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    all.forEach((c) => { out.set(c, p); p += c.length; });
    return out;
  }

  const api = { orderLabel, condsFromOrderLabel, condLabel, toCsv, timepointOf, questionnaireRows, trialRows, stressRows, buildFiles, buildZip,
    Q_COLUMNS, TRIAL_COLUMNS, DST_ITEM_HEADERS, Q_ITEM_HEADERS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WF_EXPORT = api;
})(typeof window !== "undefined" ? window : globalThis);

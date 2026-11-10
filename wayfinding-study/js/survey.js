/**
 * v4.2 survey renderer. WFSurvey.run(host, instrument, ctx) -> Promise<{rows, values, presentedOrder}>
 *  - long instruments are split into pages of about 5–6 items, with Next / Continue
 *  - required items on the current page must be answered before continuing
 *  - per item: value, first/last response time (performance.now + ISO), number of changes
 *  - VAS: continuous 0–100 slider, no numbers/ticks; track is always visible, thumb hidden
 *    until the first click (unbiased). A "click on the line" prompt is shown. Movement is logged.
 *  - Matrix option columns have equal width; long labels wrap (e.g. Strongly / agree)
 *  - SAM: 9 points, official figures from assets/sam/<dim>_<1..5>.png if present, else a labelled placeholder
 */
(function () {
  "use strict";
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function shuffleSeeded(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /** Evenly sized pages, each at most `size` items (default 6). */
  function paginate(items, size) {
    size = size || 6;
    if (items.length <= size) return [items.slice()];
    const nPages = Math.ceil(items.length / size);
    const base = Math.floor(items.length / nPages);
    const rem = items.length % nPages;
    const pages = [];
    let i = 0;
    for (let p = 0; p < nPages; p++) {
      const n = base + (p < rem ? 1 : 0);
      pages.push(items.slice(i, i + n));
      i += n;
    }
    return pages;
  }

  /** Bold listed phrases in already-escaped instruction text (longest first). */
  function emphasize(escaped, phrases) {
    let s = escaped;
    (phrases || []).slice().sort((a, b) => b.length - a.length).forEach((p) => {
      const needle = esc(p);
      if (!needle) return;
      s = s.split(needle).join("<strong>" + needle + "</strong>");
    });
    return s;
  }

  /** Equal-width scale headers; long labels wrap onto a second line. */
  function scaleHeaderHTML(o) {
    const lab = String(o.label || "");
    const m = /^(\d+)\s*[–-]\s*(.+)$/.exec(lab);
    let num = "", text = lab;
    if (m) { num = m[1]; text = m[2]; }
    else if (/^\d+$/.test(lab)) { num = lab; text = ""; }
    const words = text ? text.split(/\s+/) : [];
    let labHtml = "";
    if (words.length === 1) labHtml = esc(text);
    else if (words.length === 2) labHtml = esc(words[0]) + "<br>" + esc(words[1]);
    else if (words.length > 2) {
      const mid = Math.ceil(words.length / 2);
      labHtml = esc(words.slice(0, mid).join(" ")) + "<br>" + esc(words.slice(mid).join(" "));
    }
    return (num ? `<span class="lh-num">${esc(num)}</span>` : "") +
      (labHtml ? `<span class="lh-lab">${labHtml}</span>` : "");
  }

  let activeSkip = null;
  let activeAbort = null;
  function skipCurrent() {
    if (typeof activeSkip === "function") { activeSkip(); return true; }
    return false;
  }
  function abortCurrent() {
    if (typeof activeAbort === "function") { activeAbort(); return true; }
    return skipCurrent();
  }

  function run(host, inst, ctx) {
    return new Promise((resolve) => {
      const admin = !!(ctx && ctx.admin);
      const onset = performance.now();
      const state = {}; // itemId -> {value, label, other, first, last, firstIso, lastIso, n, pageOnset}
      const items = [];
      const presentedOrder = [];
      inst.sections.forEach((sec) => {
        let list = sec.items.slice();
        if (inst.shuffleItems && ctx.rnd) list = shuffleSeeded(list, ctx.rnd);
        list.forEach((it) => {
          const pos = items.length + 1;
          presentedOrder.push(it.id);
          const req = inst.required && it.required !== false;
          items.push(Object.assign({ _pos: pos, _req: req, _opts: it.options || sec.options, _sec: sec }, it));
        });
      });

      const pageSize = inst.pageSize || 6;
      const pages = paginate(items, pageSize);
      let pageI = 0;
      const itemById = {};
      items.forEach((it) => (itemById[it.id] = it));

      const optLabel = (it, v) => { const o = (it._opts || []).find((o) => String(o.v) === String(v)); return o ? o.label : String(v); };
      const typed = (it, raw) => { const o = (it._opts || []).find((o) => String(o.v) === String(raw)); return o ? o.v : raw; };

      const touch = (id, value, label, other) => {
        const t = performance.now(), iso = new Date().toISOString();
        const s = state[id] || (state[id] = { first: t, firstIso: iso, n: 0, pageOnset: itemById[id] && itemById[id]._pageOnset });
        s.value = value; s.label = label; if (other !== undefined) s.other = other;
        s.last = t; s.lastIso = iso; s.n++;
        const q = host.querySelector(`.q[data-item="${id}"]`); if (q) q.classList.remove("missing");
      };

      const bindInputs = () => {
        host.querySelectorAll("input[type=radio]").forEach((el) => el.addEventListener("change", () => {
          const it = itemById[el.name]; const v = typed(it, el.value);
          const oth = host.querySelector(`input.other[data-other-for="${el.name}"][data-opt="${el.value}"]`);
          touch(el.name, v, optLabel(it, v), oth ? oth.value : "");
        }));
        host.querySelectorAll("input[type=checkbox]").forEach((el) => el.addEventListener("change", () => {
          const name = el.name, it = itemById[name];
          const boxes = Array.from(host.querySelectorAll(`input[type=checkbox][name="${name}"]`));
          if (el.checked && el.dataset.exclusive) boxes.forEach((b) => { if (b !== el) b.checked = false; });
          if (el.checked && !el.dataset.exclusive) boxes.forEach((b) => { if (b.dataset.exclusive) b.checked = false; });
          const sel = boxes.filter((b) => b.checked).map((b) => b.value);
          const oth = host.querySelector(`input.other[data-other-for="${name}"]`);
          touch(name, sel.join(";"), sel.map((v) => optLabel(it, v)).join("; "), oth && sel.includes(oth.dataset.opt) ? oth.value : "");
        }));
        host.querySelectorAll("input.other").forEach((el) => el.addEventListener("input", () => {
          const name = el.dataset.otherFor;
          const r = host.querySelector(`input[name="${name}"][value="${el.dataset.opt}"]`);
          if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event("change")); }
          if (state[name]) state[name].other = el.value;
        }));
        host.querySelectorAll("input.num, input.txt").forEach((el) => el.addEventListener("input", () => {
          const v = el.classList.contains("num") ? (el.value === "" ? "" : +el.value) : el.value.trim();
          if (v === "") { delete state[el.name]; return; }
          const pna = host.querySelector(`input.pna-toggle[data-pna-for="${el.name}"]`);
          if (pna) pna.checked = false;
          touch(el.name, v, String(v));
        }));
        host.querySelectorAll("input.pna-toggle").forEach((el) => el.addEventListener("change", () => {
          const name = el.dataset.pnaFor, it = itemById[name];
          const txt = host.querySelector(`input.txt[name="${name}"]`);
          if (el.checked) {
            if (txt) { txt.value = ""; txt.disabled = true; }
            touch(name, "pna", "I prefer not to answer");
          } else {
            if (txt) txt.disabled = false;
            if (state[name]) delete state[name];
          }
        }));
        host.querySelectorAll(".vas").forEach((box) => {
          const id = box.dataset.vas, track = box.querySelector(".vas-track"), thumb = box.querySelector(".vas-thumb");
          let drag = false;
          const set = (e) => {
            const r = track.getBoundingClientRect();
            const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            thumb.style.left = f * 100 + "%"; box.classList.remove("untouched");
            const v = Math.round(f * 1000) / 10; touch(id, v, String(v));
          };
          track.addEventListener("pointerdown", (e) => { drag = true; track.setPointerCapture(e.pointerId); set(e); });
          track.addEventListener("pointermove", (e) => { if (drag) set(e); });
          track.addEventListener("pointerup", () => (drag = false));
          track.addEventListener("pointercancel", () => (drag = false));
        });
      };

      const restorePage = (slice) => {
        slice.forEach((it) => {
          const s = state[it.id];
          if (!s || s.value == null || s.value === "") return;
          if (it.type === "vas") {
            const box = host.querySelector(`.vas[data-vas="${it.id}"]`);
            if (!box) return;
            const thumb = box.querySelector(".vas-thumb");
            const v = +s.value;
            if (Number.isFinite(v)) {
              thumb.style.left = (v / 100) * 100 + "%";
              box.classList.remove("untouched");
            }
          } else if (it.type === "number" || it.type === "text") {
            const el = host.querySelector(`input[name="${it.id}"]`);
            if (s.value === "pna" && it.allowPna) {
              const pna = host.querySelector(`input.pna-toggle[data-pna-for="${it.id}"]`);
              if (pna) pna.checked = true;
              if (el) { el.value = ""; el.disabled = true; }
            } else if (el) el.value = s.value;
          } else if (it.type === "multi") {
            String(s.value).split(";").forEach((v) => {
              const el = host.querySelector(`input[name="${it.id}"][value="${CSS.escape ? CSS.escape(String(v)) : String(v)}"]`);
              if (el) el.checked = true;
            });
            if (s.other) {
              const oth = host.querySelector(`input.other[data-other-for="${it.id}"]`);
              if (oth) oth.value = s.other;
            }
          } else {
            const el = host.querySelector(`input[name="${it.id}"][value="${String(s.value).replace(/"/g, '\\"')}"]`);
            if (el) el.checked = true;
            if (s.other) {
              const oth = host.querySelector(`input.other[data-other-for="${it.id}"]`);
              if (oth) oth.value = s.other;
            }
          }
        });
      };

      const renderPage = () => {
        const slice = pages[pageI];
        const pageOnset = performance.now();
        slice.forEach((it) => { if (it._pageOnset == null) it._pageOnset = pageOnset; });
        const isLast = pageI === pages.length - 1;
        const instr = emphasize(esc(inst.instructions), inst.emphasize);
        let html = `<div class="survey" data-instrument="${inst.id}" data-page="${pageI + 1}" data-pages="${pages.length}">
          <div class="survey-head">
          <p class="kicker">Questionnaire</p>
          <h2>${esc(inst.title)}</h2>
          <p class="survey-instr">${instr}</p></div>`;

        // Group this page's items by section so headings appear when needed
        const bySec = [];
        slice.forEach((it) => {
          const last = bySec[bySec.length - 1];
          if (!last || last.sec !== it._sec) bySec.push({ sec: it._sec, items: [it] });
          else last.items.push(it);
        });
        bySec.forEach((grp) => {
          const sec = grp.sec;
          if (sec.heading) html += `<h3 class="survey-sec">${esc(sec.heading)}</h3>`;
          const matrix = inst.layout === "matrix" && sec.options;
          if (matrix) {
            html += `<table class="matrix"><thead><tr><th class="qtext-h"></th>${sec.options.map((o) => `<th>${scaleHeaderHTML(o)}</th>`).join("")}</tr></thead><tbody>`;
          }
          grp.items.forEach((it) => {
            const num = `<span class="qnum">${it._pos}.</span>`;
            if (matrix) {
              html += `<tr class="q" data-item="${it.id}"><td class="qtext">${num} ${esc(it.text)}</td>` +
                sec.options.map((o) => `<td><label class="cell"><input type="radio" name="${it.id}" value="${esc(o.v)}" aria-label="${esc(o.label)}"></label></td>`).join("") + "</tr>";
              return;
            }
            html += `<div class="q" data-item="${it.id}"><div class="qtext">${it.type === "sam" ? "" : num} ${esc(it.text)}${it.note ? ` <span class="qnote">(${esc(it.note)})</span>` : ""}</div>`;
            if (it.hint) html += `<div class="qhint">${esc(it.hint)}</div>`;
            const opts = it.options || sec.options;
            if (it.type === "choice" || it.type === "multi") {
              html += `<div class="opts ${opts.length > 5 || opts.some((o) => o.label.length > 22) ? "opts-col" : ""}">` + opts.map((o) =>
                `<label class="opt"><input type="${it.type === "multi" ? "checkbox" : "radio"}" name="${it.id}" value="${esc(o.v)}" ${o.exclusive ? 'data-exclusive="1"' : ""}> <span>${esc(o.label)}</span>` +
                (o.other ? ` <input type="text" class="other" data-other-for="${it.id}" data-opt="${esc(o.v)}" maxlength="80" autocomplete="off">` : "") + `</label>`).join("") + `</div>`;
            } else if (it.type === "number") {
              html += `<div class="opts"><input type="number" class="num" name="${it.id}" min="${it.min}" max="${it.max}" step="${it.step}" inputmode="decimal"> <span class="unit">${esc(it.unit || "")}</span></div>`;
            } else if (it.type === "text") {
              html += `<div class="opts"><input type="text" class="txt" name="${it.id}" maxlength="80" autocomplete="off">` +
                (it.allowPna ? ` <label class="opt pna-opt"><input type="checkbox" class="pna-toggle" data-pna-for="${it.id}"> <span>I prefer not to answer</span></label>` : "") +
                `</div>`;
            } else if (it.type === "vas") {
              html += `<p class="vas-prompt">Click on the line to place your rating.</p>
                <div class="vas untouched" data-vas="${it.id}"><div class="vas-track" role="slider" aria-label="${esc(it.text)}" aria-valuemin="0" aria-valuemax="100"><div class="vas-thumb"></div></div>
                <div class="vas-ends"><span>${esc(it.left)}</span><span>${esc(it.right)}</span></div></div>`;
            } else if (it.type === "sam") {
              let figs = "";
              for (let k = 1; k <= 9; k++) {
                const fig = k % 2 === 1 ? (k + 1) / 2 : 0;
                figs += `<label class="sam-pt ${fig ? "fig" : "between"}"><span class="sam-fig">` +
                  (fig && inst.samImages ? `<img src="assets/sam/${it.dim}_${fig}.png" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'sam-missing',textContent:'SAM figure ${fig}'}))">` :
                    fig ? `<span class="sam-missing">SAM figure ${fig} (pending)</span>` : "") +
                  `</span><input type="radio" name="${it.id}" value="${k}" aria-label="${k}"><span class="sam-k">${k}</span></label>`;
              }
              html += `<div class="sam">${figs}</div><div class="vas-ends sam-ends"><span>${esc(it.left)}</span><span>${esc(it.right)}</span></div>`;
            }
            html += `</div>`;
          });
          if (matrix) html += `</tbody></table>`;
        });
        html += `<p class="survey-err" hidden>Please answer all questions on this page before continuing.</p>
          <div class="btn-row"><button type="button" class="survey-next">${isLast ? "Continue" : "Next"}</button>` +
          (admin ? `<button type="button" class="secondary survey-skip">Skip questionnaire</button>` : "") +
          `</div></div>`;
        host.innerHTML = html;
        host.scrollTop = 0;
        window.scrollTo(0, 0);
        bindInputs();
        restorePage(slice);
        host.querySelector(".survey-next").addEventListener("click", onNext);
        const skipBtn = host.querySelector(".survey-skip");
        if (skipBtn) skipBtn.addEventListener("click", () => finish({ skipped: 1 }));
      };

      const finish = (extra) => {
        activeSkip = null;
        activeAbort = null;
        const submit = performance.now(), submitIso = new Date().toISOString();
        const values = {};
        const rows = items.map((it) => {
          const s = state[it.id] || {};
          values[it.id] = s.value != null ? s.value : null;
          const pageOnset = it._pageOnset != null ? it._pageOnset : onset;
          return {
            instrument: inst.id, itemId: it.id, itemPosition: it._pos, itemText: it.text,
            value: s.value != null ? s.value : "", valueLabel: s.label || "", otherText: s.other || "",
            nChanges: s.n || 0,
            vasMoved: it.type === "vas" ? ((s.n || 0) > 0 ? 1 : 0) : "",
            page_onset_perf: +pageOnset.toFixed(1),
            first_response_perf: s.first != null ? +s.first.toFixed(1) : "",
            last_response_perf: s.last != null ? +s.last.toFixed(1) : "",
            rt_ms: s.last != null ? Math.round(s.last - pageOnset) : "",
            submit_perf: +submit.toFixed(1),
            first_response_time: s.firstIso || "", last_response_time: s.lastIso || "", submit_time: submitIso,
            pages_total: pages.length,
          };
        });
        resolve({ rows, values, presentedOrder, onsetPerf: onset, submitPerf: submit, duration_ms: Math.round(submit - onset),
          skipped: !!(extra && extra.skipped), aborted: !!(extra && extra.aborted),
          ineligible: !!(extra && extra.ineligible), ineligibleItem: extra && extra.ineligibleItem, ineligibleValue: extra && extra.ineligibleValue });
      };
      activeSkip = () => finish({ skipped: 1 });
      activeAbort = () => finish({ aborted: 1 });

      const onNext = () => {
        const slice = pages[pageI];
        host.querySelectorAll(".q.missing").forEach((q) => q.classList.remove("missing"));
        const err = host.querySelector(".survey-err");
        for (const it of slice) {
          if (it.type !== "number") continue;
          const raw = state[it.id] && state[it.id].value;
          if (raw === "" || raw == null) continue;
          const v = +raw;
          if (!Number.isFinite(v)) continue;
          if (!admin && it.ineligibleBelowMin && it.min != null && v < it.min) {
            if (ctx.onEvent) ctx.onEvent("survey_ineligible", { instrument: inst.id, itemId: it.id, value: v, min: it.min });
            finish({ ineligible: 1, ineligibleItem: it.id, ineligibleValue: v });
            return;
          }
        }
        const rangeFail = slice.filter((it) => {
          if (it.type !== "number") return false;
          const raw = state[it.id] && state[it.id].value;
          if (raw === "" || raw == null) return false;
          const v = +raw;
          if (!Number.isFinite(v)) return true;
          if (it.min != null && v < it.min) return true;
          if (it.max != null && v > it.max) return true;
          return false;
        });
        const missing = slice.filter((it) => it._req && (state[it.id] == null || state[it.id].value === "" || state[it.id].value == null));
        if ((missing.length || rangeFail.length) && !admin) {
          missing.concat(rangeFail).forEach((it) => { const q = host.querySelector(`.q[data-item="${it.id}"]`); if (q) q.classList.add("missing"); });
          if (err) {
            err.hidden = false;
            err.textContent = rangeFail.length
              ? "Please enter a value in the requested range."
              : "Please answer all questions on this page before continuing.";
          }
          const first = (missing[0] || rangeFail[0]);
          const q0 = first && host.querySelector(`.q[data-item="${first.id}"]`); if (q0) q0.scrollIntoView({ block: "center" });
          if (ctx.onEvent) ctx.onEvent("survey_incomplete_submit", { instrument: inst.id, nMissing: missing.length, nRange: rangeFail.length, page: pageI + 1 });
          return;
        }
        if (pageI < pages.length - 1) {
          pageI++;
          renderPage();
          return;
        }
        finish();
      };

      renderPage();
    });
  }

  /** test helper (?debug=1): fill every visible item on the current page with a valid answer */
  function autofill(host, rnd) {
    const r = rnd || Math.random;
    const names = new Set();
    host.querySelectorAll("input[type=radio],input[type=checkbox]").forEach((el) => names.add(el.name));
    names.forEach((n) => {
      const opts = Array.from(host.querySelectorAll(`input[name="${n}"]`)).filter((o) => !o.dataset.exclusive);
      const o = opts[Math.floor(r() * opts.length)]; o.checked = true; o.dispatchEvent(new Event("change"));
    });
    host.querySelectorAll("input.num").forEach((el) => { el.value = el.min && +el.min > 1 ? 25 : 7; el.dispatchEvent(new Event("input")); });
    host.querySelectorAll("input.txt").forEach((el) => { el.value = "test field"; el.dispatchEvent(new Event("input")); });
    host.querySelectorAll(".vas").forEach((box) => {
      const t = box.querySelector(".vas-track"), b = t.getBoundingClientRect();
      const ev = (type) => new PointerEvent(type, { clientX: b.left + b.width * (0.2 + 0.6 * r()), clientY: b.top + 2, pointerId: 1, bubbles: true });
      try { t.dispatchEvent(ev("pointerdown")); t.dispatchEvent(ev("pointerup")); } catch (e) { /* noop */ }
    });
  }

  window.WFSurvey = { run, autofill, paginate, skipCurrent, abortCurrent };
})();

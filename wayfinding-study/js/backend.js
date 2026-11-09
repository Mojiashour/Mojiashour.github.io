/**
 * v4.3 pluggable data backend.
 *
 * The experiment is a static HTML/JS app (GitHub Pages has no server). Saves always
 * go to localStorage first. A backend adapter then POSTs the participant's files
 * at checkpoints and at the end. If the remote save fails, the end screen offers a
 * local download.
 *
 * Configure with assets/backend-config.json or window.WF_BACKEND_CONFIG.
 * Do not put Google passwords, Box tokens, or service-account keys in either place.
 *
 * Adapters
 *   auto       — try local (tools/server.py POST /api/save), then gas / remote / box / datapipe
 *   local      — POST /api/save (lab / tools/server.py)
 *   gas        — Google Apps Script web app → Cornell Google Drive (PRIMARY for online)
 *                text/plain POST, shared-token in the body, follows Apps Script 302 echo,
 *                CORS then no-cors fallback, retries; also best-effort local save for lab
 *   remote_post — POST cfg.endpoint as JSON (generic relay)
 *   box_relay  — same wire format as remote_post, for a Box JWT/CCG relay URL
 *   datapipe   — POST each file to pipe.jspsych.org/api/data/ (needs experimentId)
 *   none       — skip remote save (download fallback only)
 *
 * WFBackend.save(payload) -> Promise<{ok, adapter, error, unconfirmed}>
 * WFBackend.register(name, fn) to add an adapter without editing this file.
 */
(function () {
  "use strict";

  const DEFAULTS = {
    adapter: "auto",
    endpoint: "",
    experimentId: "",
    token: "",
    localPath: "api/save",
    datapipeUrl: "https://pipe.jspsych.org/api/data/",
    headers: {},
    timeoutMs: 20000,
    retries: 3,
    retryDelayMs: 1000,
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function loadConfig() {
    if (window.WF_BACKEND_CONFIG) return Object.assign({}, DEFAULTS, window.WF_BACKEND_CONFIG);
    try {
      const r = await fetch("assets/backend-config.json", { cache: "no-store" });
      if (r.ok) return Object.assign({}, DEFAULTS, await r.json());
    } catch (e) { /* missing config is fine */ }
    return Object.assign({}, DEFAULTS);
  }

  function withTimeout(promise, ms) {
    if (!ms) return promise;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timeout")), ms);
      promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  }

  async function withRetries(fn, cfg) {
    const n = Math.max(1, cfg.retries == null ? 3 : cfg.retries);
    const base = cfg.retryDelayMs || 1000;
    let last;
    for (let i = 0; i < n; i++) {
      try { return await fn(); }
      catch (e) {
        last = e;
        if (i < n - 1) await sleep(base * Math.pow(2, i));
      }
    }
    throw last;
  }

  async function postJson(url, body, cfg) {
    const r = await withTimeout(fetch(url, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, cfg.headers || {}),
      body: JSON.stringify(body),
    }), cfg.timeoutMs);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      const err = new Error("http_" + r.status);
      err.status = r.status; err.body = text.slice(0, 300);
      throw err;
    }
    let json = null;
    try { json = await r.json(); } catch (e) { json = { ok: true }; }
    return json;
  }

  /**
   * POST a JSON payload as text/plain so the browser treats it as a "simple"
   * request and does not send a CORS preflight (application/json would).
   * Google Apps Script web apps often omit Access-Control-Allow-Origin; if the
   * cors-mode read fails after the request was likely delivered, we retry with
   * mode: "no-cors". An opaque success cannot be verified, so the result is
   * marked unconfirmed.
   *
   * No custom headers — those would trigger a preflight.
   */
  async function readJsonResponse(r) {
    const text = await r.text().catch(() => "");
    if (!r.ok) {
      const err = new Error("http_" + r.status);
      err.status = r.status; err.body = String(text).slice(0, 300);
      throw err;
    }
    if (!text) return { ok: true };
    try { return JSON.parse(text); }
    catch (e) {
      // Apps Script ContentService may return text/plain; treat non-JSON 200 as ok
      // only when the body is empty-ish. Otherwise surface it.
      const err = new Error("bad_json_response");
      err.status = r.status; err.body = String(text).slice(0, 300);
      throw err;
    }
  }

  /**
   * Apps Script web apps respond to POST /exec with a 302 to
   * script.googleusercontent.com/macros/echo?... and put the JSON body there.
   * fetch({redirect:"follow"}) turns that into a GET of the echo URL. Both hops
   * send Access-Control-Allow-Origin: *, so cors mode can read the final JSON.
   * Content-Type is text/plain, so we parse text rather than relying on r.json().
   */
  async function postTextPlain(url, obj, cfg) {
    const body = JSON.stringify(obj);
    const send = (mode) => withTimeout(fetch(url, {
      method: "POST",
      mode: mode,
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    }), cfg.timeoutMs);

    try {
      const r = await send("cors");
      const json = await readJsonResponse(r);
      if (json && json.ok === false) throw new Error(json.error || "remote_rejected");
      return { json, unconfirmed: false };
    } catch (e) {
      // If we got a readable HTTP/parse error, don't pretend it succeeded.
      if (e && (e.status || (e.message && String(e.message).indexOf("remote_rejected") >= 0) || (e.message && String(e.message).indexOf("unauthorized") >= 0) || (e.message && String(e.message).indexOf("bad_json") >= 0))) throw e;
      if (e && e.message && !/failed to fetch|networkerror|load failed|timeout/i.test(String(e.message)) && e.message !== "timeout") {
        // Prefer surfacing script rejections (unauthorized, etc.) over a silent no-cors "success".
        if (/unauthorized|remote_rejected|empty_body|bad_participant/.test(String(e.message))) throw e;
      }
      // Network / CORS failure (often TypeError: Failed to fetch): retry with
      // no-cors so the script still receives the body. The result is unverified.
      const r = await send("no-cors");
      return { json: null, unconfirmed: true, opaque: r && r.type };
    }
  }

  function gasPayload(payload, cfg) {
    return {
      token: cfg.token || "",
      participantId: payload.participantId,
      reason: payload.reason,
      files: payload.files,
      meta: payload.meta || {},
      experimentId: cfg.experimentId || "",
    };
  }

  const adapters = {
    async local(payload, cfg) {
      const json = await postJson(cfg.localPath || "api/save", {
        participantId: payload.participantId,
        reason: payload.reason,
        files: payload.files,
        meta: payload.meta || {},
      }, cfg);
      return { ok: true, adapter: "local", detail: json };
    },

    /** Primary online backend: Apps Script web app writing to Cornell Google Drive. */
    async gas(payload, cfg) {
      if (!cfg.endpoint) throw new Error("gas_no_endpoint");
      const result = await withRetries(() => postTextPlain(cfg.endpoint, gasPayload(payload, cfg), cfg), cfg);
      return { ok: true, adapter: "gas", unconfirmed: !!result.unconfirmed, detail: result.json };
    },

    async remote_post(payload, cfg) {
      if (!cfg.endpoint) throw new Error("remote_post_no_endpoint");
      const json = await postJson(cfg.endpoint, {
        token: cfg.token || "",
        participantId: payload.participantId,
        reason: payload.reason,
        files: payload.files,
        meta: payload.meta || {},
        experimentId: cfg.experimentId || "",
      }, cfg);
      return { ok: true, adapter: "remote_post", detail: json };
    },

    /**
     * Box relay: POST JSON to a server-side relay that holds Box JWT/CCG credentials.
     * The browser never talks to api.box.com and never holds Box secrets.
     */
    async box_relay(payload, cfg) {
      if (!cfg.endpoint) throw new Error("box_relay_no_endpoint");
      const json = await postJson(cfg.endpoint, {
        token: cfg.token || "",
        participantId: payload.participantId,
        reason: payload.reason,
        files: payload.files,
        meta: payload.meta || {},
        experimentId: cfg.experimentId || "",
        target: "box",
      }, cfg);
      return { ok: true, adapter: "box_relay", detail: json };
    },

    async datapipe(payload, cfg) {
      if (!cfg.experimentId) throw new Error("datapipe_no_experimentId");
      const url = cfg.datapipeUrl || "https://pipe.jspsych.org/api/data/";
      const reason = String(payload.reason || "save").replace(/[^\w.-]/g, "_");
      const isEnd = reason === "end";
      // DataPipe filenames must be unique and cannot be overwritten. Send the full
      // set at the end; at checkpoints send only the session JSON under a unique name.
      const entries = isEnd
        ? Object.entries(payload.files)
        : Object.entries(payload.files).filter(([name]) => name.endsWith("session.json"));
      const uploaded = [];
      for (const [name, data] of entries) {
        const base = name.split("/").pop();
        const filename = isEnd
          ? (payload.participantId + "_" + base)
          : (payload.participantId + "_" + reason + "_" + base);
        await postJson(url, {
          experimentID: cfg.experimentId,
          filename,
          data: typeof data === "string" ? data : JSON.stringify(data),
        }, cfg);
        uploaded.push(filename);
      }
      return { ok: true, adapter: "datapipe", files: uploaded };
    },

    async none() {
      return { ok: false, adapter: "none", error: "disabled" };
    },
  };

  function looksLikeGas(cfg) {
    const ep = String(cfg.endpoint || "");
    return cfg.relayType === "gas" || cfg.adapter === "gas" ||
      /script\.google\.com/i.test(ep) || /macro\/s\//i.test(ep);
  }

  let configP = null;
  function getConfig() { return configP || (configP = loadConfig()); }

  /** Best-effort local save for lab mode (tools/server.py). Short timeout so remote sessions are not delayed. */
  async function tryLocalBestEffort(payload, cfg) {
    try {
      return await adapters.local(payload, Object.assign({}, cfg, { timeoutMs: Math.min(cfg.timeoutMs || 20000, 2000) }));
    } catch (e) {
      return { ok: false, adapter: "local", error: String((e && e.message) || e), status: e && e.status };
    }
  }

  async function save(payload) {
    const cfg = await getConfig();
    const name = cfg.adapter || "auto";
    const tried = [];
    const tryOne = async (n) => {
      tried.push(n);
      const fn = adapters[n];
      if (!fn) throw new Error("unknown_adapter_" + n);
      return fn(payload, cfg);
    };
    try {
      if (name === "auto") {
        // When a Drive endpoint is configured, dual-write: local (lab) + gas (Drive).
        if (cfg.endpoint && (looksLikeGas(cfg) || cfg.token)) {
          const localRes = await tryLocalBestEffort(payload, cfg);
          if (localRes && localRes.ok) tried.push("local");
          try {
            const gasRes = await tryOne("gas");
            return Object.assign({}, gasRes, {
              adapter: localRes && localRes.ok ? "gas+local" : "gas",
              alsoLocal: localRes,
            });
          } catch (e) {
            if (localRes && localRes.ok) {
              return { ok: true, adapter: "local", alsoLocal: localRes, error: String((e && e.message) || e), tried, partialRemote: true };
            }
            throw e;
          }
        }
        try {
          return await tryOne("local");
        } catch (e) {
          if (!cfg.endpoint && !cfg.experimentId) throw e;
          if (cfg.endpoint && (cfg.relayType === "box" || cfg.boxRelay)) return await tryOne("box_relay");
          if (cfg.experimentId) return await tryOne("datapipe");
          if (cfg.endpoint) return await tryOne("remote_post");
          throw e;
        }
      }
      if (name === "gas") {
        // Always write to Drive; also try local so lab mode with server.py keeps a disk copy.
        const localRes = await tryLocalBestEffort(payload, cfg);
        if (localRes && localRes.ok) tried.push("local");
        const gasRes = await tryOne("gas");
        return Object.assign({}, gasRes, {
          adapter: localRes && localRes.ok ? "gas+local" : "gas",
          alsoLocal: localRes,
        });
      }
      return await tryOne(name);
    } catch (e) {
      return { ok: false, adapter: name, error: String((e && e.message) || e), tried, status: e && e.status };
    }
  }

  window.WFBackend = {
    save,
    getConfig,
    register: (n, fn) => { adapters[n] = fn; },
  };
})();

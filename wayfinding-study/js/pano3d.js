/**
 * Pano3D — minimal three.js 360 viewer for the wayfinding SPA (v2; v4: final-render sign geometry + boardFit; v4.3: view animation for corridor transitions).
 *
 *  - Equirect panorama drawn on a large inverted sphere; the shader maps each view
 *    direction straight to equirect (u,v), so there is no sphere-tessellation error.
 *    Convention (same as the Blender renders / sign_overlay.json and Pannellum):
 *      yaw 0 = image centre, +yaw = right, +pitch = up.
 *  - The sign board is a real 3D quad placed at the blank sign's true position
 *    (camera at eye height 1.6 m, sign face 3.35 m ahead, 0.61 x 0.915 m, bottom 1.22 m),
 *    so it projects onto the blank sign exactly at every yaw/pitch/FOV (no parallax: the
 *    camera only rotates, it never translates).
 *  - Board texture: sRGB, mipmapped, max anisotropy. Non-emissive tone mapping in the
 *    shader (white -> ~wall white, slight top-lit gradient taken from the blank sign in
 *    the render) so the board reads as a lit object, not a glowing screen.
 *  - Textures are cached and pre-uploaded to the GPU (renderer.initTexture) so a trial
 *    switch is a uniform swap, not a load.
 */
import * as THREE from "../vendor/three/three.module.min.js";

const D2R = Math.PI / 180;

const PANO_VS = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const PANO_FS = `
uniform sampler2D map;
uniform float hasMap;
varying vec3 vDir;
const float PI = 3.14159265358979;
void main() {
  vec3 d = normalize(vDir);
  float yaw = atan(d.x, -d.z);            // 0 = straight ahead (-Z), + = right
  float pitch = asin(clamp(d.y, -1.0, 1.0));
  vec2 uv = vec2(0.5 + yaw / (2.0 * PI), 0.5 + pitch / PI);
  vec3 c = texture2D(map, uv).rgb;        // raw sRGB values (NoColorSpace)
  gl_FragColor = vec4(mix(vec3(1.0), c, hasMap), 1.0);
}`;

const BOARD_VS = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BOARD_FS = `
uniform sampler2D map;          // sRGB texture -> sampled as linear
uniform sampler2D shadeMap;     // 1 x N vertical light profile of the blank sign (0..1, max = 1)
uniform float lift;             // output for board black (sRGB 0..1)
uniform float gain;             // output for board white (sRGB 0..1)
uniform float shadeStrength;    // 0 = flat, 1 = full blank-sign gradient
uniform float toneOn;
varying vec2 vUv;
vec3 toSRGB(vec3 l) {
  return mix(l * 12.92, 1.055 * pow(max(l, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), l));
}
void main() {
  vec3 s = toSRGB(texture2D(map, vUv).rgb);
  if (toneOn > 0.5) {
    float sh = texture2D(shadeMap, vec2(0.5, vUv.y)).r;
    s = (lift + (gain - lift) * s) * mix(1.0, sh, shadeStrength);
  }
  gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}`;

export class Pano3D {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = Object.assign(
      {
        hfov: 90,
        minPitch: -60,
        maxPitch: 60,
        sign: { xMin: -0.305, xMax: 0.305, yFront: 3.35, zMin: 1.22, zMax: 2.135, eyeZ: 1.6 },
        oversize: 1.0,
        boardFit: "panel",
        boardAspect: 700 / 800,
        tone: { on: true, lift: 0.1, gain: 0.88, shadeStrength: 0.4 },
        preserveDrawingBuffer: false,
      },
      opts
    );
    this.yaw = 0;
    this.pitch = 0;
    this.hfov = this.opts.hfov;
    this.cache = new Map(); // url -> {texture, kind, bytes, shade, ms}
    this.inflight = new Map();
    this._dirty = true;
    this._onFrame = [];

    const r = (this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: !!this.opts.preserveDrawingBuffer,
    }));
    r.outputColorSpace = THREE.LinearSRGBColorSpace; // shaders write final sRGB values themselves
    r.setPixelRatio(window.devicePixelRatio || 1);
    r.domElement.style.display = "block";
    r.domElement.style.width = "100%";
    r.domElement.style.height = "100%";
    r.domElement.style.touchAction = "none";
    r.domElement.style.cursor = "grab";
    container.appendChild(r.domElement);
    this.maxAnisotropy = r.capabilities.getMaxAnisotropy();
    this.maxTextureSize = r.capabilities.maxTextureSize;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 2000);
    this.camera.rotation.order = "YXZ";

    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    this.panoMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: white }, hasMap: { value: 0 } },
      vertexShader: PANO_VS,
      fragmentShader: PANO_FS,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 32), this.panoMat);
    this.sphere.renderOrder = 0;
    this.scene.add(this.sphere);

    const S = this.opts.sign;
    const h = S.zMax - S.zMin;
    // v4: the final renders have a 1.20 x 1.371 m panel (0.8753:1).
    //  'panel' (default): sign-generator v1.5 panel-format boards (7:8 = 0.875) drawn at their own aspect at full
    //     panel height -> 1.1996 x 1.371 m, i.e. the panel is filled (0.2 mm per side) and nothing is stretched.
    //  'contain' (legacy 2:3 boards): full height, 0.914 m wide, centred (about 14 cm of panel each side).
    //  'stretch' (legacy 2:3 boards): fills the whole panel, text 31% wider (comparison only).
    const w = this.opts.boardFit === "stretch" ? S.xMax - S.xMin : Math.min(S.xMax - S.xMin, h * (this.opts.boardAspect || 700 / 800));
    // Blender world (x right, y forward, z up) -> three (x right, y up, -z forward)
    this.boardMat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: white },
        shadeMap: { value: white },
        lift: { value: this.opts.tone.lift },
        gain: { value: this.opts.tone.gain },
        shadeStrength: { value: this.opts.tone.shadeStrength },
        toneOn: { value: this.opts.tone.on ? 1 : 0 },
      },
      vertexShader: BOARD_VS,
      fragmentShader: BOARD_FS,
      depthTest: false,
      depthWrite: false,
    });
    this.board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.boardMat);
    // drawn after (in front of) the r=1000 panorama sphere; depth test off
    this.board.position.set((S.xMin + S.xMax) / 2, (S.zMin + S.zMax) / 2 - S.eyeZ, -S.yFront); // exactly on the blank sign face
    this.board.scale.setScalar(this.opts.oversize);
    this.board.renderOrder = 1;
    this.board.visible = false;
    this.scene.add(this.board);

    this._bindPointer();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      if (this._dirty) {
        this._dirty = false;
        this._render();
        const cbs = this._onFrame;
        this._onFrame = [];
        cbs.forEach((cb) => cb(performance.now()));
      }
    };
    this._raf = requestAnimationFrame(loop);
  }

  /* ---------------- view ---------------- */
  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this._applyFov();
    this._dirty = true;
  }
  _applyFov() {
    const vfov = 2 * Math.atan(Math.tan((this.hfov * D2R) / 2) / this.camera.aspect) / D2R;
    this.camera.fov = vfov;
    this.camera.updateProjectionMatrix();
  }
  setView(yaw, pitch, hfov) {
    this.yaw = ((((yaw + 180) % 360) + 360) % 360) - 180;
    this.pitch = Math.max(this.opts.minPitch, Math.min(this.opts.maxPitch, pitch));
    if (hfov != null) {
      this.hfov = hfov;
      this._applyFov();
    }
    this._dirty = true;
  }
  getYaw() { return this.yaw; }
  getPitch() { return this.pitch; }
  getHfov() { return this.hfov; }
  _render() {
    this.camera.rotation.set(this.pitch * D2R, -this.yaw * D2R, 0);
    this.renderer.render(this.scene, this.camera);
  }
  /** resolves after the next frame containing the current state has been drawn */
  nextFrame() {
    this._dirty = true;
    return new Promise((res) => this._onFrame.push(res));
  }
  _bindPointer() {
    const el = this.renderer.domElement;
    let drag = null;
    el.addEventListener("pointerdown", (e) => {
      if (!this.interactive) return;
      drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const degPerPx = this.hfov / Math.max(1, el.clientWidth);
      // grab-and-drag (like Pannellum): the scene follows the cursor
      this.setView(drag.yaw - (e.clientX - drag.x) * degPerPx, drag.pitch + (e.clientY - drag.y) * degPerPx);
      if (this.onViewChange) this.onViewChange(this.yaw, this.pitch);
    });
    const end = () => {
      drag = null;
      el.style.cursor = "grab";
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    this.interactive = true;
  }

  /* ---------------- assets ----------------
   * Two tiers so 8192x4096 finals still fit in GPU memory:
   *   prefetch(url)          -> compressed file bytes held in RAM (Blob); no network at trial time
   *   load(url, kind)        -> decode + upload to the GPU (texture ready to show instantly)
   *   evict(url)             -> free the GPU texture (bytes stay prefetched)
   * The app keeps only the current + next few trials resident (CONFIG.GPU_WINDOW).
   */
  prefetch(url) {
    if (!this.blobs) this.blobs = new Map();
    if (this.blobs.has(url)) return this.blobs.get(url);
    const t0 = performance.now();
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
      return r.blob();
    }).then((b) => {
      b.__ms = Math.round(performance.now() - t0);
      this.prefetchedBytes = (this.prefetchedBytes || 0) + b.size;
      return b;
    });
    this.blobs.set(url, p);
    p.catch(() => this.blobs.delete(url));
    return p;
  }

  load(url, kind) {
    if (this.cache.has(url)) return Promise.resolve(this.cache.get(url));
    if (this.inflight.has(url)) return this.inflight.get(url);
    const t0 = performance.now();
    let objUrl = null;
    const p = this.prefetch(url)
      .then((blob) => new Promise((resolve, reject) => {
        objUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Could not decode " + url));
        img.src = objUrl;
      }))
      .then((img) => (img.decode ? img.decode().then(() => img, () => img) : img))
      .then((img) => {
        const tDecoded = performance.now();
        if (img.naturalWidth > this.maxTextureSize) {
          console.warn(`[pano3d] ${url} is ${img.naturalWidth}px wide; GPU max texture is ${this.maxTextureSize}px`);
        }
        const tex = new THREE.Texture(img);
        let bytes;
        let shade = null;
        if (kind === "pano") {
          tex.colorSpace = THREE.NoColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.minFilter = THREE.LinearFilter; // no mipmaps: avoids the atan2 seam; pano is magnified at hfov 90
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          bytes = img.naturalWidth * img.naturalHeight * 4;
          if (!this.shades) this.shades = new Map();
          if (!this.shades.has(url)) {
            const sh = this._shadeProfile(img);
            this.renderer.initTexture(sh);
            this.shades.set(url, sh);
          }
          shade = this.shades.get(url);
        } else {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.generateMipmaps = true;
          tex.anisotropy = this.maxAnisotropy;
          bytes = Math.round(img.naturalWidth * img.naturalHeight * 4 * 4 / 3);
        }
        tex.needsUpdate = true;
        this.renderer.initTexture(tex); // upload now, not at first display
        // the GPU copy is all we need; let the browser drop the decoded image
        tex.image = { width: img.naturalWidth, height: img.naturalHeight };
        tex.needsUpdate = false;
        URL.revokeObjectURL(objUrl);
        const entry = {
          url, kind, texture: tex, shade, bytes,
          width: img.naturalWidth, height: img.naturalHeight,
          ms_total: Math.round(performance.now() - t0),
          ms_upload: Math.round(performance.now() - tDecoded),
        };
        this.cache.set(url, entry);
        this.inflight.delete(url);
        return entry;
      })
      .catch((err) => {
        this.inflight.delete(url);
        if (objUrl) URL.revokeObjectURL(objUrl);
        throw err;
      });
    this.inflight.set(url, p);
    return p;
  }

  evict(url) {
    const e = this.cache.get(url);
    if (!e) return;
    if (this.panoMat.uniforms.map.value === e.texture || this.boardMat.uniforms.map.value === e.texture) return; // on screen
    e.texture.dispose();
    this.cache.delete(url);
  }

  /** vertical light profile of the blank sign in this render (normalised so max = 1) */
  _shadeProfile(img) {
    const S = this.opts.sign;
    const W = img.naturalWidth, H = img.naturalHeight;
    const horiz = Math.hypot(S.yFront, S.xMax);
    const yawR = Math.atan2(S.xMax, S.yFront) / D2R;
    const pTop = Math.atan2(S.zMax - S.eyeZ, horiz) / D2R;
    const pBot = Math.atan2(S.zMin - S.eyeZ, horiz) / D2R;
    // inner 60 % of the width, inset 3 % top/bottom so no wall pixels are sampled
    const u0 = (0.5 - (0.6 * yawR) / 360) * W, u1 = (0.5 + (0.6 * yawR) / 360) * W;
    const vT = (0.5 - pTop / 180) * H, vB = (0.5 - pBot / 180) * H;
    const inset = 0.03 * (vB - vT);
    const N = 64;
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = N;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, u0, vT + inset, u1 - u0, vB - vT - 2 * inset, 0, 0, 8, N);
    const d = g.getImageData(0, 0, 8, N).data;
    const prof = new Float32Array(N);
    let max = 0;
    for (let y = 0; y < N; y++) {
      let s = 0;
      for (let x = 0; x < 8; x++) {
        const i = (y * 8 + x) * 4;
        s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      }
      prof[y] = s / 8;
      max = Math.max(max, prof[y]);
    }
    // texture row 0 = bottom of the quad (uv.y = 0) -> reverse image rows
    const data = new Uint8Array(N * 4);
    for (let y = 0; y < N; y++) {
      const v = Math.round((prof[N - 1 - y] / (max || 1)) * 255);
      data.set([v, v, v, 255], y * 4);
    }
    const t = new THREE.DataTexture(data, 1, N);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    t.userData.profile = Array.from(prof, (v) => Math.round(v));
    return t;
  }

  /** show a cached panorama (+ optional board); returns after it is on screen */
  show(panoEntry, boardEntry, view) {
    this.panoMat.uniforms.map.value = panoEntry.texture;
    this.panoMat.uniforms.hasMap.value = 1;
    if (boardEntry) {
      this.boardMat.uniforms.map.value = boardEntry.texture;
      this.boardMat.uniforms.shadeMap.value = panoEntry.shade;
      this.board.visible = true;
    } else {
      this.board.visible = false;
    }
    const v = view || {};
    this.setView(v.yaw || 0, v.pitch || 0, v.hfov || this.opts.hfov);
    return this.nextFrame();
  }
  setBoardVisible(on) { this.board.visible = !!on; this._dirty = true; }
  setOversize(k) { this.board.scale.setScalar(k); this._dirty = true; }
  setTone(t) {
    const u = this.boardMat.uniforms;
    if (t.on != null) u.toneOn.value = t.on ? 1 : 0;
    if (t.lift != null) u.lift.value = t.lift;
    if (t.gain != null) u.gain.value = t.gain;
    if (t.shadeStrength != null) u.shadeStrength.value = t.shadeStrength;
    this._dirty = true;
  }
  setInteractive(on) { this.interactive = !!on; }
  _lerp(a, b, t) { return a + (b - a) * t; }
  _lerpAngle(a, b, t) {
    let d = ((b - a + 180) % 360 + 360) % 360 - 180;
    return a + d * t;
  }
  _easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  /**
   * Animate yaw / pitch / hfov over `duration` ms. Optional footstep-like pitch bob.
   * onTick(t01, now) is called each frame. Resolves when the animation completes.
   * Pointer look-around is disabled for the duration and restored to its prior value.
   */
  animateTo(opts, onTick) {
    const o = opts || {};
    const duration = Math.max(0, o.duration == null ? 800 : o.duration);
    const y1 = o.yaw != null ? o.yaw : this.yaw;
    const p1 = o.pitch != null ? o.pitch : this.pitch;
    const h1 = o.hfov != null ? o.hfov : this.hfov;
    const bobAmp = o.bobAmp || 0;
    const bobCycles = o.bobCycles == null ? 2 : o.bobCycles;
    const y0 = this.yaw, p0 = this.pitch, h0 = this.hfov;
    const prevInteractive = this.interactive;
    this.interactive = false;
    if (duration <= 0) {
      this.setView(y1, p1, h1);
      if (onTick) onTick(1, performance.now());
      this.interactive = prevInteractive;
      return this.nextFrame();
    }
    const ease = o.ease || ((t) => this._easeInOutCubic(t));
    return new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = ease(t);
        const bob = bobAmp ? bobAmp * Math.sin(2 * Math.PI * bobCycles * t) * Math.sin(Math.PI * t) : 0;
        this.setView(this._lerpAngle(y0, y1, e), this._lerp(p0, p1, e) + bob, this._lerp(h0, h1, e));
        if (onTick) onTick(t, now);
        if (t < 1) requestAnimationFrame(step);
        else {
          this.setView(y1, p1, h1);
          this.interactive = prevInteractive;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  /** board corners in CSS px of the canvas (for alignment tests) */
  boardCornersPx() {
    this.camera.rotation.set(this.pitch * D2R, -this.yaw * D2R, 0);
    this.camera.updateMatrixWorld();
    this.board.updateMatrixWorld();
    const el = this.renderer.domElement;
    const hw = 0.5, hh = 0.5;
    return [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]].map(([x, y]) => {
      const g = this.board.geometry.parameters;
      const v = new THREE.Vector3(x * g.width, y * g.height, 0).applyMatrix4(this.board.matrixWorld).project(this.camera);
      return [((v.x + 1) / 2) * el.clientWidth, ((1 - v.y) / 2) * el.clientHeight];
    });
  }
  stats() {
    let pano = 0, board = 0, nP = 0, nB = 0;
    for (const e of this.cache.values()) {
      if (e.kind === "pano") { pano += e.bytes; nP++; } else { board += e.bytes; nB++; }
    }
    const info = this.renderer.info.memory;
    return {
      panoramas: nP, boards: nB,
      gpu_mb_panoramas: +(pano / 1048576).toFixed(1),
      gpu_mb_boards: +(board / 1048576).toFixed(1),
      gpu_mb_total_est: +((pano + board) / 1048576).toFixed(1),
      ram_mb_prefetched_files: +((this.prefetchedBytes || 0) / 1048576).toFixed(1),
      three_textures: info.textures, three_geometries: info.geometries,
      maxAnisotropy: this.maxAnisotropy, maxTextureSize: this.maxTextureSize,
    };
  }
}

window.Pano3D = Pano3D;
window.dispatchEvent(new Event("pano3d-ready"));

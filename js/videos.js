/* Videos tab: the room photo (assets/vhs/room.webp) fills the tab.
   Tap the TV: the camera zooms in until the photo's black TV bezel lands exactly on the border
   (assets/vhs/frame.webp, the same bezel), which fades in over it, so the TV *becomes* the border.
   Inside: a grainy menu of video titles. Pick one: the screen flickers and the video plays; when it
   ends it goes back to the menu. The green readout above the frame plays/pauses; the arrow goes
   back (video -> menu -> room).
   The list is content/videos.json (edited in Pages CMS, "Videos (TV)"): a title plus either a
   YouTube link or an uploaded video file (assets/videos/, played with a plain <video>).
   Secret codes (also in content/videos.json): tap the VCR clock, type 4 digits, and a matching
   code zooms straight into the TV showing its photo or video. */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const stage = $("#vhsStage");
  if (!stage || !window.OCYT) return;

  const room = $("#vhsRoom"), glass = $(".vhs-glass"), led = $("#vcrLed");
  const onBtn = $("#vhsOn"), player = $("#vhsPlayer"), frame = $(".vhs-frame");
  const screen = $(".vhs-video"), menu = $("#vhsMenu"), list = $("#vhsList"), flicker = $("#vhsFlicker");
  const back = $("#vhsBack"), pp = $("#vhsPP"), now = $("#vhsNow"), view = $("#videos");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!window.gsap && !reduced;
  const OCBg = window.OCBg || { duck() {}, unduck() {} };
  const BG = { duck: () => OCBg.duck("tv"), unduck: () => OCBg.unduck("tv") };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let videos = [], secrets = [];

  // The photo's black TV bezel as fractions of the photo (--bz-* in css/style.css; the wide photo
  // and the tall phone photo each have their own). The .vhs-frame box is this bezel's shape.
  function bezel() {
    const cs = getComputedStyle(stage), v = n => parseFloat(cs.getPropertyValue(n));
    return { l: v("--bz-l"), t: v("--bz-t"), w: v("--bz-w"), h: v("--bz-h") };
  }

  /* ---------- The menu list (content/videos.json) ---------- */
  // Any YouTube link (watch?v=, youtu.be/, /shorts/, /embed/, /live/) or a bare 11-character ID.
  function ytId(link) {
    const s = String(link || "").trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    const m = s.match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([\w-]{11})/);
    return m ? m[1] : "";
  }
  function render() {
    list.innerHTML = videos.length
      ? videos.map((v, i) => `<li><button class="vhs-item" data-i="${i}" aria-label="${esc(v.title)}"><i aria-hidden="true"></i><span>${esc(v.title)}</span></button></li>`).join("")
      : `<li class="vhs-empty">NO TAPES YET</li>`;
    requestAnimationFrame(moreHint);
  }
  // the bottom of the list fades out while there are more titles below
  function moreHint() { list.classList.toggle("is-more", list.scrollTop + list.clientHeight < list.scrollHeight - 2); }
  list.addEventListener("scroll", moreHint, { passive: true });
  // Loaded when the page opens and again each time the TV is turned on, so new videos show up
  // without a reload (but never swapped out while one is playing).
  function loadList() {
    return fetch("content/videos.json", { cache: "no-cache" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const item = v => ({ title: String(v.title || "").trim(), image: String(v.image || "").trim(),
          file: String(v.file || "").trim(), id: ytId(v.video), zoom: +v.zoom || 0,
          fit: /whole/i.test(v.fit || "") ? "whole" : "auto" });
        secrets = ((d && d.secrets) || [])
          .map(v => ({ ...item(v), code: String(v.code || "").replace(/\D/g, ""), title: String(v.title || "").trim() || "Secret" }))
          .filter(v => v.code.length === 4 && (v.image || v.file || v.id));
        const next = ((d && d.videos) || []).map(item).filter(v => v.title && (v.image || v.file || v.id));
        if (current === null && JSON.stringify(next) !== JSON.stringify(videos)) { videos = next; render(); }
      })
      .catch(() => {});
  }
  render();
  loadList();

  /* ---------- State ---------- */
  let on = false, busy = false, current = null, playing = false;
  let item = null;                                     // what's on the screen (a video from the list, or a secret)
  let yt = null, ytReady = null;

  function setLed(t, blink) { led.textContent = t; led.classList.toggle("blink", !!blink); }
  function setPP() {
    pp.textContent = playing ? "PLAY" : "PAUSE";
    pp.classList.toggle("blink", !playing);
    pp.setAttribute("aria-label", playing ? "Pause" : "Play");
  }
  function status() {   // read out to screen readers only
    if (!on) now.textContent = "";
    else if (current === null) now.textContent = "Pick a tape.";
    else now.textContent = `${src === "image" ? "Showing" : playing ? "Playing" : "Paused"}: ${item.title}`;
  }

  /* ---------- Grain: faint static on the idle TV, gray grain behind the menu ---------- */
  function painter(cv) {
    const cx = cv.getContext("2d"), img = cx.createImageData(cv.width, cv.height), d = img.data;
    return gray => {
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * gray; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      cx.putImageData(img, 0, 0);
    };
  }
  const paintTv = painter($("#tvStatic")), paintMenu = painter($("#vhsGrain"));
  let tick = 0;
  (function loop() {
    if (!view.hidden && tick++ % 2 === 0) {            // ~30fps is plenty for static
      if (!on || busy) paintTv(255);
      if (on && !menu.hidden) paintMenu(150);
    }
    requestAnimationFrame(loop);
  })();

  /* ---------- Sound effects (synthesized) ---------- */
  let ac = null;
  function audio() {
    if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); }
    if (ac && ac.state !== "running") ac.resume().catch(() => {});
    return ac;
  }
  function hiss(secs = .6, level = .1) {
    const ctx = audio(); if (!ctx) return; const t = ctx.currentTime;
    const b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.setValueAtTime(level, t); g.gain.linearRampToValueAtTime(0, t + secs);
    n.connect(f); f.connect(g); g.connect(ctx.destination); n.start(t);
  }
  function thunk() {   // the power switch
    const ctx = audio(); if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .14);
    const g = ctx.createGain(); g.gain.setValueAtTime(.35, t); g.gain.exponentialRampToValueAtTime(.001, t + .16);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .17);
  }

  /* ---------- Video ---------- */
  // What happens when playback starts/pauses/ends, from either player.
  // The green PLAY/PAUSE stays locked until the video has really started, and after each press until
  // the player has really done it (pressing it while YouTube was still loading, or rapidly, used to
  // freeze it). If a phone blocks the video from starting, it unlocks after a few seconds anyway.
  let ppTimer = 0;
  function lockPP() {
    clearTimeout(ppTimer); pp.disabled = true;
    ppTimer = setTimeout(() => { if (current !== null && pp.disabled) { pp.disabled = false; if (!isPlayingNow()) { playing = false; setPP(); } } }, 6000);
  }
  function unlockPP() { clearTimeout(ppTimer); pp.disabled = false; }
  function isPlayingNow() {                            // what the player is really doing (not what we last asked)
    if (src === "file") return !fileEl.paused && !fileEl.ended;
    const st = yt && yt.getPlayerState ? yt.getPlayerState() : -1;
    return st === OCYT.PLAYING || st === OCYT.BUFFERING;
  }
  function onPlaying() { playing = true; BG.duck(); setPP(); status(); unlockPP(); }
  function onPaused() { playing = false; BG.unduck(); setPP(); status(); unlockPP(); }
  function onEnded() { playing = false; setTimeout(() => { if (current !== null) toMenu(); }, 600); }

  /* an uploaded file plays in a plain <video> (no YouTube buttons at all) */
  const fileEl = $("#vhsFile");
  let src = "yt";                                      // which player the current video uses
  const isFile = () => src === "file" && current !== null;
  fileEl.addEventListener("playing", () => { if (isFile()) onPlaying(); });
  fileEl.addEventListener("pause", () => { if (isFile() && !fileEl.ended) onPaused(); });
  fileEl.addEventListener("ended", () => { if (isFile()) onEnded(); });
  fileEl.addEventListener("error", () => { if (isFile() && fileEl.getAttribute("src")) onEnded(); });   // a missing file just goes back to the menu

  /* ---------- Fitting the picture to the screen ----------
     A video's real picture can be smaller than its frame: a square or vertical video inside a 16:9
     YouTube player, or black bars baked into the video itself. Auto finds the picture (from the
     YouTube thumbnail, or from the uploaded file's own frames) and scales it to fill the screen
     corner to corner, cropping only what it has to. "Whole picture" shows all of it instead, with
     black around it. A Zoom number (Pages CMS) overrides both. */
  const FULL = { x: 0, y: 0, w: 1, h: 1 };
  const YT_PAD = 64;                                   // px of YouTube player kept off-screen above and below
  let fitRect = FULL;                                  // where the picture sits inside the frame (fractions)
  // Finds the picture inside an image or video frame by trimming near-black bars off the edges.
  function findPicture(src, sw, sh) {
    try {
      const W = 160, H = Math.max(1, Math.round(W * sh / sw));
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(src, 0, 0, W, H);
      const d = cx.getImageData(0, 0, W, H).data;
      const lum = (x, y) => { const i = (y * W + x) * 4; return .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; };
      const isBar = (n, at) => { let sum = 0, max = 0; for (let k = 0; k < n; k++) { const l = at(k); sum += l; if (l > max) max = l; } return sum / n < 20 && max < 60; };
      let x0 = 0, x1 = W - 1, y0 = 0, y1 = H - 1;
      while (x0 < x1 && isBar(H, y => lum(x0, y))) x0++;
      while (x1 > x0 && isBar(H, y => lum(x1, y))) x1--;
      while (y0 < y1 && isBar(W, x => lum(x, y0))) y0++;
      while (y1 > y0 && isBar(W, x => lum(x, y1))) y1--;
      const r = { x: x0 / W, y: y0 / H, w: (x1 - x0 + 1) / W, h: (y1 - y0 + 1) / H };
      if (r.w * r.h < .2) return null;                 // mostly black (a dark or fading frame): no idea
      // ignore slivers (compression edges), keep real bars
      if (r.x < .02) { r.w += r.x; r.x = 0; } if (1 - r.x - r.w < .02) r.w = 1 - r.x;
      if (r.y < .02) { r.h += r.y; r.y = 0; } if (1 - r.y - r.h < .02) r.h = 1 - r.y;
      return r;
    } catch (_) { return null; }                       // e.g. a file from another site (can't read its pixels)
  }
  // YouTube: the picture's place inside the 16:9 player, from the video's thumbnail (cached per video)
  const ytFits = {};
  function ytPicture(id) {
    if (ytFits[id]) return ytFits[id];
    const load = q => new Promise(res => {
      const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => res(im); im.onerror = () => res(null);
      im.src = `https://i.ytimg.com/vi/${id}/${q}.jpg`;
    });
    return (ytFits[id] = (async () => {
      const big = await load("maxresdefault");         // a 16:9 frame, same shape as the player
      if (big && big.naturalWidth > 200) return findPicture(big, big.naturalWidth, big.naturalHeight) || FULL;
      // no big thumbnail: the 4:3 one only tells the picture's shape; YouTube centers it in the player
      const hq = await load("hqdefault");
      const r = hq && findPicture(hq, hq.naturalWidth, hq.naturalHeight);
      if (!r) return FULL;
      const a = (r.w * hq.naturalWidth) / (r.h * hq.naturalHeight), f = 16 / 9;
      return a < f ? { x: (1 - a / f) / 2, y: 0, w: a / f, h: 1 } : { x: 0, y: (1 - f / a) / 2, w: 1, h: f / a };
    })());
  }
  // Sizes and places the player/file so the picture fills (or, "whole", fits inside) the screen.
  function layout() {
    if (!item || src === "image") return;
    const el = src === "file" ? fileEl : (screen.querySelector("iframe") || $("#tvPlayer"));
    const fw = src === "file" ? fileEl.videoWidth : 16, fh = src === "file" ? fileEl.videoHeight : 9;
    if (!el || !fw || !fh) return;
    const Sw = screen.clientWidth, Sh = screen.clientHeight, r = fitRect;
    const pw = r.w * fw, ph = r.h * fh;                // the picture, in frame units
    // Auto fills the screen, unless that would cut off more than 40% of the picture (a vertical
    // video, or a very wide one): then it shows the whole picture instead
    const pa = pw / ph, sa = Sw / Sh, cut = 1 - Math.min(pa, sa) / Math.max(pa, sa);
    const whole = item.fit === "whole" || cut > .4;
    const s = item.zoom ? Math.max(Sw / fw, Sh / fh) * item.zoom
      : whole ? Math.min(Sw / pw, Sh / ph)
      : Math.max(Sw / pw, Sh / ph) * 1.01;             // a hair of overscan so no edge peeks through
    // YouTube draws its title, channel name and logo along the top and bottom of its player (and on
    // phones it ignores the setting that hides them), so its player gets an extra strip above and
    // below the picture: YouTube centers the video in the taller player, and those strips (with
    // the title and logo in them) sit outside the screen.
    const pad = src === "yt" ? YT_PAD : 0;
    Object.assign(el.style, {
      width: fw * s + "px", height: fh * s + 2 * pad + "px",
      left: Sw / 2 - (r.x + r.w / 2) * fw * s + "px", top: Sh / 2 - (r.y + r.h / 2) * fh * s - pad + "px"
    });
    el.classList.add("is-fitted");
  }
  function unfit() {
    fitRect = FULL;
    [fileEl, screen.querySelector("iframe") || $("#tvPlayer")].forEach(el => {
      if (!el) return; el.classList.remove("is-fitted"); ["width", "height", "left", "top"].forEach(k => el.style.removeProperty(k));
    });
  }
  function fitYouTube(v) {
    fitRect = FULL; layout();
    if (v.zoom || !v.id) return;
    ytPicture(v.id).then(r => { if (item === v) { fitRect = r; layout(); } });
  }
  // an uploaded file: look at a couple of its frames once it's playing (a fade from black is skipped)
  let fileChecks = [];
  function fitFile(v) {
    fileChecks.forEach(clearTimeout); fileChecks = [];
    const look = () => {
      if (item !== v || v.zoom || !fileEl.videoWidth) return;
      const r = findPicture(fileEl, fileEl.videoWidth, fileEl.videoHeight);
      if (!r) return;
      // keep the larger picture across checks, so a dark moment never zooms in further
      if (fitRect === FULL || r.w * r.h >= fitRect.w * fitRect.h) { fitRect = r; layout(); }
    };
    fileEl.addEventListener("loadedmetadata", () => { if (item === v) { fitRect = FULL; layout(); } }, { once: true });
    fileEl.addEventListener("playing", () => {
      if (item !== v) return;
      fileChecks = [setTimeout(look, 700), setTimeout(look, 2500), setTimeout(look, 6000)];
    }, { once: true });
  }
  addEventListener("resize", () => { if (on && item) layout(); });

  function ensurePlayer(id) {
    if (ytReady) return ytReady;
    return (ytReady = OCYT.load().then(() => new Promise(resolve => {
      yt = OCYT.create("tvPlayer", id, {
        onReady: () => resolve(),
        onStateChange: e => {
          if (current === null || src !== "yt") return;
          if (e.data === OCYT.PLAYING) onPlaying();
          else if (e.data === OCYT.PAUSED) onPaused();
          else if (e.data === OCYT.ENDED) onEnded();
        }
      });
    })));
  }
  function stopVideo() {
    clearTimeout(ppTimer);
    try { yt && yt.stopVideo && yt.stopVideo(); } catch (_) {}
    if (fileEl.getAttribute("src")) { fileEl.pause(); fileEl.removeAttribute("src"); fileEl.load(); }
    imageEl.removeAttribute("src");
    fileChecks.forEach(clearTimeout); unfit();
    if (playing) BG.unduck();
    playing = false; current = null; item = null;
  }
  function doFlicker() {
    flicker.classList.remove("is-on"); void flicker.offsetWidth; flicker.classList.add("is-on");
    hiss(.7);
  }

  const imageBox = $("#vhsImage"), imageEl = imageBox.querySelector("img");
  function playTape(i) { if (videos[i] && !busy) playItem(videos[i], i); }
  // Puts a video or photo on the screen. `instant` (a secret code): no flicker, the menu is skipped.
  function playItem(v, idx, instant) {
    busy = true;
    current = idx; item = v;
    src = v.image ? "image" : v.file ? "file" : "yt";
    screen.dataset.src = src;
    screen.style.setProperty("--zoom", v.zoom || 1);   // (photos)
    if (src === "image") {                             // a photo: no sound, so the music keeps playing
      playing = false;
      imageEl.src = v.image;
      imageBox.firstElementChild.style.backgroundImage = `url("${v.image.replace(/"/g, "%22")}")`;
    } else {
      BG.duck();                                       // before stopping the record, so the music never sneaks back in
      if (window.OCDeck && window.OCDeck.playing) window.OCDeck.toggle();   // stop a song on the record
      playing = true; setPP();
    }
    status();
    if (src === "file") {
      fitFile(v);
      // started right here in the click, so browsers allow it to play with sound
      fileEl.src = v.file;
      fileEl.play().catch(() => { if (isFile()) { playing = false; setPP(); } });
    }
    const show = () => {
      menu.hidden = true; pp.hidden = src === "image";
      if (src !== "image") lockPP();
      if (src === "yt") {
        const go = () => { yt.loadVideoById(v.id); fitYouTube(v); };
        yt && yt.loadVideoById ? go() : ensurePlayer(v.id).then(go);
      }
      if (!instant) busy = false;
    };
    if (instant) { show(); return; }
    doFlicker();
    setTimeout(show, reduced ? 0 : 380);
  }
  function toMenu() {
    stopVideo(); status();
    pp.hidden = true;
    doFlicker();
    setTimeout(() => {
      menu.hidden = false; moreHint();
      const first = list.querySelector(".vhs-item"); first && first.focus({ preventScroll: true });
    }, reduced ? 0 : 380);
  }

  /* ---------- Room <-> frame: the photo's TV screen is zoomed onto the frame's opening ---------- */
  // Where the frame sits once zoomed in, and the room transform that puts the photo's bezel there.
  function measure() {   // the player must be laid out (not display:none) to measure
    gsap.set(frame, { clearProps: "transform" });
    const st = stage.getBoundingClientRect(), fr = frame.getBoundingClientRect();
    const rw = room.offsetWidth, rh = room.offsetHeight;
    const BEZEL = bezel();
    const scale = fr.width / (rw * BEZEL.w);           // same shape, so the height matches too
    const fl = fr.left - st.left, ft = fr.top - st.top;
    return { scale, fl, ft, rw, rh, BEZEL,
      x: fl - room.offsetLeft - rw * BEZEL.l * scale,
      y: ft - room.offsetTop - rh * BEZEL.t * scale };
  }
  // Keeps the border glued to the photo's bezel wherever the room is mid-zoom, so the border can
  // fade in (or out) on top of it at any moment without anything shifting.
  function track(z) {
    const s = gsap.getProperty(room, "scale"), x = gsap.getProperty(room, "x"), y = gsap.getProperty(room, "y");
    gsap.set(frame, {
      transformOrigin: "0 0", scale: s / z.scale,
      x: room.offsetLeft + x + z.rw * z.BEZEL.l * s - z.fl,
      y: room.offsetTop + y + z.rh * z.BEZEL.t * s - z.ft
    });
  }
  // `secret` (from the clock code): zoom straight in with its photo/video already on the screen
  function turnOn(secret) {
    if (on || busy) return;
    on = busy = true; audio(); thunk();
    loadList();
    glass.classList.add("is-loud"); setLed("ON");
    player.hidden = false; pp.hidden = true;
    if (secret) playItem(secret, -1, true);
    else { menu.hidden = false; moreHint(); }
    const done = () => {
      busy = false; setLed("12:00"); status();
      if (secret) return;
      const first = list.querySelector(".vhs-item"); first && first.focus({ preventScroll: true });
      if (videos[0]) ensurePlayer(videos[0].id);       // warm up YouTube while they choose
    };
    if (!hasGsap) { room.style.visibility = "hidden"; done(); return; }
    const z = measure();
    gsap.set(frame, { opacity: 0 }); gsap.set(back, { autoAlpha: 0 });
    track(z);
    // zoom in; the border fades in on top of the photo's bezel (glued to it), then the rest of
    // the room fades slowly into the site's moving background
    gsap.timeline({ onComplete: () => { gsap.set(frame, { clearProps: "transform" }); done(); } })
      .to(room, { scale: z.scale, x: z.x, y: z.y, duration: 1.2, ease: "power2.inOut", onUpdate: () => track(z) }, 0)
      .to(frame, { opacity: 1, duration: .4, ease: "power1.inOut" }, .4)
      .to(room, { autoAlpha: 0, duration: 1, ease: "power1.inOut" }, .8)
      .to(back, { autoAlpha: 1, duration: .3 }, 1.2);
  }
  function turnOff() {
    if (!on || busy) return;
    busy = true;
    stopVideo(); pp.hidden = true;
    const done = () => {
      player.hidden = true; menu.hidden = false;
      on = busy = false;
      glass.classList.remove("is-loud"); setLed("12:00", true); status();
      onBtn.focus({ preventScroll: true });
    };
    if (!hasGsap) { room.style.visibility = ""; done(); return; }
    const z = measure();                                 // re-measured, in case the window changed size
    gsap.set(room, { scale: z.scale, x: z.x, y: z.y, autoAlpha: 0 });
    track(z);
    // the room fades back in behind the border, then the border fades off the photo's bezel as it zooms out
    gsap.timeline({ onComplete: () => { gsap.set([room, frame, back], { clearProps: "all" }); done(); } })
      .to(back, { autoAlpha: 0, duration: .2 }, 0)
      .to(room, { autoAlpha: 1, duration: .7, ease: "power1.inOut" }, 0)
      .to(frame, { opacity: 0, duration: .4, ease: "power1.inOut" }, .75)
      .to(room, { x: 0, y: 0, scale: 1, duration: 1.2, ease: "power2.inOut", onUpdate: () => track(z) }, .6);
  }
  function goBack() {
    if (busy) return;
    if (current !== null) toMenu(); else turnOff();
  }

  onBtn.addEventListener("click", () => turnOn());

  /* ---------- The VCR clock as a code pad ---------- */
  const codeEl = $("#vhsCode");
  let digits = "", errTimer = 0;
  function showDigits() {
    const d = (digits + "____").slice(0, 4);
    setLed(d.slice(0, 2) + ":" + d.slice(2)); led.classList.add("is-entry");
  }
  function clockBack() { clearTimeout(errTimer); led.classList.remove("is-entry"); if (!on) setLed("12:00", true); }
  codeEl.addEventListener("focus", () => {
    if (on || busy) { codeEl.blur(); return; }
    clearTimeout(errTimer); digits = ""; codeEl.value = ""; showDigits(); audio();
    loadList();                                        // pick up codes added since the page opened
  });
  codeEl.addEventListener("input", () => {
    digits = codeEl.value.replace(/\D/g, "").slice(0, 4);
    codeEl.value = digits; showDigits();
    if (digits.length === 4) checkCode();
  });
  codeEl.addEventListener("keydown", e => { if (e.key === "Escape") codeEl.blur(); });
  codeEl.addEventListener("blur", clockBack);
  function checkCode() {
    const s = secrets.find(x => x.code === digits);
    if (s) {
      led.classList.remove("is-entry");
      turnOn(s);                                       // straight into the TV
      codeEl.blur();
      return;
    }
    hiss(.35, .08); setLed("ERR", true);               // wrong code: try again
    errTimer = setTimeout(() => {
      digits = ""; codeEl.value = "";
      document.activeElement === codeEl ? showDigits() : clockBack();
    }, 1200);
  }
  list.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) playTape(+b.dataset.i); });
  list.addEventListener("keydown", e => {            // arrow keys move through the menu like a VCR remote
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...list.querySelectorAll(".vhs-item")], at = items.indexOf(document.activeElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    e.preventDefault();
  });
  pp.addEventListener("click", () => {
    if (current === null || pp.disabled) return;
    const pause = isPlayingNow();
    if (!isFile() && !(yt && yt.getPlayerState)) return;
    lockPP();                                          // until the player reports it has played/paused
    if (isFile()) { pause ? fileEl.pause() : (BG.duck(), fileEl.play().catch(() => unlockPP())); return; }
    if (pause) yt.pauseVideo();
    else { BG.duck(); yt.playVideo(); }
  });
  back.addEventListener("click", goBack);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && on && !view.hidden) goBack(); });

  // Leaving the Videos tab pauses the video.
  new MutationObserver(() => { if (view.hidden && playing) isFile() ? fileEl.pause() : yt && yt.pauseVideo(); })
    .observe(view, { attributes: true, attributeFilter: ["hidden"] });
})();

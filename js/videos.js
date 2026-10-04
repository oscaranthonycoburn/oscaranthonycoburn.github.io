/* Videos tab: the room photo (assets/vhs/room.webp) fills the tab.
   Tap the TV: the camera zooms in until the photo's black TV bezel lands exactly on the border
   (assets/vhs/frame.webp, the same bezel), which fades in over it, so the TV *becomes* the border.
   Inside: a grainy menu of video titles. Pick one: the screen flickers and the video plays; when it
   ends it goes back to the menu. The green readout above the frame plays/pauses; the arrow goes
   back (video -> menu -> room).
   The list is content/videos.json (edited in Pages CMS, "Videos (TV)"): title + YouTube link. */
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
  const BG = window.OCBg || { duck() {}, unduck() {} };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let videos = [];

  // The photo's black TV bezel, measured in pixels of the 1733x907 photo. The .vhs-frame box is
  // this bezel's shape, and the border image fills it.
  const BEZEL = { l: 530 / 1733, t: 216 / 907, w: 565 / 1733, h: 408 / 907 };

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
        const next = ((d && d.videos) || [])
          .map(v => ({ title: String(v.title || "").trim(), id: ytId(v.video), zoom: +v.zoom || 1 }))
          .filter(v => v.title && v.id);
        if (current === null && JSON.stringify(next) !== JSON.stringify(videos)) { videos = next; render(); }
      })
      .catch(() => {});
  }
  render();
  loadList();

  /* ---------- State ---------- */
  let on = false, busy = false, current = null, playing = false;
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
    else now.textContent = `${playing ? "Playing" : "Paused"}: ${videos[current].title}`;
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
  function ensurePlayer(id) {
    if (ytReady) return ytReady;
    return (ytReady = OCYT.load().then(() => new Promise(resolve => {
      yt = OCYT.create("tvPlayer", id, {
        onReady: () => resolve(),
        onStateChange: e => {
          if (current === null) return;
          if (e.data === OCYT.PLAYING) { playing = true; BG.duck(); setPP(); status(); }
          else if (e.data === OCYT.PAUSED) { playing = false; BG.unduck(); setPP(); status(); }
          else if (e.data === OCYT.ENDED) { playing = false; setTimeout(() => { if (current !== null) toMenu(); }, 600); }
        }
      });
    })));
  }
  function stopVideo() {
    try { yt && yt.stopVideo && yt.stopVideo(); } catch (_) {}
    if (playing) BG.unduck();
    playing = false; current = null;
  }
  function doFlicker() {
    flicker.classList.remove("is-on"); void flicker.offsetWidth; flicker.classList.add("is-on");
    hiss(.7);
  }

  function playTape(i) {
    const v = videos[i];
    if (!v || busy) return;
    busy = true;
    if (window.OCDeck && window.OCDeck.playing) window.OCDeck.toggle();   // stop a song on the record
    BG.duck();
    current = i; playing = true; setPP(); status();
    doFlicker();
    setTimeout(() => {
      menu.hidden = true; pp.hidden = false;
      screen.style.setProperty("--zoom", v.zoom || 1);
      const go = () => yt.loadVideoById(v.id);
      yt && yt.loadVideoById ? go() : ensurePlayer(v.id).then(go);
      busy = false;
    }, reduced ? 0 : 380);
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
    const scale = fr.width / (rw * BEZEL.w);           // same shape, so the height matches too
    const fl = fr.left - st.left, ft = fr.top - st.top;
    return { scale, fl, ft, rw, rh,
      x: fl - room.offsetLeft - rw * BEZEL.l * scale,
      y: ft - room.offsetTop - rh * BEZEL.t * scale };
  }
  // Keeps the border glued to the photo's bezel wherever the room is mid-zoom, so the border can
  // fade in (or out) on top of it at any moment without anything shifting.
  function track(z) {
    const s = gsap.getProperty(room, "scale"), x = gsap.getProperty(room, "x"), y = gsap.getProperty(room, "y");
    gsap.set(frame, {
      transformOrigin: "0 0", scale: s / z.scale,
      x: room.offsetLeft + x + z.rw * BEZEL.l * s - z.fl,
      y: room.offsetTop + y + z.rh * BEZEL.t * s - z.ft
    });
  }
  function turnOn() {
    if (on || busy) return;
    on = busy = true; audio(); thunk();
    loadList();
    glass.classList.add("is-loud"); setLed("ON");
    player.hidden = false; menu.hidden = false; pp.hidden = true; moreHint();
    const done = () => {
      busy = false; setLed("12:00"); status();
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

  onBtn.addEventListener("click", turnOn);
  list.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) playTape(+b.dataset.i); });
  list.addEventListener("keydown", e => {            // arrow keys move through the menu like a VCR remote
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...list.querySelectorAll(".vhs-item")], at = items.indexOf(document.activeElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    e.preventDefault();
  });
  pp.addEventListener("click", () => {
    if (!yt || !yt.getPlayerState) return;
    if (playing) yt.pauseVideo();
    else { BG.duck(); yt.playVideo(); }
  });
  back.addEventListener("click", goBack);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && on && !view.hidden) goBack(); });

  // Leaving the Videos tab pauses the video.
  new MutationObserver(() => { if (view.hidden && playing && yt) yt.pauseVideo(); })
    .observe(view, { attributes: true, attributeFilter: ["hidden"] });
})();

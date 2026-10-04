/* Videos tab: the room photo (assets/vhs/room.webp) with live pieces laid over it.
   Click a tape: it lifts out of its stack, flies to the VCR and slides into the slot; the VCR
   reads LOAD -> PLAY, the view zooms into the TV, and the video plays inside the bezel frame
   (assets/vhs/frame.webp). Tap the video to pause; ⏏ zooms back out and returns the tape.
   Tapes = `videos` in js/data.js (VOL. 1–4, in the photo's order). */
(function () {
  const S = window.SITE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const stage = $("#vhsStage");
  if (!stage || !window.OCYT) return;

  const room = $("#vhsRoom"), slot = $("#vcrSlot"), led = $("#vcrLed"), osd = $("#tvOsd");
  const glass = $(".vhs-glass"), ejectHit = $("#vcrEject"), fade = $(".vhs-fade");
  const player = $("#vhsPlayer"), playerOsd = $("#vhsOsd"), hit = $("#tvHit"), back = $("#vhsBack");
  const shelf = $("#vhsShelf"), now = $("#vhsNow"), view = $("#videos");
  const patches = { left: $(".vhs-patch.left"), right: $(".vhs-patch.right") };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!window.gsap && !reduced;
  const BG = window.OCBg || { duck() {}, unduck() {} };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const videos = (S.videos || []).slice(0, 4);

  // The photo's stacks: [top, bottom] on each side. Taking a bottom tape drops the top one down.
  const STACKS = { left: [0, 1], right: [2, 3] };
  const sideOf = i => (i < 2 ? "left" : "right");

  /* ---------- Build the tapes and the shelf buttons ---------- */
  $("#vhsTapes").innerHTML = [0, 1, 2, 3].map(i => {
    const v = videos[i];
    return `<button class="vhs-tape" data-tape="${i}" ${v ? "" : "disabled"} aria-label="${v ? `Play ${esc(v.label)}: ${esc(v.title)}` : "Empty tape"}"></button>`;
  }).join("");
  const tapes = [...stage.querySelectorAll(".vhs-tape")];
  shelf.innerHTML = videos.map((v, i) =>
    `<button class="vhs-chip" data-chip="${i}" style="--stripe:${esc(v.color || "#d42a2a")}"><i aria-hidden="true"></i>${esc(v.label)} · ${esc(v.title)}</button>`).join("");

  /* ---------- State ---------- */
  let current = null, busy = false, playing = false;
  let yt = null, ytReady = null, flight = null, dropTween = null;

  function setLed(t, blink) { led.textContent = t; led.classList.toggle("blink", !!blink); }
  function setOsd(t, blink) { osd.textContent = t; osd.classList.toggle("blink", !!blink); }
  function flash(t, ms = 1600) { clearTimeout(flash.t); playerOsd.textContent = t; if (ms) flash.t = setTimeout(() => { playerOsd.textContent = ""; }, ms); }
  function status() {
    shelf.querySelectorAll(".vhs-chip").forEach(c => c.classList.toggle("is-current", +c.dataset.chip === current));
    if (current === null) { now.textContent = "No tape in the VCR."; return; }
    const v = videos[current];
    now.innerHTML = `${playing ? "Now playing" : player.hidden ? "Loading" : "Paused"}: <strong>${esc(v.label)} · ${esc(v.title)}</strong>`;
  }
  setLed("12:00", true); setOsd("INSERT TAPE", true);

  /* ---------- Static on the TV glass ---------- */
  const cv = $("#tvStatic"), cx = cv.getContext("2d"), img = cx.createImageData(cv.width, cv.height);
  (function noise() {
    if (!view.hidden && player.hidden) {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      cx.putImageData(img, 0, 0);
    }
    requestAnimationFrame(noise);
  })();

  /* ---------- Sound effects (synthesized) ---------- */
  let ac = null;
  function audio() {
    if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); }
    if (ac && ac.state !== "running") ac.resume().catch(() => {});
    return ac;
  }
  function noiseBuf(ctx, secs) {
    const b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function clunk() {
    const ctx = audio(); if (!ctx) return; const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx, .15);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 500;
    const g = ctx.createGain(); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .14);
    n.connect(f); f.connect(g); g.connect(ctx.destination); n.start(t);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(50, t + .12);
    const og = ctx.createGain(); og.gain.setValueAtTime(.4, t); og.gain.exponentialRampToValueAtTime(.001, t + .15);
    o.connect(og); og.connect(ctx.destination); o.start(t); o.stop(t + .16);
  }
  function whirr(secs = .8) {
    const ctx = audio(); if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(45, t); o.frequency.linearRampToValueAtTime(70, t + secs);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 300;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .1); g.gain.linearRampToValueAtTime(0, t + secs);
    o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + secs);
  }
  function hiss(secs = .7) {
    const ctx = audio(); if (!ctx) return; const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(ctx, secs);
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.setValueAtTime(.15, t); g.gain.linearRampToValueAtTime(0, t + secs);
    n.connect(f); f.connect(g); g.connect(ctx.destination); n.start(t);
  }

  /* ---------- Video ---------- */
  function ensurePlayer(id) {
    if (ytReady) return ytReady;
    return (ytReady = OCYT.load().then(() => new Promise(resolve => {
      yt = OCYT.create("tvPlayer", id, {
        onReady: () => resolve(),
        onStateChange: e => {
          if (e.data === OCYT.PLAYING) { playing = true; BG.duck(); setLed("PLAY"); status(); }
          else if (e.data === OCYT.PAUSED) { playing = false; BG.unduck(); setLed("PAUSE", true); flash("PAUSE ❚❚", 0); status(); }
          else if (e.data === OCYT.ENDED) { playing = false; flash("THE END", 0); setTimeout(() => ejectTape(), 1400); }
        }
      });
    })));
  }

  /* ---------- Room -> TV zoom ---------- */
  function zoomIn(i) {
    const v = videos[i];
    const show = () => {
      player.hidden = false;
      player.classList.remove("is-in"); void player.offsetWidth; player.classList.add("is-in");
      flash("PLAY ▶  " + v.label, 2600);
      const go = () => yt.loadVideoById(v.id);
      yt && yt.loadVideoById ? go() : ensurePlayer(v.id).then(go);
    };
    if (!hasGsap) { show(); return Promise.resolve(); }
    return new Promise(res => {
      gsap.timeline({ onComplete: () => {
        show();
        gsap.fromTo(".vhs-frame", { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: .55, ease: "expo.out" });
        res();
      } })
        .to(room, { scale: 3.6, duration: 1.05, ease: "power3.in" })
        .to(fade, { opacity: 1, duration: .35, ease: "power1.in" }, "-=.35");
    });
  }
  function zoomOut() {
    player.hidden = true;
    if (!hasGsap) return Promise.resolve();
    return new Promise(res => {
      gsap.timeline({ onComplete: res })
        .to(fade, { opacity: 0, duration: .3 })
        .to(room, { scale: 1, duration: .8, ease: "power3.out" }, "<");
    });
  }

  /* ---------- Tape flights ---------- */
  function rect(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
  function insertTape(i) {
    busy = true; audio();
    const tape = tapes[i], side = sideOf(i), [top, bottom] = STACKS[side];
    patches[side].classList.add("is-on");                       // wall shows where the top tape was
    if (i === bottom && hasGsap) {                                // the top tape drops into the gap
      dropTween = gsap.to(tapes[top], { y: tapes[bottom].offsetHeight, duration: .45, delay: .35, ease: "bounce.out" });
    }
    const after = () => {
      tape.style.visibility = "hidden";
      slot.classList.add("is-loaded"); ejectHit.disabled = false;
      current = i; status();
      setLed("LOAD", true); setOsd(""); glass.classList.add("is-loud"); hiss(.8);
      if (window.OCDeck && window.OCDeck.playing) window.OCDeck.toggle();   // stop a song on the record
      BG.duck();
      setTimeout(() => {
        setLed("PLAY");
        setTimeout(() => zoomIn(i).then(() => { busy = false; }), 550);
      }, 750);
    };
    if (!hasGsap) { clunk(); after(); return; }
    const tr = rect(tape), sr = rect(slot), s = (sr.w * .98) / tr.w;
    gsap.set(tape, { zIndex: 20, transformPerspective: 600, transformOrigin: "50% 50%" });
    flight = gsap.timeline({ onComplete: after })
      .to(tape, { y: -tr.h * .7, rotation: i < 2 ? 6 : -6, scale: 1.06, duration: .35, ease: "power2.out", onStart: () => whirr(.5) })
      .to(tape, { x: sr.x - tr.x, y: sr.y - tr.y - tr.h * s * .55, rotation: 0, scale: s, duration: .7, ease: "power3.inOut" })
      .to(tape, { rotationX: 72, y: sr.y - tr.y - tr.h * s * .1, duration: .26, ease: "power2.in" })
      .to(tape, { y: sr.y - tr.y + sr.h * .25, opacity: 0, duration: .2, ease: "power1.in", onComplete: clunk });
  }

  async function ejectTape(then) {
    if (current === null || busy) return;
    busy = true;
    const i = current, tape = tapes[i], side = sideOf(i), [top, bottom] = STACKS[side];
    try { yt && yt.stopVideo && yt.stopVideo(); } catch (_) {}
    playing = false; BG.unduck(); flash("", 0);
    await zoomOut();
    glass.classList.remove("is-loud"); setLed("EJECT"); whirr(.6);
    slot.classList.remove("is-loaded"); ejectHit.disabled = true;
    const done = () => {
      if (window.gsap) gsap.set(tape, { clearProps: "transform,opacity,zIndex" });
      const drop = dropTween; dropTween = null;
      if (drop) drop.eventCallback("onReverseComplete", () => gsap.set(tapes[top], { clearProps: "transform" })).reverse();
      setTimeout(() => patches[side].classList.remove("is-on"), drop ? 500 : 0);
      current = null; busy = false; setLed("12:00", true); setOsd("INSERT TAPE", true); status();
      then && then();
    };
    tape.style.visibility = "";
    if (flight && hasGsap) {
      flight.eventCallback("onComplete", null);
      flight.eventCallback("onReverseComplete", done);
      flight.timeScale(1.3).reverse();
      flight = null;
    } else done();
  }

  function pick(i) {
    if (busy || !videos[i]) return;
    if (current === i) { if (player.hidden) zoomIn(i); return; }
    if (current !== null) ejectTape(() => insertTape(i));
    else insertTape(i);
  }
  tapes.forEach((t, i) => t.addEventListener("click", () => pick(i)));
  shelf.addEventListener("click", e => { const c = e.target.closest("[data-chip]"); if (c) pick(+c.dataset.chip); });
  ejectHit.addEventListener("click", () => ejectTape());
  back.addEventListener("click", () => ejectTape());
  hit.addEventListener("click", () => {
    if (!yt || !yt.getPlayerState) return;
    if (playing) yt.pauseVideo();
    else { BG.duck(); flash("PLAY ▶"); yt.playVideo(); }
  });

  // Leaving the Videos tab pauses the tape (it stays in, zoomed in).
  new MutationObserver(() => { if (view.hidden && playing && yt) yt.pauseVideo(); })
    .observe(view, { attributes: true, attributeFilter: ["hidden"] });
  // A resize while a tape is in: drop the old flight path; eject just puts the tape back.
  addEventListener("resize", () => { if (flight && current !== null) { flight.kill(); flight = null; } });
  status();
})();

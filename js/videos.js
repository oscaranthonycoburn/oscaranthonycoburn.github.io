/* Videos tab: the room photo (assets/vhs/room.webp), edge to edge at the top.
   Tap the photo or the TV: the view zooms into the TV and the bezel frame (assets/vhs/frame.webp)
   shows a grainy tape menu (VOL. 1–4). Pick one: the screen flickers and the video plays.
   Tap the video to pause; "Menu" goes back to the list; "Back to the room" zooms out.
   Tapes = `videos` in js/data.js. */
(function () {
  const S = window.SITE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const stage = $("#vhsStage");
  if (!stage || !window.OCYT) return;

  const room = $("#vhsRoom"), glass = $(".vhs-glass"), fade = $(".vhs-fade"), led = $("#vcrLed"), osd = $("#tvOsd");
  const onBtn = $("#vhsOn"), player = $("#vhsPlayer"), frame = $(".vhs-frame");
  const menu = $("#vhsMenu"), list = $("#vhsList"), flicker = $("#vhsFlicker"), playerOsd = $("#vhsOsd");
  const hit = $("#tvHit"), menuBtn = $("#vhsMenuBtn"), offBtn = $("#vhsOff"), now = $("#vhsNow"), view = $("#videos");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!window.gsap && !reduced;
  const BG = window.OCBg || { duck() {}, unduck() {} };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const videos = S.videos || [];

  list.innerHTML = videos.map((v, i) =>
    `<li><button class="vhs-item" data-i="${i}" aria-label="${esc(v.label)}: ${esc(v.title)}"><i aria-hidden="true"></i>${esc(v.label)}</button></li>`).join("");

  /* ---------- State ---------- */
  let on = false, busy = false, current = null, playing = false;
  let yt = null, ytReady = null;

  function setLed(t, blink) { led.textContent = t; led.classList.toggle("blink", !!blink); }
  function flash(t, ms = 1600) { clearTimeout(flash.t); playerOsd.textContent = t; if (ms) flash.t = setTimeout(() => { playerOsd.textContent = ""; }, ms); }
  function status() {
    if (!on) { now.textContent = "The TV is off."; return; }
    if (current === null) { now.textContent = "Pick a tape."; return; }
    const v = videos[current];
    now.innerHTML = `${playing ? "Now playing" : "Paused"}: <strong>${esc(v.label)} · ${esc(v.title)}</strong>`;
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
  let frameNo = 0;
  (function loop() {
    if (!view.hidden && frameNo++ % 2 === 0) {          // ~30fps is plenty for static
      if (player.hidden) paintTv(255);
      else if (!menu.hidden) paintMenu(150);
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
  function hiss(secs = .6, level = .12) {
    const ctx = audio(); if (!ctx) return; const t = ctx.currentTime;
    const b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.setValueAtTime(level, t); g.gain.linearRampToValueAtTime(0, t + secs);
    n.connect(f); f.connect(g); g.connect(ctx.destination); n.start(t);
  }
  function thunk() {   // the power switch / CRT turning on
    const ctx = audio(); if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .14);
    const g = ctx.createGain(); g.gain.setValueAtTime(.35, t); g.gain.exponentialRampToValueAtTime(.001, t + .16);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .17);
    const w = ctx.createOscillator(); w.frequency.value = 15700;      // the CRT whine, very quiet
    const wg = ctx.createGain(); wg.gain.setValueAtTime(.012, t); wg.gain.linearRampToValueAtTime(0, t + .9);
    w.connect(wg); wg.connect(ctx.destination); w.start(t); w.stop(t + .9);
  }

  /* ---------- Video ---------- */
  function ensurePlayer(id) {
    if (ytReady) return ytReady;
    return (ytReady = OCYT.load().then(() => new Promise(resolve => {
      yt = OCYT.create("tvPlayer", id, {
        onReady: () => resolve(),
        onStateChange: e => {
          if (current === null) return;
          if (e.data === OCYT.PLAYING) { playing = true; BG.duck(); setLed("PLAY"); flash("", 0); status(); }
          else if (e.data === OCYT.PAUSED) { playing = false; BG.unduck(); setLed("PAUSE", true); flash("PAUSE ❚❚", 0); status(); }
          else if (e.data === OCYT.ENDED) { playing = false; flash("THE END", 0); setTimeout(() => { if (current !== null) toMenu(); }, 1500); }
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
    hiss(.7, .1);
  }

  function playTape(i) {
    const v = videos[i];
    if (!v || busy) return;
    busy = true;
    if (window.OCDeck && window.OCDeck.playing) window.OCDeck.toggle();   // stop a song on the record
    BG.duck();
    current = i; status();
    doFlicker();
    setTimeout(() => {
      menu.hidden = true; hit.hidden = false; menuBtn.hidden = false;
      setLed("LOAD", true); flash("▶ " + v.label, 2400);
      const go = () => yt.loadVideoById(v.id);
      yt && yt.loadVideoById ? go() : ensurePlayer(v.id).then(go);
      busy = false;
      hit.focus({ preventScroll: true });
    }, reduced ? 0 : 380);
  }
  function toMenu() {
    stopVideo(); status();
    doFlicker();
    setTimeout(() => {
      menu.hidden = false; hit.hidden = true; menuBtn.hidden = true;
      flash("", 0); setLed("MENU");
      const first = list.querySelector(".vhs-item"); first && first.focus({ preventScroll: true });
    }, reduced ? 0 : 380);
  }

  /* ---------- Room <-> TV zoom ---------- */
  function turnOn() {
    if (on || busy) return;
    on = busy = true; audio(); thunk();
    glass.classList.add("is-loud"); osd.textContent = ""; setLed("ON");
    const show = () => {
      player.hidden = false; menu.hidden = false; hit.hidden = true; menuBtn.hidden = true;
      player.classList.remove("is-in"); void player.offsetWidth; player.classList.add("is-in");
      setLed("MENU"); status(); busy = false;
      const first = list.querySelector(".vhs-item"); first && first.focus({ preventScroll: true });
      ensurePlayer(videos[0] && videos[0].id);       // warm up YouTube while they choose
    };
    if (!hasGsap) { show(); return; }
    const g = glass.getBoundingClientRect(), st = stage.getBoundingClientRect();
    const scale = Math.min(st.width * .8 / g.width, st.height * .7 / g.height);
    gsap.timeline({ onComplete: () => {
      show();
      gsap.fromTo(frame, { scale: 1.1, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: "expo.out" });
    } })
      .to(room, { scale, duration: 1, ease: "power3.in" })
      .to(fade, { opacity: 1, duration: .3, ease: "power1.in" }, "-=.3");
  }
  function turnOff() {
    if (!on || busy) return;
    busy = true;
    stopVideo();
    player.hidden = true; flash("", 0);
    const done = () => {
      on = busy = false;
      glass.classList.remove("is-loud"); osd.textContent = "TAP TO WATCH"; setLed("12:00", true); status();
      onBtn.focus({ preventScroll: true });
    };
    if (!hasGsap) { done(); return; }
    gsap.timeline({ onComplete: done })
      .to(fade, { opacity: 0, duration: .3 })
      .to(room, { scale: 1, duration: .8, ease: "power3.out" }, "<");
  }

  onBtn.addEventListener("click", turnOn);
  list.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) playTape(+b.dataset.i); });
  list.addEventListener("keydown", e => {            // arrow keys move through the menu like a VCR remote
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...list.querySelectorAll(".vhs-item")], at = items.indexOf(document.activeElement);
    items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    e.preventDefault();
  });
  hit.addEventListener("click", () => {
    if (!yt || !yt.getPlayerState) return;
    if (playing) yt.pauseVideo();
    else { BG.duck(); flash("▶ PLAY"); yt.playVideo(); }
  });
  menuBtn.addEventListener("click", toMenu);
  offBtn.addEventListener("click", turnOff);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && on && !view.hidden) turnOff(); });

  // Leaving the Videos tab pauses the tape.
  new MutationObserver(() => { if (view.hidden && playing && yt) yt.pauseVideo(); })
    .observe(view, { attributes: true, attributeFilter: ["hidden"] });
  status();
})();

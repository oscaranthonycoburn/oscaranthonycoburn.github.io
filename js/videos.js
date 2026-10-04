/* Videos tab: a retro room. Click a VHS tape and it lifts off the desk, flies to the VCR,
   tilts and slides into the slot; the TV crackles with static, powers on like an old CRT and
   plays the video. Tap the TV to pause; ⏏ ejects the tape back to the desk.
   Tapes come from `videos` in js/data.js. Background music pauses while a tape plays. */
(function () {
  const S = window.SITE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const scene = $("#vhsScene");
  if (!scene || !window.OCYT) return;

  const tapesEl = $("#vhsTapes"), screen = $("#tvScreen"), tv = $("#tv"), vcr = $("#vcr");
  const slot = $("#vcrSlot"), led = $("#vcrLed"), osd = $("#tvOsd"), eject = $("#vcrEject");
  const hit = $("#tvHit"), now = $("#vhsNow"), view = $("#videos");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BG = window.OCBg || { duck() {}, unduck() {} };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const videos = S.videos || [];

  /* ---------- Tapes ---------- */
  tapesEl.innerHTML = videos.map((v, i) => `
    <button class="vhs" data-tape="${i}" style="--stripe:${esc(v.color || "#d42a2a")}" aria-label="Play ${esc(v.label)}: ${esc(v.title)}">
      <span class="vhs-label"><span class="vhs-vol">${esc(v.label)}</span><span class="vhs-title">${esc(v.title)}</span></span>
      <span class="vhs-window" aria-hidden="true"><i></i><i></i></span>
    </button>`).join("");
  // Tapes live inside the scene so they can fly anywhere in it.
  [...tapesEl.children].forEach(t => scene.append(t));
  tapesEl.remove();
  const tapes = [...scene.querySelectorAll(".vhs")];

  /* ---------- State ---------- */
  let current = null;      // index of the tape in the VCR
  let busy = false;        // an animation is running
  let playing = false;
  let yt = null, ytReady = null;
  const inserts = new Map();   // tape index -> its insert timeline (reversed to eject)

  function setOsd(text, { blink = false, hideAfter = 0 } = {}) {
    clearTimeout(setOsd.t);
    osd.textContent = text;
    osd.classList.toggle("blink", blink);
    osd.hidden = !text;
    if (hideAfter) setOsd.t = setTimeout(() => { osd.hidden = true; }, hideAfter);
  }
  function setLed(text, blink) { led.textContent = text; led.classList.toggle("blink", !!blink); }
  function status() {
    if (current === null) { now.textContent = "No tape in the VCR."; return; }
    const v = videos[current];
    now.innerHTML = `${playing ? "Now playing" : "Paused"}: <strong>${esc(v.label)} · ${esc(v.title)}</strong>`;
  }
  setOsd("INSERT TAPE", { blink: true });
  setLed("12:00", true);

  /* ---------- TV static ---------- */
  const cv = $("#tvStatic"), cx = cv.getContext("2d");
  const img = cx.createImageData(cv.width, cv.height);
  let staticLoud = false;
  (function noise() {
    if (!view.hidden && !screen.classList.contains("is-on")) {
      const d = img.data, k = staticLoud ? 255 : 150;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * k; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
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
  function noiseBuffer(ctx, secs) {
    const b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function clunk() {
    const ctx = audio(); if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, .15);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 500;
    const g = ctx.createGain(); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.001, t + .14);
    n.connect(f); f.connect(g); g.connect(ctx.destination); n.start(t);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(50, t + .12);
    const og = ctx.createGain(); og.gain.setValueAtTime(.4, t); og.gain.exponentialRampToValueAtTime(.001, t + .15);
    o.connect(og); og.connect(ctx.destination); o.start(t); o.stop(t + .16);
  }
  function whirr(secs = .8) {
    const ctx = audio(); if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(45, t); o.frequency.linearRampToValueAtTime(70, t + secs);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 300;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .1); g.gain.linearRampToValueAtTime(0, t + secs);
    o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + secs);
  }
  function hiss(secs = .6) {
    const ctx = audio(); if (!ctx) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, secs);
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.setValueAtTime(.16, t); g.gain.linearRampToValueAtTime(0, t + secs);
    n.connect(f); f.connect(g); g.connect(ctx.destination); n.start(t);
  }

  /* ---------- Video ---------- */
  function ensurePlayer(id) {
    if (ytReady) return ytReady;
    return (ytReady = OCYT.load().then(() => new Promise(resolve => {
      yt = OCYT.create("tvPlayer", id, {
        onReady: () => resolve(),
        onStateChange: e => {
          if (e.data === OCYT.PLAYING) {
            playing = true; BG.duck();
            screen.classList.add("is-on"); screen.classList.remove("is-off");
            scene.style.setProperty("--tv-glow", 1); tv.classList.add("is-on");
            setLed("PLAY"); status();
            const tape = tapes[current]; tape && tape.classList.add("is-playing");
          } else if (e.data === OCYT.PAUSED) {
            playing = false; BG.unduck(); setLed("PAUSE", true); setOsd("PAUSE ❚❚"); status();
          } else if (e.data === OCYT.ENDED) {
            playing = false; setOsd("THE END"); setTimeout(() => ejectTape(), 1200);
          }
        }
      });
    })));
  }
  function startVideo(i) {
    const v = videos[i];
    if (window.OCDeck && window.OCDeck.playing) window.OCDeck.toggle();   // stop a song on the record
    BG.duck();
    staticLoud = true; hiss(.6);
    setOsd("PLAY ▶  " + v.label, { hideAfter: 3000 });
    setLed("LOAD", true);
    const go = () => { yt.loadVideoById(v.id); };
    yt && yt.loadVideoById ? setTimeout(go, 500) : ensurePlayer(v.id).then(() => setTimeout(go, 300));
  }

  /* ---------- Insert / eject animations ---------- */
  function rel(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top }; }

  function insertTape(i) {
    busy = true;
    const tape = tapes[i];
    audio();                                   // unlock sound effects inside the click
    eject.disabled = true;
    const done = () => {
      tape.classList.add("is-in");
      vcr.classList.add("is-loaded");
      current = i; busy = false; eject.disabled = false;
      startVideo(i);
    };
    if (reduced || !window.gsap) { clunk(); done(); return; }

    const tr = rel(tape), sr = rel(slot);
    const s = (sr.w * .96) / tr.w;
    const tl = gsap.timeline({ onComplete: done, onReverseComplete: () => gsap.set(tape, { clearProps: "transform,opacity,zIndex,clipPath" }) });
    gsap.set(tape, { zIndex: 40, transformPerspective: 600, transformOrigin: "50% 50%" });
    tl.to(tape, { y: "-=" + tr.h * .45, rotation: -8, scale: 1.08, duration: .35, ease: "power2.out", onStart: () => whirr(.5) })
      // fly over the VCR, hovering just above the slot, sized to fit it
      .to(tape, { x: "+=" + (sr.x - tr.x), y: "+=" + (sr.y - tr.y - tr.h * s * .55 + tr.h * .45), rotation: 0, scale: s, duration: .7, ease: "power3.inOut" })
      .add(() => vcr.classList.add("is-open"))
      // tip it back and push it into the slot
      .to(tape, { rotationX: 75, y: "+=" + tr.h * s * .42, duration: .28, ease: "power2.in" })
      .to(tape, { y: "+=" + sr.h * .5, opacity: 0, duration: .22, ease: "power1.in", onComplete: () => { clunk(); vcr.classList.remove("is-open"); } });
    inserts.set(i, tl);
  }

  function ejectTape(then) {
    if (current === null || busy) return;
    busy = true;
    const i = current, tape = tapes[i];
    try { yt && yt.stopVideo && yt.stopVideo(); } catch (_) {}
    playing = false; BG.unduck();
    screen.classList.remove("is-on"); screen.classList.add("is-off");
    scene.style.setProperty("--tv-glow", 0); tv.classList.remove("is-on");
    tape.classList.remove("is-playing", "is-in");
    vcr.classList.remove("is-loaded");
    setLed("EJECT"); staticLoud = false; whirr(.6);
    const finish = () => {
      current = null; busy = false; eject.disabled = true;
      screen.classList.remove("is-off");
      setLed("12:00", true); setOsd("INSERT TAPE", { blink: true }); status();
      then && then();
    };
    const tl = inserts.get(i);
    if (tl && !reduced && window.gsap) {
      vcr.classList.add("is-open");
      setTimeout(() => vcr.classList.remove("is-open"), 400);
      tl.eventCallback("onReverseComplete", () => { gsap.set(tape, { clearProps: "transform,opacity,zIndex" }); finish(); });
      tl.timeScale(1.3).reverse();
    } else finish();
    inserts.delete(i);
  }

  tapes.forEach((tape, i) => tape.addEventListener("click", () => {
    if (busy) return;
    if (current === i) { togglePlay(); return; }
    if (current !== null) ejectTape(() => insertTape(i));
    else insertTape(i);
  }));
  eject.addEventListener("click", () => ejectTape());

  function togglePlay() {
    if (current === null || !yt || !yt.getPlayerState) return;
    if (playing) yt.pauseVideo();
    else { BG.duck(); if (window.OCDeck && window.OCDeck.playing) window.OCDeck.toggle(); setOsd("PLAY ▶", { hideAfter: 1500 }); yt.playVideo(); }
  }
  hit.addEventListener("click", () => {
    if (current === null) { setOsd("PICK A TAPE ▶", { hideAfter: 1800 }); tapes[0] && tapes[0].focus(); return; }
    togglePlay();
  });

  // Leaving the Videos tab pauses the tape (it stays in the VCR).
  new MutationObserver(() => { if (view.hidden && playing && yt) yt.pauseVideo(); })
    .observe(view, { attributes: true, attributeFilter: ["hidden"] });
  // Window resized while a tape is in: forget the old flight path, eject just puts it back.
  addEventListener("resize", () => {
    inserts.forEach((tl, i) => { if (i !== current) return; tl.kill(); inserts.delete(i); gsap.set(tapes[i], { clearProps: "transform,opacity,zIndex" }); });
  });
})();

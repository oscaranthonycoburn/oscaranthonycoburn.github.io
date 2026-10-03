/* Record deck: an album sleeve with the vinyl halfway out, driving the song videos.
   - Turning the record (~72° per song) switches the video and plays it right away.
   - Tapping the record, the video, or Play pauses/resumes. When a video ends, the
     record turns to the next song.
   - While a song plays, the background music (js/bg.js) fades out; when the song is
     paused it fades back in. */
(function () {
  const S = window.SITE;
  const BG = window.OCBg || { duck() {}, unduck() {} };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const deck = $("#deck");
  if (!deck || !window.OCYT) return;

  const vinyl = $("#vinyl"), disc = $("#vinylDisc");
  const tracks = S.tracks, N = tracks.length;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = n => String(n).padStart(2, "0");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const wrap = i => ((i % N) + N) % N;
  const fmt = t => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };

  const STEP = 360 / N;      // degrees of spin per song
  const MIN_SPIN = 25;       // anything smaller than this is a tap or a wobble
  const RPM_33 = 200;        // ~33⅓ rpm in degrees per second

  let idx = 0, preview = null, playing = false, started = false;
  let rot = 0, speed = 0, dragging = false;
  let yt = null, ready = null;

  /* ---------- Panel ---------- */
  $("#nowList").innerHTML = tracks.map((t, i) => `
    <li><button data-deck="${i}">
      <span class="n">${pad(i + 1)}</span>
      <span class="t">${esc(t.title)}</span>
      <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="l">${esc(t.length)}</span>
    </button></li>`).join("");

  const seekEl = $("#nowSeek");
  let seeking = false;

  function announce() {
    document.dispatchEvent(new CustomEvent("oc:deck", { detail: { index: idx, playing } }));
  }
  function render() {
    const i = preview ?? idx, t = tracks[i];
    $("#nowTitle").textContent = t.title;
    $("#nowMeta").textContent = `Track ${pad(i + 1)} of ${pad(N)} · ${t.length}`;
    $("#nowState").textContent =
      preview !== null && preview !== idx ? "Let go to play" :
      playing ? "Now playing" : started ? "Paused" : "Spin to play";
    $$("#nowList button").forEach(b => {
      const on = +b.dataset.deck === i;
      b.classList.toggle("is-current", on);
      b.toggleAttribute("aria-current", on);
    });
    deck.classList.toggle("is-playing", playing);
    deck.classList.toggle("has-started", started);
    $(".now-toggle span").textContent = playing ? "Pause" : "Play";
    vinyl.setAttribute("aria-valuenow", i + 1);
    vinyl.setAttribute("aria-valuetext", `${t.title}, track ${i + 1} of ${N}`);
    announce();
  }
  function renderTime() {
    if (!yt || !yt.getDuration) return;
    const d = yt.getDuration() || 0, c = yt.getCurrentTime() || 0;
    $("#nowTime").textContent = fmt(c);
    $("#nowDur").textContent = d ? fmt(d) : tracks[idx].length;
    if (!seeking) seekEl.value = d ? Math.round((c / d) * 1000) : 0;
    seekEl.style.setProperty("--p", (seekEl.value / 10) + "%");
  }
  seekEl.addEventListener("input", () => { seeking = true; seekEl.style.setProperty("--p", (seekEl.value / 10) + "%"); });
  seekEl.addEventListener("change", () => {
    if (yt && yt.getDuration) yt.seekTo((seekEl.value / 1000) * yt.getDuration(), true);
    seeking = false;
  });

  /* ---------- Video ---------- */
  function ensurePlayer() {
    if (ready) return ready;
    return (ready = OCYT.load().then(() => new Promise(resolve => {
      yt = OCYT.create("deckPlayer", tracks[idx].id, {
        onReady: () => resolve(),
        onStateChange: onState
      });
    })));
  }
  ensurePlayer();   // load early so the first spin starts instantly

  function onState(e) {
    if (e.data === OCYT.PLAYING) {
      playing = true; started = true;
      BG.duck();
    } else if (e.data === OCYT.ENDED) {
      playing = false;
      speed = Math.max(speed, 520);
      play(idx + 1);                  // turn to the next song; background stays faded out
      return;
    } else if (e.data === OCYT.PAUSED) {
      playing = false;
      BG.unduck();
    }
    render();
  }

  function play(i) {
    if (i !== undefined) idx = wrap(i);
    preview = null;
    started = true;
    render();
    const go = () => { yt.loadVideoById(tracks[idx].id); };
    yt && yt.loadVideoById ? go() : ensurePlayer().then(go);
  }
  function toggle() {
    if (!yt || !yt.getPlayerState) { play(); return; }
    if (playing) yt.pauseVideo();
    else if (started) yt.playVideo();
    else play();
  }

  // Other parts of the site (tracklist, Listen Now) use this.
  window.OCDeck = {
    play: i => play(i),
    toggle,
    get index() { return idx; },
    get playing() { return playing; }
  };

  // Tapping the video toggles it (the YouTube layer underneath has no controls).
  $(".now-hit").addEventListener("click", toggle);

  /* ---------- Spin physics ---------- */
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!dragging) {
      const target = playing && !reduced ? RPM_33 : 0;
      // flicks coast down to the turntable speed; slow ramps feel like a motor
      const k = Math.abs(speed) > Math.abs(target) ? 1.4 : 2.5;
      speed += (target - speed) * Math.min(1, dt * k);
      rot += speed * dt;
    }
    disc.style.transform = `rotate(${rot}deg)`;
    if (playing) renderTime();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  const stepsFor = deg => Math.abs(deg) < MIN_SPIN ? 0 : Math.sign(deg) * Math.max(1, Math.round(Math.abs(deg) / STEP));
  const angleOf = e => {
    const r = vinyl.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };

  let lastAng = 0, total = 0, downAt = 0, lastT = 0, vel = 0, lastPreview = null, pointerId = null;
  const MAX_SPIN = 1800;     // deg/s cap for a hard flick

  vinyl.addEventListener("pointerdown", e => {
    if (e.button > 0) return;
    e.preventDefault();                 // no text selection / native image drag
    lastAng = angleOf(e); total = 0; vel = 0;
    pointerId = e.pointerId;
    dragging = true;
    try { vinyl.setPointerCapture(e.pointerId); } catch (_) { /* synthetic or already-released pointer */ }
    vinyl.classList.add("is-grabbing");
    downAt = lastT = performance.now();
    speed = 0;
  });

  // Listen on window too, so a drag that leaves the record (or the window) is never lost.
  window.addEventListener("pointermove", e => {
    if (!dragging || e.pointerId !== pointerId) return;
    if (e.pointerType === "mouse" && e.buttons === 0) { release(); return; }

    const a = angleOf(e);
    let d = a - lastAng;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    lastAng = a;
    rot += d; total += d;
    const now = performance.now();
    vel = vel * 0.5 + (d / Math.max(8, now - lastT) * 1000) * 0.5;
    lastT = now;

    // Dragged off the edge of the record: let go and let it coast at the flick speed.
    const r = vinyl.getBoundingClientRect();
    const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    if (dist > r.width / 2) { release(); return; }

    const steps = stepsFor(total);
    preview = steps ? wrap(idx + steps) : null;
    if (preview !== lastPreview) {
      lastPreview = preview;
      render();
      if (preview !== null && navigator.vibrate) navigator.vibrate(8);
    }
  });

  function release() {
    if (!dragging) return;
    dragging = false;
    try { if (pointerId !== null && vinyl.hasPointerCapture(pointerId)) vinyl.releasePointerCapture(pointerId); } catch (_) {}
    pointerId = null;
    vinyl.classList.remove("is-grabbing");
    if (performance.now() - lastT > 90) vel = 0;              // stopped before letting go: no flick
    speed = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, vel));      // coast at the drag speed
    const steps = stepsFor(total);
    lastPreview = null;
    preview = null;
    if (steps) play(idx + steps);
    else {
      render();
      if (Math.abs(total) < 6 && performance.now() - downAt < 400) toggle();
    }
  }
  const releaseIfMine = e => { if (e.pointerId === pointerId) release(); };
  window.addEventListener("pointerup", releaseIfMine);
  window.addEventListener("pointercancel", releaseIfMine);
  vinyl.addEventListener("lostpointercapture", releaseIfMine);
  window.addEventListener("blur", release);

  function nudge(dir) {
    speed += dir * 520;                 // a visible kick in the right direction
    play(idx + dir);
  }
  vinyl.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); nudge(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); nudge(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
  });

  $("[data-deck-prev]").addEventListener("click", () => nudge(-1));
  $("[data-deck-next]").addEventListener("click", () => nudge(1));
  $("[data-deck-toggle]").addEventListener("click", toggle);
  $("#nowList").addEventListener("click", e => {
    const b = e.target.closest("[data-deck]");
    if (!b) return;
    const i = +b.dataset.deck;
    if (i === idx && playing) return toggle();
    speed += Math.sign(i - idx || 1) * 520;
    play(i);
  });

  /* ---------- Entrance: record slides out of the sleeve ---------- */
  if (window.gsap && window.ScrollTrigger && !reduced) {
    gsap.from(vinyl, {
      xPercent: -48, duration: 1.6, ease: "expo.out",
      scrollTrigger: { trigger: deck, start: "top 75%" },
      onStart: () => { speed = Math.max(speed, 700); }
    });
  }

  render();
})();

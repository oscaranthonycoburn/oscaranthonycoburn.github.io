/* Record deck: an album sleeve with the vinyl halfway out. It's the controller for the
   site's background music (js/audio.js): the record spins while music plays, dragging
   it changes the song (~72° per song), and tapping it plays/pauses. */
(function () {
  const S = window.SITE;
  const A = window.OCAudio;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const deck = $("#deck");
  if (!deck || !A) return;

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

  let preview = null;
  let rot = 0, speed = 0, dragging = false;

  /* ---------- Now-playing panel ---------- */
  $("#nowList").innerHTML = tracks.map((t, i) => `
    <li><button data-deck="${i}">
      <span class="n">${pad(i + 1)}</span>
      <span class="t">${esc(t.title)}</span>
      <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="l">${esc(t.length)}</span>
    </button></li>`).join("");

  const seekEl = $("#nowSeek"), volEl = $("#nowVol");
  let seeking = false;

  function render() {
    const i = preview ?? A.index, t = tracks[i];
    $("#nowTitle").textContent = t.title;
    $("#nowMeta").textContent = `Track ${pad(i + 1)} of ${pad(N)} · ${t.length}`;
    $("#nowState").textContent =
      preview !== null && preview !== A.index ? "Let go to play" :
      A.playing ? "Now playing" : A.started ? "Paused" : "Up next";
    $$("#nowList button").forEach(b => {
      const on = +b.dataset.deck === i;
      b.classList.toggle("is-current", on);
      b.toggleAttribute("aria-current", on);
    });
    deck.classList.toggle("is-playing", A.playing);
    $(".now-toggle span").textContent = A.playing ? "Pause" : "Play";
    $("#nowWatch").href = `https://www.youtube.com/watch?v=${encodeURIComponent(t.id)}`;
    vinyl.setAttribute("aria-valuenow", i + 1);
    vinyl.setAttribute("aria-valuetext", `${t.title}, track ${i + 1} of ${N}`);
    renderTime();
  }
  function renderTime() {
    const d = A.duration, c = A.currentTime;
    $("#nowTime").textContent = fmt(c);
    $("#nowDur").textContent = d ? fmt(d) : tracks[A.index].length;
    if (!seeking) seekEl.value = d ? Math.round((c / d) * 1000) : 0;
    seekEl.style.setProperty("--p", (seekEl.value / 10) + "%");
  }

  A.on("track", render);
  A.on("state", render);
  A.on("time", renderTime);

  seekEl.addEventListener("input", () => { seeking = true; seekEl.style.setProperty("--p", (seekEl.value / 10) + "%"); });
  seekEl.addEventListener("change", () => { A.seek(seekEl.value / 1000); seeking = false; });
  volEl.value = Math.round(A.volume * 100);
  volEl.style.setProperty("--p", volEl.value + "%");
  volEl.addEventListener("input", () => { A.setVolume(volEl.value / 100); volEl.style.setProperty("--p", volEl.value + "%"); });

  /* ---------- Spin physics ---------- */
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!dragging) {
      const target = A.playing && !reduced ? RPM_33 : 0;
      // flicks coast down to the turntable speed; slow ramps feel like a motor
      const k = Math.abs(speed) > Math.abs(target) ? 1.4 : 2.5;
      speed += (target - speed) * Math.min(1, dt * k);
      rot += speed * dt;
    }
    disc.style.transform = `rotate(${rot}deg)`;
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
    // Button released somewhere we didn't hear about: let go.
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
    preview = steps ? wrap(A.index + steps) : null;
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
    // If the hand stopped before letting go, there's no flick.
    if (performance.now() - lastT > 90) vel = 0;
    speed = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, vel));   // coast at the drag speed
    const steps = stepsFor(total);
    lastPreview = null;
    preview = null;
    if (steps) A.play(A.index + steps);
    else {
      render();
      if (Math.abs(total) < 6 && performance.now() - downAt < 400) A.toggle();
    }
  }
  const releaseIfMine = e => { if (e.pointerId === pointerId) release(); };
  window.addEventListener("pointerup", releaseIfMine);
  window.addEventListener("pointercancel", releaseIfMine);
  vinyl.addEventListener("lostpointercapture", releaseIfMine);
  window.addEventListener("blur", release);

  function nudge(dir) {
    speed += dir * 520;                 // a visible kick in the right direction
    dir > 0 ? A.next() : A.prev();
  }
  vinyl.addEventListener("keydown", e => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); nudge(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); nudge(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); A.toggle(); }
  });

  $("[data-deck-prev]").addEventListener("click", () => nudge(-1));
  $("[data-deck-next]").addEventListener("click", () => nudge(1));
  $("[data-deck-toggle]").addEventListener("click", () => A.toggle());
  $("#nowList").addEventListener("click", e => {
    const b = e.target.closest("[data-deck]");
    if (!b) return;
    const i = +b.dataset.deck;
    speed += Math.sign(i - A.index || 1) * 520;
    A.play(i);
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

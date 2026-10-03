/* Record deck: an album sleeve with the vinyl halfway out.
   Drag (or flick) the record to spin to another song; tap it to play/pause.
   Every ~72° of spin moves one track. Playback uses the YouTube IFrame API. */
(function () {
  const S = window.SITE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const deck = $("#deck");
  if (!deck) return;

  const vinyl = $("#vinyl"), disc = $("#vinylDisc");
  const tracks = S.tracks, N = tracks.length;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = n => String(n).padStart(2, "0");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const wrap = i => ((i % N) + N) % N;

  const STEP = 360 / N;      // degrees of spin per song
  const MIN_SPIN = 25;       // anything smaller than this is a tap or a wobble
  const RPM_33 = 200;        // ~33⅓ rpm in degrees per second

  let idx = 0, preview = null;
  let rot = 0, speed = 0, dragging = false;
  let playing = false;
  let yt = null, ytReady = false;

  /* ---------- Now-playing panel ---------- */
  $("#nowList").innerHTML = tracks.map((t, i) => `
    <li><button data-deck="${i}">
      <span class="n">${pad(i + 1)}</span>
      <span class="t">${esc(t.title)}</span>
      <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="l">${esc(t.length)}</span>
    </button></li>`).join("");

  function render() {
    const i = preview ?? idx, t = tracks[i];
    $("#nowTitle").textContent = t.title;
    $("#nowMeta").textContent = `Track ${pad(i + 1)} of ${pad(N)} · ${t.length}`;
    $("#nowState").textContent =
      preview !== null && preview !== idx ? "Let go to play" :
      playing ? (yt && yt.isMuted && yt.isMuted() ? "Playing · sound off" : "Now playing") :
      ytReady && deck.classList.contains("has-video") ? "Paused" : "Spin to play";
    $$("#nowList button").forEach(b => {
      const on = +b.dataset.deck === i;
      b.classList.toggle("is-current", on);
      b.toggleAttribute("aria-current", on);
    });
    deck.classList.toggle("is-playing", playing);
    $(".now-toggle span").textContent = playing ? "Pause" : "Play";
    vinyl.setAttribute("aria-valuenow", i + 1);
    vinyl.setAttribute("aria-valuetext", `${t.title}, track ${i + 1} of ${N}`);
  }

  /* ---------- YouTube player ---------- */
  // The deck starts playing by itself (muted, as browsers require) when it scrolls into
  // view. The first time the visitor touches it, the deck switches to normal play with sound.
  const pill = $("#deckSound");
  let autoMode = !reduced;
  let inView = false;
  let pausedByUs = false, retries = 0;
  const listPlayerOpen = () => { const p = $("#player"); return p && !p.hidden; };

  function ensurePlayer() {
    if (ensurePlayer.p) return ensurePlayer.p;
    return (ensurePlayer.p = OCYT.load().then(() => new Promise(resolve => {
      yt = OCYT.create("deckPlayer", tracks[idx].id, {
        onReady: () => { ytReady = true; render(); resolve(); },
        onStateChange: onState
      });
    })));
  }
  OCYT.wirePill(pill, () => yt);
  pill.addEventListener("click", () => { autoMode = false; render(); });

  function onState(e) {
    const st = e.data;
    if (st === YT.PlayerState.PLAYING) {
      playing = true;
      deck.classList.add("has-video");
      document.dispatchEvent(new CustomEvent("oc:play", { detail: "deck" }));
    } else if (st === YT.PlayerState.ENDED) {
      playing = false;
      // play the EP straight through
      if (autoMode) {
        idx = wrap(idx + 1); render();
        yt.loadVideoById(tracks[idx].id);
        OCYT.play(yt, pill, { muted: true });
      } else select(idx + 1, true);
      return;
    } else if (st !== YT.PlayerState.BUFFERING) {
      playing = false;
      // Browsers sometimes pause muted auto-play on their own (e.g. while the page is
      // still settling). If we didn't ask for it and it's on screen, try again.
      if (st === YT.PlayerState.PAUSED && autoMode && inView && !pausedByUs && retries < 3 &&
          document.visibilityState === "visible") {
        retries++;
        setTimeout(() => { if (autoMode && inView && !playing) OCYT.play(yt, pill, { muted: true }); }, 500);
      }
    }
    if (st === YT.PlayerState.PLAYING) retries = 0;
    render();
  }
  // Clicking inside the YouTube frame moves focus into it: treat that as the visitor taking over.
  window.addEventListener("blur", () => {
    setTimeout(() => {
      if (document.activeElement && document.activeElement.id === "deckPlayer") { autoMode = false; render(); }
    }, 0);
  });

  function autoStart() {
    if (!autoMode || !inView || listPlayerOpen()) return;
    ensurePlayer().then(() => {
      if (!autoMode || !inView || playing || listPlayerOpen()) return;
      deck.classList.add("has-video");
      pausedByUs = false;
      OCYT.play(yt, pill, { muted: true });
    });
  }
  if ("IntersectionObserver" in window) {
    // Load the player a little before the deck is reached so it's ready instantly.
    const early = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { ensurePlayer(); early.disconnect(); }
    }, { rootMargin: "600px 0px" });
    early.observe(deck);
    // Auto-play while on screen; pause muted auto-play when scrolled away.
    new IntersectionObserver(es => {
      inView = es.some(e => e.isIntersecting);
      if (inView) autoStart();
      else if (autoMode && ytReady && playing) { pausedByUs = true; yt.pauseVideo(); }
    }, { threshold: 0.45 }).observe(deck);
  } else ensurePlayer();

  function play(i) {
    autoMode = false;   // a deliberate choice: play with sound
    deck.classList.add("has-video");
    const go = () => { yt.loadVideoById(tracks[i].id); OCYT.play(yt, pill); };
    ytReady ? go() : ensurePlayer().then(go);
  }
  function select(i, autoplay) {
    const next = wrap(i);
    const changed = next !== idx;
    idx = next;
    preview = null;
    render();
    if (autoplay && (changed || !playing || autoMode)) play(idx);
  }
  function toggle() {
    if (!ytReady) { play(idx); return; }
    if (autoMode && playing) {          // first tap on a muted auto-play: turn the sound on
      autoMode = false;
      yt.unMute(); yt.setVolume(100);
      OCYT.showPill(pill, false);
      render();
      return;
    }
    autoMode = false;
    if (playing) yt.pauseVideo();
    else if (deck.classList.contains("has-video")) OCYT.play(yt, pill);
    else play(idx);
  }
  // Pause when the tracklist player starts.
  document.addEventListener("oc:play", e => {
    if (e.detail === "deck") return;
    autoMode = false;
    if (ytReady && playing) yt.pauseVideo();
  });

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
    // If the hand stopped before letting go, there's no flick.
    if (performance.now() - lastT > 90) vel = 0;
    speed = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, vel));   // coast at the drag speed
    const steps = stepsFor(total);
    lastPreview = null;
    if (steps) {
      select(idx + steps, true);
    } else {
      preview = null;
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
    select(idx + dir, true);
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
    speed += Math.sign(i - idx || 1) * 520;
    select(i, true);
  });

  /* ---------- Entrance: record slides out of the sleeve ---------- */
  if (window.gsap && window.ScrollTrigger && !reduced) {
    gsap.from(vinyl, {
      xPercent: -48, duration: 1.6, ease: "expo.out",
      scrollTrigger: { trigger: deck, start: "top 75%" },
      onStart: () => { speed = 700; }
    });
  }

  render();
})();

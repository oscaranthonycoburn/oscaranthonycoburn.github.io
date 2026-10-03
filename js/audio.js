/* Background music: one audio player for the whole site.
   - Tries to start playing as soon as the page opens.
   - Browsers block sound until the visitor's first tap/click/keypress, so if the
     first attempt is refused, it starts automatically at that first interaction.
   - Plays the EP straight through and loops back to the first song.
   The record deck, tracklist and mini bar are just controls for this. */
window.OCAudio = (function () {
  const S = window.SITE;
  const tracks = S.tracks;
  const N = tracks.length;
  const wrap = i => ((i % N) + N) % N;

  const el = new Audio();
  el.preload = "auto";
  const bus = new EventTarget();
  const emit = type => bus.dispatchEvent(new Event(type));

  let idx = 0;
  let autoStart = true;      // until the visitor pauses, we want music
  let started = false;       // sound has actually started at least once
  let errors = 0;

  try { const v = parseFloat(localStorage.getItem("oc-volume")); if (v >= 0 && v <= 1) el.volume = v; } catch (_) {}

  function load(i) {
    idx = wrap(i);
    el.src = tracks[idx].audio;
    updateMediaSession();
    emit("track");
  }

  function play(i) {
    if (i !== undefined && (wrap(i) !== idx || !el.src)) load(i);
    else if (!el.src) load(idx);
    autoStart = true;
    return el.play().then(() => { started = true; errors = 0; }).catch(() => { /* blocked: waits for first tap */ });
  }
  function pause() { autoStart = false; el.pause(); }
  function toggle() { el.paused ? play() : pause(); }
  function next() { play(idx + 1); }
  function prev() { if (el.currentTime > 3) { el.currentTime = 0; play(); } else play(idx - 1); }
  function seek(frac) { if (isFinite(el.duration)) el.currentTime = Math.max(0, Math.min(1, frac)) * el.duration; }
  function setVolume(v) {
    el.volume = Math.max(0, Math.min(1, v));
    try { localStorage.setItem("oc-volume", String(el.volume)); } catch (_) {}
    emit("volume");
  }

  el.addEventListener("play", () => emit("state"));
  el.addEventListener("pause", () => emit("state"));
  el.addEventListener("timeupdate", () => emit("time"));
  el.addEventListener("loadedmetadata", () => emit("time"));
  el.addEventListener("ended", () => play(idx + 1));      // keep the EP going, loop at the end
  el.addEventListener("error", () => {
    errors++;
    emit("error");
    if (errors < N && autoStart) play(idx + 1);          // skip a missing/broken file
  });

  /* ---------- Start as soon as the browser allows ---------- */
  // Controls that start music themselves handle their own tap.
  const SELF_HANDLED = "[data-play], [data-deck], #vinyl, [data-deck-toggle], [data-deck-prev], [data-deck-next], [data-mini-toggle], [data-mini-next], #nowSeek, #nowVol";
  const UNLOCK = ["pointerup", "touchend", "click", "keydown"];
  function unlock(e) {
    if (started) return stopListening();
    const active = navigator.userActivation ? navigator.userActivation.isActive : true;
    if (!active) return;                                  // a scroll/swipe doesn't count
    stopListening();
    const t = e.target;
    if (t && t.closest && t.closest(SELF_HANDLED)) return;
    if (autoStart && el.paused) play();
  }
  function stopListening() { UNLOCK.forEach(t => document.removeEventListener(t, unlock, true)); }
  UNLOCK.forEach(t => document.addEventListener(t, unlock, true));

  load(0);
  play();   // works right away if the browser allows it; otherwise waits for the first tap

  /* ---------- Lock screen / headphone controls ---------- */
  function updateMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const art = new URL(S.cover, location.href).href;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: tracks[idx].title, artist: S.credit, album: S.title,
      artwork: [{ src: art, sizes: "1215x1286", type: "image/jpeg" }]
    });
  }
  if ("mediaSession" in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => play());
    ms.setActionHandler("pause", pause);
    ms.setActionHandler("previoustrack", prev);
    ms.setActionHandler("nexttrack", next);
    try { ms.setActionHandler("seekto", d => { el.currentTime = d.seekTime; }); } catch (_) {}
  }

  return {
    tracks,
    get index() { return idx; },
    get playing() { return !el.paused; },
    get started() { return started; },
    get currentTime() { return el.currentTime || 0; },
    get duration() { return isFinite(el.duration) ? el.duration : 0; },
    get volume() { return el.volume; },
    play, pause, toggle, next, prev, seek, setVolume,
    on: (type, fn) => bus.addEventListener(type, fn)
  };
})();

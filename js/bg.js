/* Background music: one track looping forever behind the whole site.
   - Gapless loop via the Web Audio API.
   - Starts as soon as the browser allows: right away if permitted, otherwise at the
     visitor's first tap/click/keypress (browsers block sound before that).
   - duck(who): something with sound started (the record deck, the TV, the alarm) -> fade out
     quickly, then actually pause (keeps its place).
   - unduck(who): that thing stopped -> once nothing else is holding the music off, resume from
     the same spot and fade back in. Each player holds its own, so one stopping can't bring the
     music back while another is still playing.
   - Pauses while the tab is in the background. */
window.OCBg = (function () {
  const cfg = window.SITE && window.SITE.background;
  const AC = window.AudioContext || window.webkitAudioContext;
  const noop = { duck() {}, unduck() {}, get ducked() { return false; } };
  if (!cfg || !AC) return noop;

  const ctx = new AC();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  const VOLUME = cfg.volume ?? 0.6;

  let source = null, ducked = false, unlocked = false, pauseTimer = null;
  const holders = new Set();
  const FADE_OUT = 0.35, FADE_IN = 0.8;   // seconds

  function fadeTo(v, secs) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(v, t + secs);
  }
  function apply() {
    clearTimeout(pauseTimer);
    if (ducked) {
      // Quick fade, then really pause (suspend keeps the playback position).
      if (ctx.state !== "running") return;
      fadeTo(0, FADE_OUT);
      pauseTimer = setTimeout(() => { if (ducked) ctx.suspend(); }, FADE_OUT * 1000 + 30);
    } else if (unlocked) {
      const fadeIn = () => {
        if (ducked) { apply(); return; }   // something started playing while the audio was waking up
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(Math.min(gain.gain.value, VOLUME), ctx.currentTime);
        fadeTo(VOLUME, FADE_IN);
      };
      ctx.state === "running" ? fadeIn() : ctx.resume().then(fadeIn).catch(() => {});
    }
  }

  fetch(cfg.src)
    .then(r => r.arrayBuffer())
    .then(data => new Promise((res, rej) => ctx.decodeAudioData(data, res, rej)))
    .then(buffer => {
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      // Compressed audio adds a few milliseconds of padding; loop only the real music.
      const len = Math.min(cfg.seconds || buffer.duration, buffer.duration);
      const pad = Math.max(0, buffer.duration - len);
      source.loopStart = pad;
      source.loopEnd = pad + len;
      source.connect(gain);
      source.start(0, pad);
      tryStart();
    })
    .catch(() => {});

  // Works immediately if the browser allows autoplay; otherwise waits for a tap.
  function tryStart() {
    ctx.resume().then(() => {
      if (ctx.state === "running") { unlocked = true; stopListening(); apply(); }
    }).catch(() => {});
  }
  const UNLOCK = ["pointerup", "touchend", "click", "keydown"];
  function onInteract() {
    if (navigator.userActivation && !navigator.userActivation.isActive) return;   // a scroll doesn't count
    tryStart();
  }
  function stopListening() { UNLOCK.forEach(t => document.removeEventListener(t, onInteract, true)); }
  UNLOCK.forEach(t => document.addEventListener(t, onInteract, true));
  tryStart();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) ctx.suspend();
    else if (unlocked && !ducked) apply();
  });

  return {
    duck(who = "song") { holders.add(who); if (!ducked) { ducked = true; apply(); } },
    unduck(who = "song") { holders.delete(who); if (ducked && !holders.size) { ducked = false; apply(); } },
    get ducked() { return ducked; },
    get running() { return ctx.state === "running"; },   // playing (false while paused for a song)
    get level() { return gain.gain.value; }              // current volume (0 while faded out)
  };
})();

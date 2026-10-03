/* Background music: one track looping forever behind the whole site.
   - Gapless loop via the Web Audio API.
   - Starts as soon as the browser allows: right away if permitted, otherwise at the
     visitor's first tap/click/keypress (browsers block sound before that).
   - duck() fades it out (a song video started); unduck() fades it back in.
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

  let source = null, ducked = false, unlocked = false;

  function fadeTo(v, secs) {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(v, t + secs);
  }
  const apply = () => fadeTo(ducked ? 0 : VOLUME, ducked ? 0.6 : 2);

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
      if (ctx.state === "running") { unlocked = true; apply(); stopListening(); }
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
    else if (unlocked) ctx.resume();
  });

  return {
    duck() { if (!ducked) { ducked = true; apply(); } },
    unduck() { if (ducked) { ducked = false; apply(); } },
    get ducked() { return ducked; },
    get running() { return ctx.state === "running"; },   // sound is allowed and playing
    get level() { return gain.gain.value; }              // current volume (0 while faded out)
  };
})();

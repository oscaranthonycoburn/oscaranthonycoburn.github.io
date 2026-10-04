/* Breaking-news alarm.
   When a new News post goes live, everyone on the site gets sirens and red police-light
   beams until 30 seconds after it went live. Then it's gone for good.

   How "new" and "when" are decided (no server needed):
   - The site re-checks content/news.json every few seconds. A post that wasn't there on
     the previous check is new.
   - Someone who opens the site fresh has no previous check, so a post counts as new if it
     was posted (its date + time) within a few minutes before the file went live.
   - "When it went live" is GitHub's Last-Modified time for the file, compared against
     GitHub's own clock (the Date header), so the 30 seconds end at the same moment for
     everyone regardless of their device clock.

   Safety: the red glow pulses ~2x per second and the beams sweep/rotate rather than strobe,
   staying under the 3-flashes-per-second limit for photosensitive viewers. With "Reduce
   motion" on, the alarm is a still red screen. Browsers only allow sound after the visitor
   has clicked/tapped the page; if they haven't, the sirens start at their first tap. */
(function () {
  const S = window.SITE;
  const cfg = (S && S.alarm) || {};
  if (cfg.enabled === false) return;

  const WINDOW = (cfg.seconds || 30) * 1000;
  const POLL = (cfg.pollSeconds || 8) * 1000;
  const FRESH_SLACK = 5 * 60 * 1000;       // a fresh visitor counts a post as new if posted ≤5 min before it went live
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const idOf = p => `${p.title}|${p.date}`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let known = null;          // post ids seen on the previous check
  let lastText = "";         // the file as of the previous check (to spot edits)
  let running = false;
  let soundCtx = null;       // the current siren audio (for status checks)
  // Never alarm twice for the same post (remembered in this browser across visits).
  let fired;
  try { fired = new Set(JSON.parse(localStorage.getItem("oc-alarmed") || "[]")); } catch (_) { fired = new Set(); }
  const remember = id => {
    fired.add(id);
    try { localStorage.setItem("oc-alarmed", JSON.stringify([...fired].slice(-50))); } catch (_) {}
  };

  function postedAt(d) {
    if (!d) return NaN;
    let s = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;              // date only: no time to go on
    if (/T\d{2}:\d{2}$/.test(s)) s += ":00";
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += (cfg.timezone || "-07:00");
    return Date.parse(s);
  }

  async function check() {
    let res, data, text;
    try {
      res = await fetch("content/news.json", { cache: "no-cache" });
      if (!res.ok) return;
      text = await res.text();
      data = JSON.parse(text);
    } catch (_) { return; }

    const posts = (data.posts || []).filter(p => p && p.title && !p.hidden);
    const live = Date.parse(res.headers.get("last-modified"));
    const now = Date.parse(res.headers.get("date")) || Date.now();
    const age = isFinite(live) ? now - live : Infinity;
    const ids = new Set(posts.map(idOf));

    let fresh;
    if (known) {
      fresh = posts.filter(p => !known.has(idOf(p)));
      if (text !== lastText) document.dispatchEvent(new CustomEvent("oc:news", { detail: data }));   // new posts or edits show up live
    } else {
      fresh = posts.filter(p => {
        const t = postedAt(p.date);
        return isFinite(t) && live - t >= -2 * 60 * 1000 && live - t <= FRESH_SLACK;
      });
    }
    known = ids;
    lastText = text;
    // Newest first, so the banner always headlines the post that just went up.
    fresh = fresh.filter(p => !fired.has(idOf(p)))
      .sort((a, b) => (postedAt(b.date) || 0) - (postedAt(a.date) || 0) || String(b.date).localeCompare(String(a.date)));
    if (fresh.length && age < WINDOW && !running) {
      fresh.forEach(p => remember(idOf(p)));
      start(fresh[0], WINDOW - Math.max(0, age));
    }
  }

  /* ---------- Sirens (synthesized, no audio files) ---------- */
  function sirens(ms) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return () => {};
    const ctx = new AC();
    soundCtx = ctx;
    const dur = ms / 1000 + 1;

    // Everything is driven hard into a soft-clipper and a limiter: as loud as the
    // browser will output without turning into pure crackle.
    const mix = ctx.createGain(); mix.gain.value = 1;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(3.2 * x); }
    shaper.curve = curve;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.002; limiter.release.value = 0.08;
    const master = ctx.createGain(); master.gain.value = 0;
    mix.connect(shaper); shaper.connect(limiter); limiter.connect(master); master.connect(ctx.destination);

    const t0 = ctx.currentTime;
    master.gain.linearRampToValueAtTime(1, t0 + 0.12);
    const nodes = [];

    // A siren = an oscillator whose pitch is swept by a slower "LFO" oscillator.
    function siren(type, base, lfoType, lfoHz, depth, level) {
      const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = base;
      const lfo = ctx.createOscillator(); lfo.type = lfoType; lfo.frequency.value = lfoHz;
      const amt = ctx.createGain(); amt.gain.value = depth;
      const g = ctx.createGain(); g.gain.value = level;
      lfo.connect(amt); amt.connect(osc.frequency); osc.connect(g); g.connect(mix);
      osc.start(t0); lfo.start(t0); osc.stop(t0 + dur); lfo.stop(t0 + dur);
      nodes.push(osc, lfo);
    }
    siren("sawtooth", 950, "sine", 0.45, 450, 0.32);      // classic wail (US police)
    siren("square", 1250, "sawtooth", 4.5, 380, 0.22);    // fast yelp
    siren("sawtooth", 520, "sine", 0.18, 260, 0.30);      // slow air-raid
    // European two-tone hi-lo
    const hilo = ctx.createOscillator(); hilo.type = "square";
    for (let i = 0, t = 0; t < dur; i++, t += 0.45) hilo.frequency.setValueAtTime(i % 2 ? 660 : 920, t0 + t);
    const hg = ctx.createGain(); hg.gain.value = 0.24;
    hilo.connect(hg); hg.connect(mix); hilo.start(t0); hilo.stop(t0 + dur); nodes.push(hilo);
    // Klaxon pulse on top
    const kl = ctx.createOscillator(); kl.type = "square"; kl.frequency.value = 380;
    const kg = ctx.createGain(); kg.gain.value = 0;
    for (let t = 0; t < dur; t += 1.2) { kg.gain.setValueAtTime(0.28, t0 + t); kg.gain.setValueAtTime(0, t0 + t + 0.6); }
    kl.connect(kg); kg.connect(mix); kl.start(t0); kl.stop(t0 + dur); nodes.push(kl);

    // If the visitor hasn't tapped the page yet, the sound starts at their first tap.
    const resume = () => { ctx.resume(); };
    const UNLOCK = ["pointerup", "touchend", "click", "keydown"];
    if (ctx.state !== "running") {
      ctx.resume().catch(() => {});
      UNLOCK.forEach(t => document.addEventListener(t, resume, true));
    }

    return function stop() {
      UNLOCK.forEach(t => document.removeEventListener(t, resume, true));
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.25);
      setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch (_) {} }); ctx.close(); }, 400);
    };
  }

  /* ---------- Lights + banner ---------- */
  function start(post, ms) {
    running = true;
    const bg = window.OCBg, deck = window.OCDeck;
    if (deck && deck.playing) deck.toggle();     // pause any song video
    bg && bg.duck("alarm");                             // and the background music

    const el = document.createElement("div");
    el.className = "alarm" + (reduced ? " is-still" : "");
    el.setAttribute("role", "alert");
    el.innerHTML = `
      <div class="alarm-glow left"></div><div class="alarm-glow right"></div>
      <div class="alarm-spot s1"></div><div class="alarm-spot s2"></div><div class="alarm-spot s3"></div>
      <div class="alarm-beam b1"></div><div class="alarm-beam b2"></div>
      <div class="alarm-beam b3"></div><div class="alarm-beam b4"></div>
      <div class="alarm-tape top"></div><div class="alarm-tape bottom"></div>
      <div class="alarm-lightbar">${'<i></i>'.repeat(10)}</div>
      <div class="alarm-banner">
        <p class="alarm-kicker">🚨 Breaking news 🚨</p>
        <p class="alarm-title">${esc(post.title)}</p>
        <div class="alarm-actions">
          <button class="btn btn-red" data-alarm-read>Read it now</button>
          <button class="alarm-mute" data-alarm-stop>Silence</button>
        </div>
        <p class="alarm-count" aria-hidden="true"></p>
      </div>`;
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add("is-on"));

    const stopSound = sirens(ms);
    const endAt = Date.now() + ms;
    const count = el.querySelector(".alarm-count");
    const tickTimer = setInterval(() => { count.textContent = Math.max(0, Math.ceil((endAt - Date.now()) / 1000)) + "s"; }, 250);

    let done = false;
    function finish() {
      if (done) return; done = true;
      clearInterval(tickTimer); clearTimeout(endTimer);
      stopSound();
      el.classList.remove("is-on");
      setTimeout(() => el.remove(), 500);
      bg && bg.unduck("alarm");
      running = false;
    }
    const endTimer = setTimeout(finish, ms);
    el.querySelector("[data-alarm-stop]").addEventListener("click", finish);
    el.querySelector("[data-alarm-read]").addEventListener("click", () => {
      finish();
      const tab = document.querySelector('[data-go="news"]');
      tab && tab.click();
    });
  }

  /* ---------- Keep checking while the site is open ---------- */
  check();
  let timer = setInterval(() => { if (!document.hidden) check(); }, POLL);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });

  // Read-only status (no way to trigger it without a real post).
  window.OCAlarm = {
    get running() { return running; },
    get soundOn() { return !!soundCtx && soundCtx.state === "running"; }
  };
})();

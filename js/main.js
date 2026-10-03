(function () {
  const S = window.SITE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = n => String(n).padStart(2, "0");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isHome = !!$("#trackList");
  const isLibrary = !!$("#libraryGrid");

  /* ---------- Theme from palette ---------- */
  Object.entries(S.palette).forEach(([k, v]) => document.documentElement.style.setProperty("--" + k, v));

  /* ---------- Fill shared content ---------- */
  $$("[data-text]").forEach(el => { el.textContent = S[el.dataset.text] || ""; });
  $$("[data-link]").forEach(a => { a.href = S.links[a.dataset.link]; });

  // Images: attach the error handler before setting src so a missing file shows a placeholder.
  $$("img[data-src]").forEach(img => {
    img.addEventListener("error", () => {
      img.parentElement.classList.add("is-missing");
      const wrap = img.closest(".cover-wrap");
      if (wrap) wrap.classList.add("is-missing");
    }, { once: true });
    img.src = S[img.dataset.src];
  });

  /* ---------- Library page ---------- */
  if (isLibrary) {
    const releases = S.library || [];
    const slots = Math.max(S.librarySlots || 6, Math.ceil(releases.length / 3) * 3);
    const urlFor = r => (r.url === "spotify" || !r.url) ? S.links.spotify : r.url;
    const plus = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
    const spotifyIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21zm4.8 15.2a.65.65 0 0 1-.9.2c-2.5-1.5-5.6-1.8-9.3-1a.65.65 0 1 1-.3-1.3c4-.9 7.5-.5 10.3 1.2.3.2.4.6.2.9zm1.3-2.9a.8.8 0 0 1-1.1.3c-2.8-1.7-7.2-2.2-10.5-1.2a.8.8 0 1 1-.5-1.6c3.8-1.1 8.6-.6 11.8 1.4.4.2.5.7.3 1.1zm.1-3c-3.4-2-9-2.2-12.2-1.2a1 1 0 1 1-.6-1.9c3.7-1.1 9.9-.9 13.8 1.4a1 1 0 0 1-1 1.7z"/></svg>`;

    const filled = releases.map(r => `
      <li class="release" data-fade>
        <a class="release-link" href="${esc(urlFor(r))}" target="_blank" rel="noopener"
           aria-label="${esc(r.title)} (${esc(r.type)}, ${esc(r.year)}): listen on Spotify">
          <span class="release-art">
            <img src="${esc(r.cover)}" alt="" loading="lazy">
            <span class="release-badge">${spotifyIcon} Listen</span>
          </span>
          <span class="release-title">${esc(r.title)}</span>
          <span class="release-meta">${esc(r.type)} · ${esc(r.year)}${r.songs ? ` · ${r.songs} songs` : ""}</span>
        </a>
      </li>`);
    const empty = Array.from({ length: slots - releases.length }, () => `
      <li class="release is-empty" data-fade aria-label="Coming soon">
        <span class="release-art">${plus}</span>
        <span class="release-title">Coming soon</span>
        <span class="release-meta">More music on the way</span>
      </li>`);
    $("#libraryGrid").innerHTML = filled.concat(empty).join("");
  }

  /* ---------- Home: tracklist + inline player ---------- */
  let lenis = null;
  let openTrack = () => {};

  if (isHome) {
    const tracks = S.tracks.map((t, i) => ({ ...t, i }));
    const playIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;

    $("#trackList").innerHTML = tracks.map(t => `
      <li>
        <button class="track-card" data-play="${t.i}" aria-label="Play ${esc(t.title)}, ${esc(t.length)}">
          <span class="track-num">${pad(t.i + 1)}</span>
          <span>
            <span class="track-title">${esc(t.title)}</span>
            ${t.titleTrack ? `<span class="track-tag">Title track</span>` : ""}
          </span>
          <span class="track-side">
            <span class="track-len">${esc(t.length)}</span>
            <span class="track-play">${playIcon}</span>
            <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          </span>
        </button>
      </li>`).join("");

    $("#roles").innerHTML = S.roles.map(r => `<li>${esc(r)}</li>`).join("");
    $("#bio").innerHTML = S.bio.map(p => `<p>${esc(p)}</p>`).join("");

    const player = $("#player");
    const pill = $("#playerSound");
    let current = -1;
    let yt = null;

    window.OCYT && OCYT.wirePill(pill, () => yt);

    function setPlaying(i) {
      $$(".track-card").forEach(c => {
        const on = +c.dataset.play === i;
        c.classList.toggle("is-playing", on);
        c.setAttribute("aria-pressed", on);
      });
    }
    function startVideo(t) {
      // Prefer the IFrame API (lets us detect blocked sound); fall back to a plain embed.
      if (!window.OCYT) {
        $("#playerVideo").innerHTML =
          `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(t.id)}?autoplay=1&rel=0&playsinline=1"
             title="${esc(t.title)} by ${esc(S.artist)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
        return;
      }
      if (yt && yt.loadVideoById) {
        yt.loadVideoById(t.id);
        OCYT.play(yt, pill);
        return;
      }
      $("#playerVideo").innerHTML = `<div id="listPlayer"></div>`;
      OCYT.load().then(() => {
        if (player.hidden) return;   // closed before the API arrived
        yt = OCYT.create("listPlayer", tracks[current].id, {
          onReady: e => OCYT.play(e.target, pill),
          onStateChange: e => {
            if (e.data === YT.PlayerState.ENDED) openTrack(current + 1);   // keep the EP going
          }
        });
      });
    }
    openTrack = function (i) {
      i = (i + tracks.length) % tracks.length;
      const t = tracks[i];
      const wasHidden = player.hidden;
      current = i;
      $("#playerNum").textContent = `Now playing · ${pad(i + 1)} / ${pad(tracks.length)}`;
      $("#playerTitle").textContent = t.title;
      player.hidden = false;
      startVideo(t);
      setPlaying(i);
      document.dispatchEvent(new CustomEvent("oc:play", { detail: "list" }));
      if (wasHidden && window.gsap && !reduced) {
        gsap.fromTo(player, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .7, ease: "expo.out" });
      }
      if (window.ScrollTrigger) ScrollTrigger.refresh();
      const r = player.getBoundingClientRect();
      if (r.top < 60 || r.top > innerHeight * .4) goTo(player);
    };
    function closePlayer(restoreFocus = true) {
      if (player.hidden) return;
      if (yt && yt.destroy) { yt.destroy(); yt = null; }
      $("#playerVideo").innerHTML = "";   // stops playback
      window.OCYT && OCYT.showPill(pill, false);
      player.hidden = true;
      setPlaying(-1);
      if (window.ScrollTrigger) ScrollTrigger.refresh();
      const card = $(`.track-card[data-play="${current}"]`);
      restoreFocus && card && card.focus({ preventScroll: true });
    }
    // Only one thing plays at a time: the record deck announces itself via this event.
    document.addEventListener("oc:play", e => { if (e.detail !== "list") closePlayer(false); });

    $("[data-close]", player).addEventListener("click", () => closePlayer());
    $("[data-prev]", player).addEventListener("click", () => openTrack(current - 1));
    $("[data-next]", player).addEventListener("click", () => openTrack(current + 1));
    document.addEventListener("click", e => {
      const p = e.target.closest("[data-play]");
      if (p) openTrack(+p.dataset.play);
    });
  }

  /* ---------- Share ---------- */
  const toast = $("#toast");
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }
  async function share() {
    const url = S.siteUrl || location.href;
    const data = { title: `${S.title} · ${S.credit}`, text: `Listen to "${S.title}", the debut EP from ${S.credit}.`, url };
    if (navigator.share) {
      try { await navigator.share(data); } catch (_) { /* cancelled */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); showToast("Link copied. Share it with someone."); }
    catch (_) { prompt("Copy this link:", url); }
  }
  $$("[data-share]").forEach(b => b.addEventListener("click", share));

  /* ---------- Smooth anchor scrolling ---------- */
  function goTo(target) {
    if (lenis) lenis.scrollTo(target, { offset: -96, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  }
  $$("[data-scroll]").forEach(a => a.addEventListener("click", e => {
    const target = $(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    goTo(target);
  }));

  // Everything below is motion. Content above is fully usable without it.
  if (!window.gsap || !window.ScrollTrigger || reduced) return;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis ---------- */
  if (window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: self => { if (window.__bg) window.__bg.scroll = self.progress; }
  });

  /* ---------- Sections fade + slide in (both pages) ---------- */
  $$("[data-fade]").forEach(el => {
    gsap.from(el, {
      y: 24, opacity: 0, duration: 1, ease: "expo.out", clearProps: "transform,opacity",
      scrollTrigger: { trigger: el, start: "top 92%" }
    });
  });

  if (isLibrary) {
    gsap.from([".nav", ".library-head > *"], { y: -16, opacity: 0, duration: .8, ease: "expo.out", stagger: .08 });
  }

  if (isHome) {
    /* ---------- Hero intro: letters reveal one by one ---------- */
    const title = $(".hero-title");
    const label = title.textContent.trim();
    title.setAttribute("aria-label", label);
    title.innerHTML = label.split(" ").map(w =>
      `<span class="word" aria-hidden="true">${[...w].map(c => `<span class="char">${esc(c)}</span>`).join("")}</span>`
    ).join(" ");

    gsap.timeline({ defaults: { ease: "expo.out" } })
      .from(".cover", { opacity: 0, scale: .92, filter: "blur(20px)", duration: 1.6 })
      .from(".cover-glow", { opacity: 0, duration: 2 }, 0)
      .from(".eyebrow", { y: 16, opacity: 0, duration: .8 }, .3)
      .from(".hero-title .char", { yPercent: 110, opacity: 0, duration: 1, stagger: .055 }, .4)
      .from([".hero-artist", ".hero-meta"], { y: 16, opacity: 0, duration: .8, stagger: .1 }, "-=.6")
      .from(".hero-ctas > *", { y: 16, opacity: 0, duration: .8, stagger: .1 }, "-=.6")
      .from(".nav", { y: -24, opacity: 0, duration: .8 }, "-=.9");

    // On scroll the cover smears sideways and fades, like the photo's motion blur
    gsap.to(".cover-wrap", {
      x: 40, filter: "blur(6px)", opacity: .4, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
    gsap.to(".cover-ghost", {
      x: -60, opacity: .6, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });

    gsap.set(".track-card", { y: 24, opacity: 0 });
    ScrollTrigger.batch(".track-card", {
      start: "top 92%",
      onEnter: batch => gsap.to(batch, {
        y: 0, opacity: 1, duration: .9, ease: "expo.out", stagger: .08,
        clearProps: "transform,opacity"   // hand transforms back to CSS hover
      })
    });
    gsap.from(".follow-btn", {
      y: 24, opacity: 0, duration: .9, ease: "expo.out", stagger: .1, clearProps: "transform,opacity",
      scrollTrigger: { trigger: ".follow-grid", start: "top 90%" }
    });
  }

  addEventListener("load", () => ScrollTrigger.refresh());
})();

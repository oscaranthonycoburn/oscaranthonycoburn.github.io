(function () {
  const S = window.SITE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = n => String(n).padStart(2, "0");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

  /* ---------- Library ---------- */
  (function renderLibrary() {
    const releases = S.library || [];
    const slots = Math.max(S.librarySlots || 6, Math.ceil(releases.length / 3) * 3);
    const urlFor = r => r.spotify || S.links.spotify;
    const plus = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
    const spotifyIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21zm4.8 15.2a.65.65 0 0 1-.9.2c-2.5-1.5-5.6-1.8-9.3-1a.65.65 0 1 1-.3-1.3c4-.9 7.5-.5 10.3 1.2.3.2.4.6.2.9zm1.3-2.9a.8.8 0 0 1-1.1.3c-2.8-1.7-7.2-2.2-10.5-1.2a.8.8 0 1 1-.5-1.6c3.8-1.1 8.6-.6 11.8 1.4.4.2.5.7.3 1.1zm.1-3c-3.4-2-9-2.2-12.2-1.2a1 1 0 1 1-.6-1.9c3.7-1.1 9.9-.9 13.8 1.4a1 1 0 0 1-1 1.7z"/></svg>`;
    const appleIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 2.6v12.9a3 3 0 1 1-1.8-2.75V7.3l-8 1.9v8.6a3 3 0 1 1-1.8-2.75V5.6z"/></svg>`;
    const filled = releases.map((r, i) => `
      <li class="release" data-fade>
        <a class="release-link" href="${esc(urlFor(r))}" target="_blank" rel="noopener" data-listen-on="${i}"
           aria-label="${esc(r.title)} (${esc(r.type)}, ${esc(r.year)}): listen on Spotify or Apple Music">
          <span class="release-art">
            <img src="${esc(r.cover)}" alt="" loading="lazy">
            <span class="release-badge"><span class="svc svc-spotify">${spotifyIcon}</span><span class="svc svc-apple">${appleIcon}</span> Listen</span>
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
  })();

  /* ---------- News board: a newspaper-style front page (posts live in content/news.json) ---------- */
  (function renderNews() {
    const board = $("#newsBoard");
    if (!board) return;
    const CATS = S.newsCategories || [];
    const catOf = name => CATS.find(c => c.name.toLowerCase() === String(name || "").toLowerCase()) || { name: name || "News", key: "news" };
    const today = new Date().toISOString().slice(0, 10);
    const fmtDate = d => {
      const [y, m, day] = String(d || "").slice(0, 10).split("-").map(Number);
      return y ? new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
    };
    const shortDate = d => {
      const [y, m, day] = String(d || "").slice(0, 10).split("-").map(Number);
      return y ? new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
    };
    const safeUrl = u => /^(https?:\/\/|assets\/|\.\/|\/)/i.test(u || "") ? u : "";
    const paras = t => String(t || "").split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

    let posts = [], filter = "all";

    function story(p, lead) {
      const cat = catOf(p.category), img = safeUrl(p.image), link = safeUrl(p.link);
      return `
        <article class="story${lead ? " is-lead" : ""}${lead && String(p.body || "").length > 420 ? " is-long" : ""}">
          <p class="story-kicker">
            <span class="tag tag-${esc(cat.key)}">${esc(cat.name)}</span>
            ${p.pinned ? `<span class="story-pin">Pinned</span>` : ""}
            <time datetime="${esc(p.date || "")}">${esc(fmtDate(p.date))}</time>
          </p>
          <h2 class="story-headline">${esc(p.title)}</h2>
          ${img ? `<div class="story-media"><img src="${esc(img)}" alt="" loading="lazy"></div>` : ""}
          <div class="story-text">${paras(p.body)}</div>
          ${link ? `<a class="story-link" href="${esc(link)}" target="_blank" rel="noopener">${esc(p.linkLabel || "Read more")} <span aria-hidden="true">↗</span></a>` : ""}
        </article>`;
    }

    function render() {
      const shown = filter === "all" ? posts : posts.filter(p => catOf(p.category).key === filter);
      const latest = posts.reduce((m, p) => (p.date > m ? p.date : m), "");
      const used = CATS.filter(c => posts.some(p => catOf(p.category).key === c.key));
      board.innerHTML = `
        <div class="paper">
          <div class="paper-dateline">
            <span>${latest ? `Updated ${esc(shortDate(latest))}` : "Oscar A. Coburn"}</span>
            <span>${posts.length} ${posts.length === 1 ? "story" : "stories"}</span>
          </div>
          <div class="paper-sections" role="group" aria-label="Filter by category">
            ${[{ key: "all", name: "All" }, ...used].map(c => `
              <button class="section-chip${c.key === filter ? " is-active" : ""}" data-news-filter="${esc(c.key)}" aria-pressed="${c.key === filter}">
                ${c.key === "all" ? "" : `<i class="dot tag-${esc(c.key)}" aria-hidden="true"></i>`}${esc(c.name)}
              </button>`).join("")}
          </div>
          ${shown.length
            ? `<div class="paper-grid">${shown.map((p, i) => story(p, i === 0)).join("")}</div>`
            : `<div class="paper-empty"><p class="kicker">Nothing here yet</p><p>${posts.length ? "No stories in this section right now." : "Check back soon for news from Oscar."}</p></div>`}
        </div>`;
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }

    board.addEventListener("click", e => {
      const b = e.target.closest("[data-news-filter]");
      if (!b) return;
      filter = b.dataset.newsFilter;
      render();
      if (window.gsap && !reduced) gsap.from(".paper-grid > .story, .paper-empty", { y: 14, opacity: 0, duration: .5, ease: "expo.out", stagger: .05, clearProps: "transform,opacity" });
    });

    // "2026-10-5" and "2026-10-05" both work (pad month/day so dates compare correctly).
    const normDate = d => {
      const m = String(d || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : "";
    };
    function load(data) {
      posts = (data.posts || [])
        .filter(p => p && p.title && !p.hidden && !(normDate(p.hideAfter) && normDate(p.hideAfter) < today))   // gone after its end date
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.date).localeCompare(String(a.date)));
      render();
    }
    fetch("content/news.json", { cache: "no-cache" })
      .then(r => r.ok ? r.json() : { posts: [] })
      .catch(() => ({ posts: [] }))
      .then(load);
    // js/alarm.js checks for new posts while the site is open and hands them over here.
    document.addEventListener("oc:news", e => load(e.detail));
  })();

  /* ---------- Ask Oscar: contact form ---------- */
  (function contact() {
    const form = $("#contactForm");
    const C = S.contact;
    if (!form || !C) return;
    const address = () => C.user + "@" + C.domain;   // assembled only when needed
    const status = $("#contactStatus");
    const send = $(".contact-send", form);
    $("#contactTopic").innerHTML = C.topics.map(t => `<option>${esc(t)}</option>`).join("");

    const mailto = (subject, body) =>
      `mailto:${address()}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;
    const direct = $("#contactMail");
    direct.href = "#";
    direct.addEventListener("click", e => { e.preventDefault(); location.href = mailto("Question from the website"); });

    function say(msg, kind) { status.textContent = msg; status.dataset.kind = kind || ""; }

    // Name, a real-looking email and a message are all required. The Send button stays
    // disabled until they are, and each field explains what's missing once it's been touched.
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const RULES = {
      name: v => v.trim() ? "" : "Add your name.",
      email: v => !v.trim() ? "Enter your email so Oscar can reply."
                : EMAIL.test(v.trim()) ? "" : "That doesn't look like an email (like name@gmail.com).",
      message: v => v.trim() ? "" : "Write your question or message."
    };
    const touched = new Set();
    function check(showAll) {
      let ok = true;
      Object.keys(RULES).forEach(n => {
        const input = form.elements[n], err = RULES[n](input.value);
        if (err) ok = false;
        const show = err && (showAll || touched.has(n));
        input.closest(".field").classList.toggle("is-invalid", !!show);
        input.setAttribute("aria-invalid", show ? "true" : "false");
        $("#" + n + "Error").textContent = show ? err : "";
      });
      send.disabled = !ok;
      return ok;
    }
    Object.keys(RULES).forEach(n => {
      const input = form.elements[n];
      input.addEventListener("input", () => check());
      input.addEventListener("blur", () => { touched.add(n); check(); });
    });
    check();

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      if (f.botcheck) return;                                       // a bot filled the hidden box
      if (!check(true)) {                                           // backup check at send time
        const bad = form.querySelector('[aria-invalid="true"]');
        bad && bad.focus();
        return say("Please fill in the highlighted fields.", "error");
      }
      const subject = `${f.topic}: message from ${f.name.trim()} (website)`;

      if (!C.web3formsKey) {
        // No form service set up yet: open the visitor's email app with everything filled in.
        location.href = mailto(subject, `${f.message.trim()}\n\n— ${f.name.trim()} (${f.email})`);
        return say("Your email app should open with your message ready. Just hit send.", "ok");
      }
      send.disabled = true;
      say("Sending…");
      try {
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            access_key: C.web3formsKey, subject, from_name: "Oscar A. Coburn website",
            name: f.name.trim(), email: f.email.trim(), topic: f.topic, message: f.message.trim(), botcheck: ""
          })
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || out.success === false) throw new Error(out.message || "failed");
        form.reset();
        touched.clear();
        say("Sent! Oscar will get back to you at the email you gave.", "ok");
      } catch (_) {
        say("That didn't go through. Try again, or use “Email Oscar directly” above.", "error");
      } finally {
        check();
      }
    });
  })();

  /* ---------- "Listen on" chooser: clicking an album lets you pick Spotify or Apple Music ---------- */
  const listen = $("#listen");
  function openListen(i) {
    const r = (S.library || [])[i] || { title: S.title, type: S.format, year: "2026", songs: S.tracks.length, cover: S.cover };
    $("#listenArt").src = r.cover;
    $("#listenTitle").textContent = r.title;
    $("#listenMeta").textContent = `${r.type} · ${r.year}${r.songs ? ` · ${r.songs} songs` : ""} · ${S.credit}`;
    $("#listenSpotify").href = r.spotify || S.links.spotify;
    $("#listenApple").href = r.appleMusic || S.links.appleMusic;
    if (!listen.open) listen.showModal();
    lenis && lenis.stop();
    if (window.gsap && !reduced) gsap.fromTo(".listen-panel", { y: 24, opacity: 0, scale: .97 }, { y: 0, opacity: 1, scale: 1, duration: .45, ease: "expo.out" });
  }
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-listen-on]");
    if (!a || !listen || !listen.showModal) return;   // no dialog support: the link just opens Spotify
    e.preventDefault();
    openListen(+a.dataset.listenOn || 0);
  });
  listen.addEventListener("close", () => { lenis && lenis.start(); });
  listen.addEventListener("click", e => { if (e.target === listen) listen.close(); });   // tap outside
  $("[data-listen-close]").addEventListener("click", () => listen.close());
  $$(".listen-btn").forEach(b => b.addEventListener("click", () => setTimeout(() => listen.close(), 150)));

  /* ---------- Tracklist: tapping a song plays it on the record ---------- */
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

  const deckApi = () => window.OCDeck;
  document.addEventListener("click", e => {
    const p = e.target.closest("[data-play]");
    if (!p || !deckApi()) return;
    const i = +p.dataset.play;
    if (i === deckApi().index && deckApi().playing) deckApi().toggle();   // tapping the playing song pauses it
    else { deckApi().play(i); goTo($("#spin")); }
  });
  // Cards show which song is playing on the record.
  document.addEventListener("oc:deck", e => {
    const { index, playing } = e.detail;
    $$(".track-card").forEach(c => {
      const on = +c.dataset.play === index && playing;
      c.classList.toggle("is-playing", on);
      c.setAttribute("aria-pressed", on);
    });
  });

  // "Listen Now" takes you to the record and starts the current song.
  $$("[data-listen]").forEach(b => b.addEventListener("click", () => { if (deckApi() && !deckApi().playing) deckApi().play(); }));

  /* ---------- Views: Home and Library live in one page so the music never stops ---------- */
  const TITLES = { home: "Oscar A. Coburn · I Ain't Perfect (Debut EP) · Official Site", library: "Library · Oscar A. Coburn", news: "News · Oscar A. Coburn", videos: "Videos · Oscar A. Coburn" };
  let lenis = null;
  let currentView = "home";
  const pill = $(".nav-pill");

  function markTab(name, animate = true) {
    $$(".nav-pages [data-go]").forEach(a => {
      if (a.dataset.go === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const a = $(`.nav-pages [data-go="${name}"]`);
    if (!a || !pill) return;
    pill.classList.toggle("no-anim", !animate);
    pill.style.width = a.offsetWidth + "px";
    pill.style.transform = `translateX(${a.offsetLeft}px)`;
  }
  // Re-measure (without sliding) once fonts load and when the window resizes.
  if (document.fonts) document.fonts.ready.then(() => markTab(currentView, false));
  addEventListener("resize", () => markTab(currentView, false));

  function showView(name, { scroll = true } = {}) {
    currentView = name;
    $$("[data-view]").forEach(v => { v.hidden = v.dataset.view !== name; });
    markTab(name);
    document.title = TITLES[name];
    if (scroll) { lenis ? lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0); }
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }
  // Smooth switch: the tab highlight slides right away while the page content
  // fades out, swaps (and jumps to the top while invisible), then fades back in.
  let switching = null;
  function switchView(name) {
    if (name === currentView) { lenis ? lenis.scrollTo(0) : window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (!window.gsap || reduced) return showView(name);
    markTab(name);
    const outgoing = [$(`[data-view="${currentView}"]`), $(".footer")];
    if (switching) switching.kill();
    switching = gsap.to(outgoing, {
      opacity: 0, y: 8, duration: .18, ease: "power2.in",
      onComplete: () => {
        gsap.set(outgoing, { clearProps: "opacity,transform" });
        showView(name);
        switching = gsap.fromTo([$(`[data-view="${name}"]`), $(".footer")],
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: .4, ease: "power3.out", clearProps: "opacity,transform" });
      }
    });
  }
  function route({ animate = false } = {}) {
    const h = location.hash.slice(1);
    const name = TITLES[h] && h !== "home" ? h : "home";
    animate ? switchView(name) : showView(name, { scroll: name !== "home" });
    const target = name === "home" && h && h !== "home" && document.getElementById(h);
    if (target) setTimeout(() => goTo(target), animate ? 650 : 50);
  }
  $$("[data-go]").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    const name = a.dataset.go;
    if (name !== currentView) history.pushState(null, "", name === "home" ? location.pathname + location.search : "#" + name);
    switchView(name);
  }));
  addEventListener("popstate", () => route({ animate: true }));
  markTab(currentView, false);

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
    // From the Library, fade back to Home first, then glide to the section.
    if ($("#top").hidden && $("#top").contains(target)) {
      history.pushState(null, "", location.pathname + location.search);
      switchView("home");
      return setTimeout(() => goTo(target), window.gsap && !reduced ? 650 : 0);
    }
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
  if (!window.gsap || !window.ScrollTrigger || reduced) { route(); return; }
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

  /* ---------- Sections fade + slide in ---------- */
  $$("[data-fade]").forEach(el => {
    gsap.from(el, {
      y: 24, opacity: 0, duration: 1, ease: "expo.out", clearProps: "transform,opacity",
      scrollTrigger: { trigger: el, start: "top 92%" }
    });
  });

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

  route();
  addEventListener("load", () => ScrollTrigger.refresh());
})();

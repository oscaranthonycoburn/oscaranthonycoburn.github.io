/* YouTube IFrame API loader + a "clean" player (no YouTube buttons, titles or end screens;
   the record and its buttons are the controls). */
window.OCYT = (function () {
  let apiPromise = null;

  function load() {
    if (apiPromise) return apiPromise;
    return (apiPromise = new Promise(resolve => {
      if (window.YT && YT.Player) return resolve();
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev && prev(); resolve(); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.append(s);
    }));
  }

  // Captions are always off: YouTube can switch them on by itself (from the viewer's settings or
  // the video's own default), so besides asking for no captions, the captions module is unloaded
  // whenever a video starts.
  function noCaptions(p) {
    try { p.unloadModule && (p.unloadModule("captions"), p.unloadModule("cc")); } catch (_) {}
  }
  function create(el, videoId, events) {
    const ev = Object.assign({}, events);
    ev.onReady = e => { noCaptions(e.target); events.onReady && events.onReady(e); };
    ev.onStateChange = e => {
      if (e.data === 1 || e.data === 3) noCaptions(e.target);   // playing / loading
      events.onStateChange && events.onStateChange(e);
    };
    return new YT.Player(el, {
      host: "https://www.youtube-nocookie.com",
      videoId,
      width: "100%", height: "100%",
      playerVars: {
        controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
        modestbranding: 1, playsinline: 1, rel: 0,
        cc_load_policy: 0, cc_lang_pref: "none"
      },
      events: ev
    });
  }

  return { load, create, PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3 };
})();

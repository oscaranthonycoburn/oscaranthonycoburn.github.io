/* Shared YouTube helpers for both players (tracklist + record deck).
   Browsers only allow autoplay WITH sound after the visitor has interacted with the page.
   So: try to play with sound; if the browser blocks it, play muted and show a
   "Tap for sound" button over the video. */
window.OCYT = (function () {
  const PLAYING = 1, BUFFERING = 3;
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

  function create(el, videoId, events) {
    return new YT.Player(el, {
      host: "https://www.youtube-nocookie.com",
      videoId,
      width: "100%", height: "100%",
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events
    });
  }

  // Start playback; fall back to muted if sound is blocked.
  function play(player, pill, { muted = false } = {}) {
    if (muted) player.mute(); else player.unMute();
    player.playVideo();
    if (muted) { showPill(pill, true); return; }
    showPill(pill, false);
    setTimeout(() => {
      const st = player.getPlayerState && player.getPlayerState();
      if (st !== PLAYING && st !== BUFFERING) {
        player.mute();
        player.playVideo();
        showPill(pill, true);
      }
    }, 1200);
  }

  function showPill(pill, on) { if (pill) pill.hidden = !on; }

  // Wire a "Tap for sound" button to a player getter.
  function wirePill(pill, getPlayer) {
    if (!pill) return;
    pill.addEventListener("click", () => {
      const p = getPlayer();
      if (!p) return;
      p.unMute();
      p.setVolume(100);
      if (p.getPlayerState() !== PLAYING) p.playVideo();
      showPill(pill, false);
    });
  }

  return { load, create, play, wirePill, showPill, PLAYING, BUFFERING };
})();

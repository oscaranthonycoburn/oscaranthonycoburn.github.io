/* Shared YouTube helpers for both players (tracklist + record deck).
   Browsers only allow sound after the visitor's first tap/click/keypress on the page.
   So: try to play with sound; if that's blocked, play muted and turn the sound on
   automatically at the visitor's first interaction anywhere on the page. */
window.OCYT = (function () {
  const PLAYING = 1, BUFFERING = 3;
  let apiPromise = null;
  const waitingForSound = new Set();   // players playing muted until the first interaction
  let interacted = false;

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

  function soundOn(player) {
    player.unMute();
    player.setVolume(100);
    waitingForSound.delete(player);
  }

  // Start playback. With `muted`, or if the browser blocks sound, play muted and
  // switch the sound on at the first interaction.
  function play(player, { muted = false } = {}) {
    if (muted && !interacted) {
      player.mute();
      player.playVideo();
      waitingForSound.add(player);
      return;
    }
    soundOn(player);
    player.playVideo();
    setTimeout(() => {
      const st = player.getPlayerState && player.getPlayerState();
      if (st !== PLAYING && st !== BUFFERING) {
        player.mute();
        player.playVideo();
        waitingForSound.add(player);
      }
    }, 1200);
  }

  // The visitor's first real interaction unlocks sound for every waiting player.
  function onFirstInteraction(e) {
    interacted = true;
    waitingForSound.forEach(p => {
      soundOn(p);
      if (p.getPlayerState() !== PLAYING) p.playVideo();
    });
    listeners.forEach(fn => fn(e));
  }
  const listeners = [];
  // Only a real tap/click/keypress counts (a scroll or swipe doesn't unlock sound).
  const UNLOCK = ["pointerup", "touchend", "click", "keydown"];
  function tryUnlock(e) {
    if (interacted) return;
    const active = navigator.userActivation ? navigator.userActivation.isActive : true;
    if (!active) return;
    UNLOCK.forEach(t => document.removeEventListener(t, tryUnlock, true));
    onFirstInteraction(e);
  }
  UNLOCK.forEach(t => document.addEventListener(t, tryUnlock, true));

  return {
    load, create, play, soundOn,
    onFirstInteraction: fn => listeners.push(fn),
    hasInteracted: () => interacted,
    PLAYING, BUFFERING
  };
})();

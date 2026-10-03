/* ==========================================================================
   SITE CONTENT — edit everything here.
   ========================================================================== */
window.SITE = {
  artist: "Oscar A. Coburn",
  credit: "Oscar A. Coburn",
  title: "I Ain't Perfect",
  format: "EP",
  released: "October 2, 2026",
  runtime: "16:12",

  cover: "assets/cover.jpg",

  // Pulled from the cover art. Drives the CSS theme and the animated background.
  palette: {
    bg:     "#0b0806",
    brown:  "#2a1810",
    orange: "#c4622d",
    amber:  "#e0a35c",
    cream:  "#efe2c9",
    red:    "#d42a2a"
  },

  links: {
    youtube:   "https://www.youtube.com/@OscarAnthonyCoburn?sub_confirmation=1",
    tiktok:    "https://www.tiktok.com/@oscaranthonycoburn",
    instagram: "https://www.instagram.com/oscar_c0burn/",
    playlist:  "https://www.youtube.com/playlist?list=PLdRANicuQT_E",
    // TODO: swap for the exact album link (Spotify → ••• → Share → Copy link to album).
    spotify:   "https://open.spotify.com/search/Oscar%20Coburn%20I%20Ain%27t%20Perfect",
    // TODO: swap for the exact album link (Apple Music → ••• → Share → Copy Link).
    appleMusic: "https://music.apple.com/us/search?term=Oscar%20Coburn%20I%20Ain%27t%20Perfect"
  },

  // Library page: every release, newest first. Empty "+" slots fill the rest of the grid
  // (at least `librarySlots`, rounded up to a full row of 3). To add an album, copy the
  // entry below, change it, and drop its cover in assets/.
  library: [
    { title: "I Ain't Perfect", type: "EP", year: "2026", songs: 5, cover: "assets/cover.jpg",
      spotify: "", appleMusic: "" }   // leave "" to use links.spotify / links.appleMusic, or paste this album's own links
  ],
  librarySlots: 6,

  // `audio` = the song file the site plays in the background (put files in assets/audio/).
  // `id` = the YouTube video, used for the "Watch on YouTube" link.
  tracks: [
    { title: "Subhuman Nature", length: "4:57", audio: "assets/audio/01-subhuman-nature.mp3", id: "himYSGRDR0Q" },
    { title: "Dreams",          length: "2:41", audio: "assets/audio/02-dreams.mp3",          id: "V9bUHai0z0o" },
    { title: "Time",            length: "3:28", audio: "assets/audio/03-time.mp3",            id: "cyxLA8L8PJk" },
    { title: "Everything I Do", length: "1:42", audio: "assets/audio/04-everything-i-do.mp3", id: "pvbWNwAZExY" },
    { title: "I Ain't Perfect", length: "3:24", audio: "assets/audio/05-i-aint-perfect.mp3",  id: "Z86v2BupQ64", titleTrack: true }
  ],

  // "Meet Oscar" section
  roles: ["Musician", "Singer", "Songwriter", "Guitar player"],
  bio: [
    "[Artist bio coming soon. Oscar to provide.]"
  ],

  bioQuote: "Up and coming musician, singer, songwriter, and guitar player",

  // Final public URL. Keep in sync with the og:/twitter: tags in index.html.
  siteUrl: "https://oscaranthonycoburn.github.io/"
};

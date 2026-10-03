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
    spotify:    "https://open.spotify.com/album/3oG4AVbBcS29V9o9uxxFZU",
    appleMusic: "https://music.apple.com/us/album/i-aint-perfect-ep/6815467920"
  },

  // Library page: every release, newest first. Empty "+" slots fill the rest of the grid
  // (at least `librarySlots`, rounded up to a full row of 3). To add an album, copy the
  // entry below, change it, and drop its cover in assets/.
  library: [
    { title: "I Ain't Perfect", type: "EP", year: "2026", songs: 5, cover: "assets/cover.jpg",
      spotify: "", appleMusic: "" }   // leave "" to use links.spotify / links.appleMusic, or paste this album's own links
  ],
  librarySlots: 6,

  // News board sections. `key` sets the tag color (see .tag-* in css/style.css).
  // Posts themselves live in content/news.json.
  newsCategories: [
    { key: "release",      name: "Releases" },
    { key: "show",         name: "Shows" },
    { key: "video",        name: "Videos" },
    { key: "announcement", name: "Announcements" },
    { key: "bts",          name: "Behind the Scenes" }
  ],

  // Background music: loops forever behind the whole site. Fades out while a song video
  // plays and back in when it's paused. `seconds` = the original file length (keeps the loop seamless).
  background: { src: "assets/audio/background.m4a", seconds: 126.526, volume: 0.6 },

  // Songs (YouTube video IDs) played on the record.
  tracks: [
    { title: "Subhuman Nature", length: "4:57", id: "himYSGRDR0Q" },
    { title: "Dreams",          length: "2:41", id: "V9bUHai0z0o" },
    { title: "Time",            length: "3:28", id: "cyxLA8L8PJk" },
    { title: "Everything I Do", length: "1:42", id: "pvbWNwAZExY" },
    { title: "I Ain't Perfect", length: "3:24", id: "Z86v2BupQ64", titleTrack: true }
  ],

  // "Ask Oscar" contact form. The address is split so it never appears whole in the page
  // (keeps it away from spam bots). The Web3Forms key below sends messages straight to
  // Oscar's inbox; if it's ever removed, the form opens the visitor's email app instead.
  contact: {
    user: "oscarmusic1398",
    domain: "gmail.com",
    web3formsKey: "81368677-1fc7-4971-af92-52e3f4483a38",   // Web3Forms access key (public by design; delivers to Oscar)
    topics: ["General question", "The music", "Shows & booking", "Collaboration", "Press"]
  },

  // "Meet Oscar" section
  roles: ["Musician", "Singer", "Songwriter", "Guitar player"],
  bio: [
    "Oscar A. Coburn is an Arizona-born singer, songwriter, and musician who has been obsessed with music from a young age. He started playing guitar and singing as a kid, and quickly fell in love with writing, recording, and creating his own music.",
    "Inspired by artists such as Zach Bryan, Red Hot Chili Peppers, The Lumineers, and the people and experiences that have shaped his life, Oscar brings his own stories and emotions into everything he creates. As an independent artist, he writes, records, and produces his own music, every song is raw emotion all in one take. Oscar has just released his debut EP, I Ain’t Perfect, available now on all major streaming platforms."
  ],

  bioQuote: "Up and coming musician, singer, songwriter, and guitar player",

  // Final public URL. Keep in sync with the og:/twitter: tags in index.html.
  siteUrl: "https://oscaranthonycoburn.github.io/"
};

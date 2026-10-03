# I Ain't Perfect · Oscar A. Coburn

Promo site for Oscar A. Coburn's debut EP (released October 2, 2026). It's plain HTML/CSS/JS. GSAP + ScrollTrigger and Lenis load from CDNs, so there's no build step.

## Assets
- `assets/cover.jpg`: the EP cover (1215×1286, trimmed from the supplied art). Used in the hero, the record sleeve and the vinyl label. The art itself reads "Oscar M. Coburn"; all site text uses "Oscar A. Coburn".
- `assets/og-image.jpg`: the 1200×630 social preview (cover + title).
- `assets/favicon.png` and `assets/apple-touch-icon.png`: square crops of the cover.

If you get a higher-resolution cover, replace `cover.jpg` and update the `aspect-ratio` on `.cover-wrap` in `css/style.css` to match.

## Before deploying
- Add Oscar's bio to `bio` in `js/data.js` (one string per paragraph). It shows in the "Meet Oscar" section.

All content (tracks, links, colors, bio) lives in `js/data.js`.

## Music
- **Background music** (`js/bg.js`): `assets/audio/background.m4a` loops forever behind the whole site (gapless, via the Web Audio API). It starts on page load when the browser allows it, otherwise at the visitor's first tap or click. It pauses while the tab is in the background. Settings are in `background` in `js/data.js` (file, exact length in seconds, volume).
- **Songs** play as YouTube videos on the record (`js/deck.js`, `js/yt.js`). Turning the record or tapping a song in the tracklist plays that video. When a video ends, the record turns to the next song. YouTube's own controls are hidden; the record, the video and the Play/Prev/Next buttons are the controls.
- When a song starts, the background music fades out in ~0.35s and actually pauses (keeping its place). When the song is paused, it resumes from the same spot and fades back in. This happens the moment the visitor starts or pauses a song, not when YouTube reports back.

To replace the background track: convert it with `afconvert -f m4af -d aac -b 192000 in.wav assets/audio/background.m4a` and update `background.seconds`.

## Pages
Home and Library are both in `index.html`, so switching between them never stops the music. `#library` opens the Library; `library.html` just redirects there for old links.
- To add an album, copy the entry in `library` in `js/data.js`, change it, and put its cover in `assets/`. Empty "+" slots fill the rest (at least `librarySlots`, rounded up to a full row of 3).
- Clicking an album (hero cover or Library) opens a "Listen on" chooser with Spotify and Apple Music. `links.spotify` and `links.appleMusic` in `js/data.js` are the defaults (also used by the hero buttons and Follow cards); a library entry can set its own `spotify` / `appleMusic`.

## News board
The News tab (`#news`) is laid out like a newspaper front page: a dateline, section tabs to filter by category, the top story as a big headline, and the rest in ruled columns. Posts live in `content/news.json`, pinned first, then newest first. Each post has `title`, `category` (Releases, Shows, Videos, Announcements or Behind the Scenes, set in `newsCategories` in `js/data.js`), `date` (YYYY-MM-DD), `body` (blank line between paragraphs), and optional `image`, `link`, `linkLabel`, `pinned`, `hideAfter` (YYYY-MM-DD: the post disappears after that date). A post stays up until it's deleted from the file or its `hideAfter` date passes.

**Who can post:** only people with write access to this GitHub repo (members of the `oscaranthonycoburn` org). Two ways to post:
1. **Pages CMS (easiest):** sign in at https://app.pagescms.org with GitHub, open this repo, choose "News board", add/edit/delete posts with a form, and save. Configured in `.pages.yml`; uploaded images go to `assets/news/`.
2. **GitHub directly:** edit `content/news.json` on github.com and commit.

Either way the live site updates about a minute after saving.

## Deploy
Hosted free on GitHub Pages from the `oscaranthonycoburn/oscaranthonycoburn.github.io` repo (branch `main`, root), live at https://oscaranthonycoburn.github.io/. Pushing to `main` republishes in about a minute.

If the address changes (e.g. a custom domain), update `og:url`, `og:image` and `twitter:image` in `index.html` and `siteUrl` in `js/data.js`. Social previews need absolute URLs.

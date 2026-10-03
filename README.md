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
The site plays the EP as background music (`js/audio.js`). It tries to start on page load and otherwise starts at the visitor's first tap or click (browsers block sound before that). The record deck, tracklist and the now-playing bar all control it, and it plays through the EP and loops.

Song files go in `assets/audio/` with the names set in `tracks[].audio` in `js/data.js` (MP3 or M4A).

## Pages
Home and Library are both in `index.html`, so switching between them never stops the music. `#library` opens the Library; `library.html` just redirects there for old links.
- To add an album, copy the entry in `library` in `js/data.js`, change it, and put its cover in `assets/`. Empty "+" slots fill the rest (at least `librarySlots`, rounded up to a full row of 3).
- Clicking an album (hero cover or Library) opens a "Listen on" chooser with Spotify and Apple Music. `links.spotify` and `links.appleMusic` in `js/data.js` are the defaults (also used by the hero buttons and Follow cards); a library entry can set its own `spotify` / `appleMusic`. Both are currently search links; replace them with the exact album links.

## Deploy
Hosted free on GitHub Pages from the `oscaranthonycoburn/oscaranthonycoburn.github.io` repo (branch `main`, root), live at https://oscaranthonycoburn.github.io/. Pushing to `main` republishes in about a minute.

If the address changes (e.g. a custom domain), update `og:url`, `og:image` and `twitter:image` in `index.html` and `siteUrl` in `js/data.js`. Social previews need absolute URLs.

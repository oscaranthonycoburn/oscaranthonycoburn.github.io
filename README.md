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

## Pages
- `index.html`: Home (the EP page).
- `library.html`: Library, a grid of releases. To add an album, copy the entry in `library` in `js/data.js`, change it, and put its cover in `assets/`. Empty "+" slots fill the rest (at least `librarySlots`, rounded up to a full row of 3).
- `links.spotify` in `js/data.js` is used by the library album, the hero cover, the hero Spotify button and the Follow card. It's currently a Spotify search; replace it with the exact album link.

`js/deck.js` runs the record in the About section. Dragging it about 72° moves one song (5 songs = one full turn). It plays through the YouTube IFrame API, and only one player (deck or tracklist) plays at a time.

## Deploy
Hosted free on GitHub Pages from the `oscaranthonycoburn/oscaranthonycoburn.github.io` repo (branch `main`, root), live at https://oscaranthonycoburn.github.io/. Pushing to `main` republishes in about a minute.

If the address changes (e.g. a custom domain), update `og:url`, `og:image` and `twitter:image` in `index.html` and `siteUrl` in `js/data.js`. Social previews need absolute URLs.

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

`js/deck.js` runs the record in the About section. Dragging it about 72° moves one song (5 songs = one full turn). It plays through the YouTube IFrame API, and only one player (deck or tracklist) plays at a time.

## Deploy to GitHub Pages
1. Push this folder's contents to a repo named `oscar-coburn-site`.
2. Go to **Settings → Pages → Deploy from branch → `main` / root**.
3. The site goes live at `https://<username>.github.io/oscar-coburn-site/`.

If the URL is different, update `og:url`, `og:image` and `twitter:image` in `index.html` and `siteUrl` in `js/data.js`. Social previews need absolute URLs.

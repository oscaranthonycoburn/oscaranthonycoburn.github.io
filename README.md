# I Ain't Perfect · Oscar A. Coburn

Promo site for Oscar A. Coburn's debut EP (released October 2, 2026). It's plain HTML/CSS/JS. GSAP + ScrollTrigger and Lenis load from CDNs, so there's no build step.

## Assets
- `assets/cover.jpg`: the EP cover (1003×1062, trimmed from the supplied art; reads "Oscar A. Coburn"). Used in the hero, the record sleeve, the vinyl label, the Library and the "Listen on" chooser.
- `assets/og-image.jpg`: the 1200×630 social preview (cover + title).
- `assets/favicon.png` and `assets/apple-touch-icon.png`: square crops of the cover.

If you get a higher-resolution cover, replace `cover.jpg` and update the `aspect-ratio` on `.cover-wrap` in `css/style.css` to match.

All content (tracks, links, colors, bio) lives in `js/data.js`. The "Meet Oscar" bio is `bio` there, one string per paragraph.

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

## Breaking-news alarm
When a new News post goes live, everyone on the site gets sirens (several different ones, synthesized in `js/alarm.js`) plus red police-light beams and a "Breaking news" banner, until 30 seconds after the post went live. Then it's gone for good.
- Open pages check `content/news.json` every 8 seconds; a post that wasn't there before triggers it. Someone opening the site fresh gets it if the newest post's date/time is within 5 minutes before the file went live. Timing uses GitHub's Last-Modified and Date headers, so it ends at the same moment for everyone.
- Post times come from the "Date & time posted" field in Pages CMS, written in Arizona time (`alarm.timezone`).
- Browsers allow sound only after the visitor has clicked/tapped the page; otherwise the sirens start at their first tap. Volume tops out at the visitor's device volume.
- Flash safety: the glow pulses ~2×/s and the beams rotate rather than strobe (under the 3 flashes/s seizure limit); "Reduce motion" users get a still red screen. Visitors can hit Silence.
- It only fires for real new posts. Turn it off with `alarm.enabled: false` in `js/data.js`.

## Ask Oscar (contact form)
The "Ask Oscar" section on Home (`#contact`) lets anyone send Oscar a message. His address is stored split up in `contact` in `js/data.js`, so it never appears whole in the page (keeps spam bots away).
- **With a Web3Forms key** (free, https://web3forms.com): messages are emailed straight to Oscar, with the visitor's address as reply-to, so he just hits Reply. Paste the key into `contact.web3formsKey`.
- **Without a key:** the form opens the visitor's own email app with the message filled in.
- Edit the topic list in `contact.topics`.

## Search (Google)
- `index.html` has schema.org structured data (artist, the EP and its 5 tracks, streaming/social links) in a `<script type="application/ld+json">` block, plus a canonical link. Keep it in sync with `js/data.js` when releases change.
- `sitemap.xml` lists the site; `robots.txt` points to it. Update `<lastmod>` in the sitemap after big changes.
- Google Search Console: property `https://oscaranthonycoburn.github.io/` (URL-prefix), verified with an HTML meta tag in `index.html`; sitemap submitted there.

## Deploy
Hosted free on GitHub Pages from the `oscaranthonycoburn/oscaranthonycoburn.github.io` repo (branch `main`, root), live at https://oscaranthonycoburn.github.io/. Pushing to `main` republishes in about a minute.

If the address changes (e.g. a custom domain), update `og:url`, `og:image` and `twitter:image` in `index.html` and `siteUrl` in `js/data.js`. Social previews need absolute URLs.

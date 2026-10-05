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

## Videos (VHS room)
The Videos tab (`#videos`) is only a photo of a retro room (`assets/vhs/room.webp`: wood TV on a VCR, poster, record, string lights) filling the screen. There's no text and no footer on this tab. Phones held upright get their own tall photo (`assets/vhs/room-tall.webp`, 971×1619: the same TV and VCR on a table, with a guitar); computers and sideways phones get the wide one. Each photo has its own measurements in `css/style.css` (the `--ar`, `--fit`, `--cy` and `--bz-*` settings on `.vhs-stage`, plus the glass, clock and clickable-TV positions), and `js/videos.js` reads the bezel from them, so the zoom lines up on both. On phones the photo is sized so the whole TV and VCR fit across the screen (`--fit` in `.vhs-room`, `css/style.css`: the share of the photo's width that shows; .5 = TV and VCR edge to edge, bigger = more wall); on a tall screen the wall continues above it and the desk below it (mirrored, blurred copies of the photo). The TV glass (faint static) and the VCR clock are live pieces laid over the photo.
- Only the TV itself is clickable (not the room or the VCR). Tapping it zooms in on the TV. The border (`assets/vhs/frame.webp`, the same bezel cut out) is kept glued to the photo's black bezel the whole way, fades in on top of it, and then the rest of the room slowly fades into the site's moving background, so the TV turns into the border. Going back does the same in reverse.
- Inside is a grainy gray menu listing the video titles, with little arrows (arrow keys work too; a long list scrolls). Pick one: the screen flickers and that video plays, with nothing on top of it. It's a fishbowl screen: the picture just fills it corner to corner (the sides run under the border like a real CRT's overscan), with curved-glass shading. Static only shows on the menu; the moment a video is picked, the picture shows. (YouTube briefly puts its own round button over a video when it starts; it can't be switched off. Uploaded files never show it.) The screen sits behind the border, so nothing pokes past it.
- The green VCR readout above the border (top right) pauses and plays. The arrow (top left) goes back: video → menu → room (Esc does the same). When a video ends it returns to the menu.
- Background music stops while a video plays (it also stops a song on the record) and fades back in when you go back to the menu. The music is held off separately by the record, the TV and the news alarm (`duck(who)` / `unduck(who)` in `js/bg.js`), so one of them stopping can't bring it back while another is still playing. Leaving the tab pauses the video.
- **Adding a video (like posting News):** the list lives in `content/videos.json`. Easiest is Pages CMS: sign in at https://app.pagescms.org, open this repo, choose **Videos (TV)**, add an entry with a **Title** (shown on the TV menu; about 20 characters fits) and either the **YouTube link** (any kind: youtu.be, youtube.com/watch, Shorts) or an uploaded **video file**, drag to reorder, and save. The live site updates about a minute later; anyone already on the page gets the new list the next time they turn the TV on. A link that isn't a YouTube video is skipped.
- **Video files** (instead of YouTube): upload an MP4 in the entry's "…or a video file" field. It goes into `assets/videos/` and plays in a plain video player, so no YouTube buttons or static ever show. If both a file and a link are filled in, the file wins. Keep files small: under 25 MB each (720p is plenty for the TV). GitHub blocks files over 100 MB and the whole site should stay under 1 GB, so for long or high-quality videos YouTube is still the better home. A missing or broken file just returns to the menu.
- **Secret codes:** tap/click the green 12:00 on the VCR and it clears to `__:__` (phones get the number keypad). Typing a 4-digit code that matches one in Pages CMS → Videos (TV) → **Secret codes** zooms straight into the TV with that code's photo or video already on screen (skipping the menu); a wrong code shows ERR and lets you try again. Each code has a photo, a YouTube link or a video file; uploads go to `assets/secret/`. The codes sit in `content/videos.json`, so anyone who digs through the site's files can find them: a fun Easter egg, not a lock. Photos show whole, with a blurred copy filling the TV's corners.
- **Fit on the TV** (per video): every video is fitted automatically. **Auto** (the default) finds the real picture, using the YouTube thumbnail or the uploaded file's own frames, so black bars built into a video and square or vertical videos are handled. It then fills the TV corner to corner, cutting off only what it has to. If filling would cut off more than 40% (vertical videos like Shorts, very wide ones), it shows the whole picture instead. **Whole picture** always shows all of it, with black around it. A **Zoom** number overrides both (1 = the video's frame just fills the TV). Code: "Fitting the picture to the screen" in `js/videos.js`.
- If either image is replaced, re-measure: the photo's black bezel (`BEZEL` in `js/videos.js`, in photo pixels), the TV glass and the clickable TV (`.vhs-glass`, `.vhs-on`), and the border image's bezel edges (the `.vhs-bezel` offsets and the `.vhs-frame` aspect ratio in `css/style.css`).

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
- Google Search Console: verify the whole domain `oscarcoburnmusic.com` with a DNS TXT record in Cloudflare, then submit `sitemap.xml`.

## Deploy
`index.html` loads the CSS and JS with a version tag (`?v=20261004g`). GitHub Pages lets browsers keep files for 10 minutes, so change that tag (all of them, same value) whenever CSS/JS changes and phones will fetch the new files right away.

Hosted free on GitHub Pages from the `oscaranthonycoburn/oscaranthonycoburn.github.io` repo (branch `main`, root), live at **https://oscarcoburnmusic.com/** (set by the `CNAME` file). The old https://oscaranthonycoburn.github.io/ address forwards there. Pushing to `main` republishes in about a minute.

DNS is on Cloudflare (DNS only, not proxied): four `A` records for `@` pointing to GitHub Pages (185.199.108.153, .109.153, .110.153, .111.153) and `www` as a `CNAME` to `oscaranthonycoburn.github.io`.

If the address changes (e.g. a custom domain), update `og:url`, `og:image` and `twitter:image` in `index.html` and `siteUrl` in `js/data.js`. Social previews need absolute URLs.

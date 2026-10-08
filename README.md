# Wordlands website

Everything in this folder is the public website **https://emrehalamannnn.github.io**: a GitHub Pages user site
(repository `Emrehalamannnn/Emrehalamannnn.github.io`, published from the root of its default branch). The folder
is the whole repository: copy its contents, hidden files too, to the top of that repository.

It has no server code, no cookies, no analytics, no external fonts and no scripts from other sites. Every page
carries a strict content security policy in a `<meta>` tag (GitHub Pages can't set headers).

| Path | What it is |
| --- | --- |
| `index.html` | The home page: what Wordlands is, the App Store button, links to Privacy and Support |
| `privacy/index.html` | The privacy policy, `https://emrehalamannnn.github.io/privacy/` (the app's `AppConfig.privacyURL`). Made from `docs/PRIVACY.md`: change both together |
| `support/index.html` | Support: the email address and the common questions, `https://emrehalamannnn.github.io/support/` (the App Store Support URL) |
| `site.css` | The look of those three pages, light and dark, from the app's colours |
| `r/index.html` | A shared score, `https://emrehalamannnn.github.io/r#…`: "Gloria · Español · Day 412 · 256/300", an **Open in Wordlands** button (`wordlands://r?` + the same data), the App Store button, and what to do without the app |
| `j/index.html` | An invite, `…/j#…`: "Join Doğan ailesi (Hüseyin invited you)", **Open in Wordlands** (`wordlands://j?…`), the same buttons and notes |
| `link.js` | Reads and checks the score or invite after the `#` exactly as the app does (`ios/Wordlands/League/ResultLink.swift`, `Core/NameRule.swift`): the same limits and the same check (SHA-256 with the browser's SubtleCrypto). A link that fails says "This link looks broken or edited". The iOS unit tests (`LeagueTests`, "The link pages (site/link.js) …") run this file's `cleanName` against the app's `NameRule`. Texts in English, Spanish, Portuguese, German, French and Turkish, picked from the browser's language |
| `link.css` | The look of the two link pages |
| `.well-known/apple-app-site-association` | Tells iOS that `/r` and `/j` links open the app (team `K2RM3C7JU4`, bundle `app.wordlands.Wordlands`). No file extension, JSON inside |
| `.well-known/assetlinks.json` | Tells Android that `/r` and `/j` links open the Android app (package `app.wordlands`). **The fingerprint is a placeholder**, see below |
| `.nojekyll` | Empty. Without it GitHub Pages runs Jekyll, which leaves out `.well-known` |

The data after the `#` never reaches the server: browsers don't send it, and `link.js` reads it on the visitor's own
device. The privacy policy (section 8) says the site uses no cookies and no analytics. Keep it so.

## Before publishing

- **App Store button:** once Wordlands is live, set `APP_STORE_ID = "6820438663"` at the top of `link.js` and
  change the button in `index.html` to `https://apps.apple.com/app/id6820438663`. Until then both open a search for
  "Wordlands" (an app page that isn't live yet shows an error).
- **Android:** in `.well-known/assetlinks.json`, replace `OWNER_REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT`
  with the SHA-256 fingerprint of the app signing key (Play Console > Wordlands > Test and release > App integrity >
  App signing; `AB:CD:…`, 32 pairs). Until then Android opens these links in the browser (the page's **Open in
  Wordlands** button still works). Details: `android/config/README.md`. When Wordlands for Android is public, set
  `PLAY_STORE_LIVE = true` in `link.js` and change the `<noscript>` line in `r/index.html` and `j/index.html`.
- If the team id or the bundle id ever change, change them in `.well-known/apple-app-site-association` too.

## Publish (GitHub Pages)

1. Create the public repository `Emrehalamannnn.github.io` on the `Emrehalamannnn` account.
2. Copy the **contents** of this folder to its top level (with `.nojekyll` and `.well-known/`), commit and push to
   `main`. Settings > Pages: "Deploy from a branch", `main`, `/ (root)`.
3. Check:
   - `curl -sI https://emrehalamannnn.github.io/.well-known/apple-app-site-association` gives status 200 with no
     redirect. GitHub Pages serves this extension-less file as `application/octet-stream`; Apple's CDN accepts it.
     Apple's CDN may take up to a day: `curl -s https://app-site-association.cdn-apple.com/a/v1/emrehalamannnn.github.io`.
   - `curl -s https://emrehalamannnn.github.io/.well-known/assetlinks.json`.
   - The privacy and support pages open, in light and dark mode, on a phone.
4. Install a build with the Associated Domains entitlement `applinks:emrehalamannnn.github.io`
   (`ios/Wordlands/Wordlands.entitlements`), send yourself a score in Messages and tap it: the app should open. Then
   set `AppConfig.linksOpenApp = true` in `ios/Wordlands/Shared/AppConfig.swift`, so shared texts stop adding the
   "Can't open the link? Copy this whole message…" line.

## Try it on this Mac

```bash
cd site
python3 -m http.server 8000
```

Then open <http://localhost:8000/>, <http://localhost:8000/privacy/>, <http://localhost:8000/support/> and, for
example:

- <http://localhost:8000/r/#v=1&p=k3m9q2xa&n=Gloria&l=es&d=6&s=92,80,84&t=4&m=432&c=4e0d> (a score may be for
  any day from day 1 up to tomorrow, so this one keeps working)
- <http://localhost:8000/j/#v=1&g=K7Q2M9&gn=Do%C4%9Fan%20ailesi&p=h7s2y9na&n=H%C3%BCseyin&c=6cdc>

Change any value (say `92` to `93`) and the page says the link looks broken or edited. Stop the server with Ctrl-C.

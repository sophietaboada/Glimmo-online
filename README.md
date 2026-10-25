# SET

The card game SET, playable in any browser and installable on iPhone as a home-screen app.
Plain HTML/CSS/JavaScript — no build step, no dependencies.

## Play locally

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. To try it on your phone, open `http://<your-computer's-LAN-IP>:8000`
while on the same Wi-Fi (offline support needs HTTPS, so that only works once deployed).

## Put it online

Any static host works. For example with GitHub Pages: push this repo to GitHub, then
*Settings → Pages → Deploy from branch* and pick the branch and `/ (root)`.

After deploying a change, bump `VERSION` in `sw.js` so installed copies update.

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share** → **Add to Home Screen**.

It then launches full-screen with its own icon and works offline.

## Files

| File | Purpose |
| --- | --- |
| `game.js` | Game rules and state (deck, board, set detection) — no DOM code |
| `app.js` | Renders cards and handles taps, hints, timer, game over |
| `style.css` | Layout: 3 columns on phones, 3 rows on wide screens |
| `sw.js`, `manifest.webmanifest` | Offline support and home-screen install |
| `tools/make_icons.py` | Regenerates `icons/*.png` |
| `tests/game.test.mjs` | Logic tests: `node --test tests/` |

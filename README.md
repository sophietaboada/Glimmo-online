# SET

The card game SET, playable in any browser and installable on iPhone as a home-screen app.
Play alone, or as a group with everyone on their own phone.

**Play:** <https://seton-game.sophie-taboada.workers.dev>

## Group game

One person taps **Create a room** and the others join with the 4-letter room code (or the **Invite** link).
Everyone sees the same cards. When you spot a set, tap **SET!**: if you were first, you have 10 seconds
to pick the three cards. Right is +1; wrong or out of time is −1 and you sit out until someone finds a set.

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share** → **Add to Home Screen**.

It then launches full-screen with its own icon. Solo play works offline; group games need a connection.

## Develop

Requires Node.js.

```sh
npm install
npm run dev      # http://localhost:8787, including group games
npm test         # game logic tests
ROOM_URL=ws://127.0.0.1:8787 npm test   # also play a full group game against the dev server
```

## Hosting

Cloudflare Workers (project `seton-game`) is connected to this GitHub repo: every push to `master`
deploys automatically. After changing files in `public/`, bump `VERSION` in `public/sw.js` so
installed copies pick up the update.

Each group game runs in a Cloudflare Durable Object (`Room`). Player names and scores live only in
its memory while people are playing; nothing is written to storage.

## Files

| File | Purpose |
| --- | --- |
| `public/game.js` | Game rules and state (deck, board, set detection), shared by phones and server |
| `public/cards.js` | Draws cards; shared helpers |
| `public/solo.js` | Solo game: taps, hints, timer |
| `public/group.js` | Group game on the phone: room connection, SET! button, scores |
| `public/app.js` | Start menu and switching between screens |
| `public/index.html`, `style.css` | Page layout: 3 columns on phones, 3 rows on wide screens |
| `public/sw.js`, `manifest.webmanifest` | Offline support and home-screen install |
| `src/worker.js` | Server: serves `public/` and runs group game rooms |
| `wrangler.jsonc` | Cloudflare configuration |
| `tools/make_icons.py` | Regenerates `public/icons/*.png` |
| `tests/` | `game.test.mjs` (rules) and `room.test.mjs` (a full group game) |

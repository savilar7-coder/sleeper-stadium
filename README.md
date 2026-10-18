# Sleeper Stadium 🏈

Turn your [Sleeper](https://sleeper.com) fantasy football league into a live pixel stadium. Every team stands on the field
facing its opponent, scores update every minute on game day, and the whole league can watch from their phones.

**What's on the field**
- 📺 **Live scores and projections** for every matchup, straight from Sleeper's public API
- 🏈 **Touchdown alerts**: a banner with the player who scored when a team jumps 4+ points
- 🔦 **Top scorer spotlight** on the week's highest scorer
- 🚽 **The ASS Bowl**: the matchup between the two worst records gets its own sign, every week
- 🪑 **Bench of shame** for whoever left the most points on the bench
- 🦓 A **referee** who throws a yellow flag at negative scores
- 📺 A **jumbotron** (standings, biggest blowout, closest game), a **trophy case** of past champions,
  a **blimp** with your own banner, cheerleaders, a tailgate, and a stadium full of fans doing the wave
- 👑 **Rosters, picks, standings, league news** and a simple **trade maker** in the menus
- Pick your team and walk the field as a little football player

## Use it

1. Find your Sleeper league ID: in the Sleeper app, **League → Settings → General → League ID** (or the long number in
   your league's web address).
2. Open the page and paste it, or link straight to `https://<your-site>/?league=<LEAGUE_ID>`.

That's it: no accounts, no keys, no server. Everything is read-only and comes from Sleeper's public API in the browser.

## Host your own copy (free)

It's a static site, so any static host works. With GitHub Pages:

1. Fork this repo.
2. **Settings → Pages → Deploy from a branch → `main` / root**.
3. Share `https://<you>.github.io/sleeper-stadium/?league=<LEAGUE_ID>` with your league.

To change the blimp's banner, edit `stadium-blimp.json`.

## Run it locally

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/?league=<LEAGUE_ID>`.

## Notes

- `sleeper-players.json` is a slimmed snapshot of Sleeper's NFL player list (name, position, team), so the page doesn't
  download Sleeper's 5 MB player file on every visit. Sleeper asks apps to fetch that list at most once a day.
- Not affiliated with Sleeper or the NFL. Team names and data belong to their owners.

## Credits

- Art: ["Ninja Adventure"](https://pixel-boy.itch.io/ninja-adventure-asset-pack) by Pixel-boy and AAA (CC0, public domain),
  plus pixel art drawn in code.
- Font: [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) (SIL Open Font License), via Google Fonts.
- Game engine: [Phaser](https://phaser.io) (MIT).

Code: MIT (see `LICENSE`).

---

**Want a custom stadium for your league?** Your own characters, banner, colors and inside jokes:
[lamaisonwebstudio.com](https://lamaisonwebstudio.com)

# Sleeper Stadium 🏈

Turn your [Sleeper](https://sleeper.com) fantasy football league into a live pixel stadium. Every team stands on the field
facing its opponent, scores update every minute on game day, and the whole league can watch from their phones.

**[▶ Try it with your league](https://stadium.lamaisonwebstudio.com/)** · free, no login, no ads ·
if you like it, a ⭐ helps a lot

[![Sleeper Stadium: a live league on one field](stadium.gif)](https://stadium.lamaisonwebstudio.com/)

**On game day**
- 📺 **Live scores every minute** for every matchup, with projections, players still to play and **win odds** on a
  tug-of-war rope (yours says **YOU 57%**)
- 🏈 **Touchdown banners** with the player who scored, a **BIG SWING** line when a game flips, and a live feed of the
  biggest plays along the bottom
- 🔥 / 🌧️ fire on the hot teams, rain on the cold ones, 🚽 the **ASS Bowl** on toilet thrones, 🪑 the **bench of shame**
- ⚠️ A lineup alert if you're starting someone on bye or an empty slot

**All week**
- 🏅 **Weekly awards**: MVP, biggest blowout, closest game, unluckiest loss, luckiest win, all in one shareable picture
- 🏆 **Table** with the league's real playoff line, **playoff odds** (2,000 simulated seasons, with how they moved since
  last week), points against, and **all-play records** that show who's actually good and who's just lucky
- 💰 A **waiver board**: the biggest FAAB bids and who lost out on them
- ⚔️ **Matchup** view slot by slot, this season's head-to-head and the **all-time rivalry** record
- 🎮 **The 2-Minute Drill**: play your matchup as a little Retro Bowl-style game, your real starters against theirs,
  playing like their real week. Share the result as a challenge link
- 📅 A short catch-up when you open it in a new week: your record, rank and playoff odds since your last visit

**Also**
- Works with **Sleeper** (type your username, it finds your leagues) and **public ESPN leagues** (paste the link)
- 📺 **TV mode** (`?tv=1`) for a TV or a stream: no buttons, the camera tours the matchups by itself
- Rosters, picks, news, a simple trade maker, past champions, and a stadium full of fans doing the wave
- Reduced-motion friendly, keyboard friendly, fast on phones

## Use it

Open **[stadium.lamaisonwebstudio.com](https://stadium.lamaisonwebstudio.com/)**, type your Sleeper username (or paste an
ESPN league link) and pick your league. Then share your league's own link in the group chat.

No accounts, no keys, no server. Everything is read-only and comes from Sleeper's (or ESPN's) public API in your browser.

## Host your own copy (free)

It's a static site, so any static host works. With GitHub Pages:

1. Fork this repo.
2. **Settings → Pages → Deploy from a branch → `main` / root**.
3. Share `https://<you>.github.io/sleeper-stadium/?league=<LEAGUE_ID>` with your league.

To change the blimp's banner, edit `stadium-blimp.json`, or add `&blimp=Your%20text` to the link (60 characters).
Mascots can go in the link too: `&looks=<roster_id>.<Look>,...` (look names are in `js/stadium-main.js`, `ALL_LOOKS`).

## Run it locally

```bash
python -m http.server 8080
```

Then open `http://localhost:8080/` and type a Sleeper username, or go straight to `http://localhost:8080/?league=<LEAGUE_ID>`.

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

**Want it set up for your league in a minute?** Your own link, your trash talk on the blimp and a mascot for every
manager: [the $5 League Pass](https://lamaisonwebstudio.com/stadium/) (you make it and see it first, pay only if you like it).

**Podcast, Discord or business?** A stadium in your brand for your whole community (logo, colors, sponsors on the
jumbotron), or any other web tool or site: built by [lamaisonwebstudio.com](https://lamaisonwebstudio.com/stadium/#custom).

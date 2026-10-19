# Card Binder

Browse every card in every set for **Pokémon** and **ONE PIECE**, in **English and Japanese**, and track the cards you own.

- Rarity badges and filters, with estimated pull odds (community data, not official)
- Release dates for each set
- Market prices: Cardmarket (Pokémon, EUR) and TCGplayer (ONE PIECE English, USD)
- PSA 10 sold prices for Pokémon via Pokémon Price Tracker (needs an API key), plus links to eBay and Mercari sold listings

## Run locally

Requires Node.js 20 or newer. No dependencies to install.

```bash
npm run dev
```

Then open http://localhost:8137.

## PSA 10 prices

Get a free key from https://www.pokemonpricetracker.com/api, then either:

- **Local:** save it in `secrets/pokemonpricetracker.key` (the `secrets/` folder is git-ignored), or
- **Vercel:** add an environment variable `PPT_API_KEY` in the project settings.

The free plan allows 100 credits a day and is for personal and hobby use only. Any revenue (ads, subscriptions, affiliate links) needs their Business plan.

## Project layout

| Path | What it is |
| --- | --- |
| `public/index.html` | The whole app (HTML, CSS, JS) |
| `public/op-sets.json` | ONE PIECE release dates and official names (JP + EN) |
| `api/img.js` | Proxies official ONE PIECE card images (the site blocks cross-site embedding) |
| `api/psa10.js` | PSA 10 price lookup; keeps the API key on the server |
| `server.js` | Local dev server that serves `public/` and runs `api/*.js` |
| `tools/scrape-op-sets.js` | Refreshes `public/op-sets.json` from the official product pages: `npm run update-op-sets` |

## Deploy

On Vercel: import this GitHub repo. No build step is needed; `public/` is served as the site and `api/*.js` become serverless functions.

## Data sources

TCGdex and pokemontcg.io (Pokémon cards), punk-records and optcgapi (ONE PIECE cards), the official ONE PIECE Card Game site (release dates), Cardmarket and TCGplayer (prices), Pokémon Price Tracker (PSA 10). Card images and names © their respective owners. This is a fan project and is not affiliated with The Pokémon Company or Bandai.

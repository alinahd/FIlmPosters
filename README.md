# Remaking Color

When a film is remade, how does its poster change? An interactive page comparing the posters of 53 original and remake film pairs: each poster as a strip of color, a poster wall, and a close-up with a poster wipe.

**Open it:** open `index.html` in a browser (it forwards to `remaking-color/film_datavis.html`).

## What's here
- `remaking-color/film_datavis.html`, `.css`, `.js`: the page (no build step, no libraries).
- `remaking-color/cw-data.js`, `strips.js`: the measurements the page uses.
- `remaking-color/build_data_cw.py`: how `cw-data.js` was built from the CSVs (reference; it expects the original project folder layout).
- `remaking-color/wikidata_genres_raw.json`: genre labels fetched from Wikidata by TMDb ID.
- `data/`: the source CSVs and the data dictionary.

## Poster images are not included
The page loads posters from a `posters/` folder next to `remaking-color/`. The images come from the Hugging Face dataset `skvarre/movie_posters-100k` (originally from TMDb), which is for class use and not for redistribution, so they are left out of this repo (`posters/` is in `.gitignore`). Without them the page shows the color strips and data but empty poster slots. To see it fully, put the images in `posters/` locally.

## Data collected from
The Hugging Face dataset `skvarre/movie_posters-100k` (poster images, originally from TMDb) and Wikidata (genres). Colors measured by the author; 53 hand-picked remake pairs.

# Valour — Landing Site

Static landing site for **Valour, the Trading Card Game**. No build step, no
dependencies to install — it's plain HTML, CSS, and JavaScript, plus Three.js
loaded from a CDN.

## Folder structure

```
valour-site/
├── index.html                 # the page (Home / Heroes / Lore / Updates in one file)
├── README.md
└── assets/
    ├── css/styles.css         # all styling
    ├── js/data.js             # cards, hero roster, screenshots (edit content here)
    ├── js/main.js             # routing, 3D card scene, gallery
    ├── cards/                 # finished hero card images (frame + name baked in)
    │   ├── ike.webp  kaida.webp  draven.webp  veer.webp  quill.webp  kael.webp
    └── screens/               # gameplay screenshots for the home page
        ├── shot_184617.webp   (Shop)  shot_184559.webp (Deck)  shot_184841.webp (Match)
```

## Run it locally

Because the browser blocks some file access when you open a file directly, run a
tiny local server instead of double-clicking `index.html`.

- **VS Code:** install the **Live Server** extension, right-click `index.html`
  → *Open with Live Server*.
- **Any terminal:** `python3 -m http.server 5173` then open
  `http://localhost:5173`.
- **Node:** `npx serve` in this folder.

## Deploy it

It's a static site, so it hosts anywhere: Netlify or Vercel (drag the folder in),
GitHub Pages, itch.io, or your own server. Nothing to compile.

## Editing content — the two things you'll touch most

**1. The download link.** Every "Download the game" button currently points to `#`.
Search `index.html` for `href="#" download` and replace `#` with your installer
URL (or store / itch.io page). There are several (header, hero, home, footer,
mobile bar) — replace them all.

**2. Cards, heroes, and screenshots** live in `assets/js/data.js`:

- `HERO_ART` — the four heroes that float in the hero scene. Each has an `img`
  (shown in the Heroes grid), a `tex` (a base64 copy used by the 3D scene), a
  `pos` (its position in 3D), plus `name`, `cls`, `cost`, `accent`.
- `HERO_ART_EXTRA` — heroes that appear in the Heroes grid but do **not** float
  (Quill, Kael). Grid-only, so no `pos`/`tex` needed.
- `VALOUR_SHOTS` — the three home-page screenshots, each with a `title` and
  `blurb`.

To add a hero to the grid, drop a card image in `assets/cards/` and add an entry
to `HERO_ART_EXTRA` pointing at it. To make a hero float too, give it a `pos` and
a `tex` (base64 of the card image).

## Socials

Instagram, X, and Discord links are already wired in the header, footer, and the
Updates page. To change them, search `index.html` for `instagram.com`, `x.com`,
and `discord.gg`.

## Notes

- The 3D card scene uses Three.js r128 from cdnjs. If you ever host offline,
  download that file and point the `<script>` at a local copy.
- Motion respects `prefers-reduced-motion` and pauses when the tab is hidden or
  you leave the Home view.
- Hero card art was cropped to a 5:7 card shape and had the gold frame, name
  plate, and cost pip baked in. The original crops (art only) can be re-baked if
  you want to change names or costs.
"# Valour_landing_page" 

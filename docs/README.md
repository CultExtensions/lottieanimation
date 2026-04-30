# Cult Connector Sync — web bundle

Static **half-resolution** Lottie: `animation.json` plus separate PNG files (no giant base64 in Git). Suitable for GitHub Pages, S3, Cloudflare Pages, or your **Render** static folder.

## Why this layout

| Approach | GitHub / CDN |
|----------|----------------|
| Single JSON with embedded `data:image/png` | Large diffs, slower clones, some WordPress/Lottie plugins choke |
| **`animation.json` + PNGs + `./` base URL** | Small JSON, cacheable images, works with `lottie-web` `path: 'animation.json'` |

## Regenerate from source

From the **repository root** (same folder as `package.json` and `build-cult-connector-sync-lottie.mjs`):

```bash
npm install
npm run build:web
```

That rebuilds the Lottie, halves most rasters, then copies **`cult-connector-sync-half.json`** → **`animation.json`** with **embedded `data:image/png` assets** (no separate `img_*.png` files). Browsers and **lottie-web’s SVG renderer** load reliably that way.

Smaller JSON + sidecar PNGs (for CMS/CDN): run **`npm run build:web:external`** instead.

The AE label Latin/Chinese/glow PNGs stay **full resolution** in the half build (half-scale wipes thin SVG text). Latin/Chinese layers intentionally **have no mask** (masked SVG `<image>` layers often render invisible); glyphs only occupy the AE preview area.

Preview uses **canvas** + **blob URLs** (embedded `data:` PNGs don’t paint reliably on SVG `<image>` everywhere). **`hideOnTransparent: true`** avoids the Chinese full-frame plate blocking Latin at opacity 0. **Latin is stacked above Chinese** in the JSON so the crossfade reads cleanly on canvas.

## Preview locally

`file://` often blocks fetches; use any static server:

```bash
cd cult-connector-sync-web && npx --yes serve -p 3456
```

Open http://localhost:3456

Use a static server (`serve`, “Live Server”, etc.); **`file://` will not load** `animation.json` reliably.

## GitHub Pages

1. Push this repo (or only this folder as its own repo).
2. **Actions** → enable workflows, or **Settings → Pages → Build from branch**.
3. If Pages serves the site root, ensure `index.html`, `animation.json`, and all `img_*.png` files sit in the published directory (e.g. `/docs` or root).

The workflow in `.github/workflows/gh-pages.yml` runs `npm run build:web` on Ubuntu and publishes **`cult-connector-sync-web/`** as the site artifact. Enable **Settings → Pages → GitHub Actions** as the source.

## Render (or any host)

1. Run `npm run build:web` in CI or locally before deploy.
2. Upload the contents of **`cult-connector-sync-web/`** to your static mount (same paths).
3. Set your app’s Lottie URL to `https://YOUR_SERVICE/.../animation.json` (same origin avoids CORS issues).

If the JSON and PNGs share one directory, asset URLs in JSON already use `./` so no extra config is needed.

## Full-resolution bundle

```bash
npm run build:web:full
```

Writes into `cult-connector-sync-web-full/` (add that folder to `.gitignore` if you don’t want it in git).

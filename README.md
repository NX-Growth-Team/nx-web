# Nx Web

[![CI](https://github.com/NX-Growth-Team/nx-web/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/NX-Growth-Team/nx-web/actions/workflows/ci.yml)

[简体中文](README_zh-CN.md) | English

Standalone frontend built from the Nx Figma design. Plain HTML, CSS and JavaScript — no third-party runtime dependencies, no build step. The code can be handed directly to a vendor to wire up their own backend and deployment environment.

## Local preview

With Node.js 20 or newer installed, run from this directory:

```sh
npm run dev
```

Then open `http://127.0.0.1:4173/`. Any static server works too — just point its root at `dist/`. Do not open the HTML files by double-clicking, as browsers restrict JavaScript modules loaded from `file://`.

## Pages

- `/`: Home with the "Dashboard under construction" dialog, the Demo entry point, and the green image supplied by the client.
- `/contact/`: demo request form, two-column desktop layout and single-column mobile layout.
- `/privacy-policy/`: Privacy Policy. The body text follows Figma; the extra checkbox and Submit button from the original file were removed.

`dist/` is both the editable frontend source and the static delivery directory — no generated output ever overwrites the sources. Links are relative so the site works at a root domain or in a subdirectory; the API path is configured separately.

## Backend integration

1. Deploy `dist/` as the static site root — no compilation required.
2. Set the real form endpoint in `dist/assets/js/config.js`.
3. Accept JSON as described in the interface doc below and return an explicit success response. Replace the placeholder Privacy Policy text before going live.

`demoEndpoint` is configured in `dist/assets/js/config.js` and defaults to `POST /api/demo-requests`. This project does not provide, mock or store backend form data. Success is shown only when the response is JSON containing `{ "success": true }`.

Field, response, idempotency and CORS conventions are documented in [backend integration](docs/backend-integration.md). Duplicate submissions are blocked while a request is in flight; timeouts and network errors can be retried. The privacy link opens in a new tab, the form contents stay on the current page, and nothing is written to browser persistent storage.

The request is sent as soon as the required fields are valid, a source is selected and consent is checked — no filtering by company type, email domain or profile content. While the local preview returns `backend_not_connected`, the page shows the neutral notice "form is complete, but submission is not enabled in preview" — it does not claim success and does not treat the user's data as invalid. Once a real backend is connected, success is shown only after the backend confirms receipt.

## Field rules

- First Name, Last Name, Title, Company Name, Company Website, Email Address, the source dropdown and the consent checkbox are required.
- Phone Number is optional and sent as `null` when empty. Formats such as numbers with extensions are accepted; no extra format validation is applied.
- Company Website accepts `company.com` and is prefixed with `https://` before sending.
- Source values: `search_engine`, `social_media`, `referral`, `event`, `other`.

## Responsive behaviour

- The desktop home hero is roughly 3:1, with the client's latest static image on the right using `object-fit: cover` to crop responsively while keeping the original colours and sharpness.
- Below 760px the home page becomes a single column and the green image moves to a banner under the content; below 600px the form becomes single column; below 420px the home page buttons stack vertically.
- The dropdown uses a menu with the form's font, thin border and rounded corners, and supports keyboard, mouse and touch. The underlying native select still holds the submitted value.
- Short viewports scroll naturally with no fixed content height; form inputs are 16px on mobile so iOS does not zoom in when typing.
- The home page tracks window and viewport height changes, tightening the vertical padding smoothly as height shrinks. Continuous window resizing needs no refresh, and content stays scrollable when the viewport is extremely short.
- The logo on the demo form and Privacy Policy pages is fixed to the top so users can return home at any scroll position; mobile reserve space for it.

## Assets and checks

The home page uses the client's latest green image. The original PNG (4104 × 4104, about 19 MB) is kept only in the local `assets-source/` directory for future re-encoding and is excluded by `.gitignore`, so it is not distributed with the repository. The page itself loads `dist/assets/home-green-selected.webp` (q92, about 1.4 MB, PSNR 48.3 dB — visually lossless) so the 19 MB PNG does not slow the home page down. The logo and copyright icon come from the original Figma assets.

The repository ships `dist/` (frontend source that doubles as the delivery directory), `server/`, `docs/` and the check scripts. `node_modules/`, database files (such as `leads.db`), logs and real `.env` configuration are excluded by `.gitignore`, while `server/nx-api.env.example` is kept as a template. Generate the real configuration from that template locally or on the server before deploying, and never commit it.

Roboto Slab is self-hosted and its license file is at `dist/assets/fonts/LICENSE.txt`. The page depends on neither Google Fonts nor temporary Figma URLs.

```sh
npm run check
npm test
```

On 2026-10-05 the Privacy Policy was replaced with the approved NX policy (covering PIPL, CASL and region-specific rights), and the placeholder `noindex` was removed. The consent checkbox currently follows the "everything except phone is required" rule; to change that, edit the consent rule in the form and validation modules.

The frontend delivery package contains the pages in use, images and fonts, the preview and check scripts, and the backend interface doc. Historical images, asset processing notes and check screenshots are not part of the package.

In browsers that support WebMCP, `stage_demo_request_draft` can fill in a draft. The tool does not submit the request and does not check consent on the user's behalf; browsers without that API are unaffected. Tool registration, draft filling and rejection of invalid options were verified in a supported preview context.

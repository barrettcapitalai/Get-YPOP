# $YPOP ↔ Linea section pairing

Reference: `/workspace/ypop_site/_linea_ref/` (+ live template at 8b.com/templates/linea/).
Brand stays ours (copy, Obsidian `#101110`, lime `#AFE504`, light text lime `#5c7300`). Motion uses the jitter-safe sticky + rAF kit — not Linea's CSS scroll-timelines — so iOS stays smooth.

| Our section | Linea pattern | Motion / layout notes |
|---|---|---|
| **Nav** | `#nav` floating pill + full-screen menu | Pill bar; mobile menu = large type stack (Linea `menu__links`), no blur on coarse pointers |
| **Hero** | `#hero` media + copy enter | Caption-in / band-rise on load; keep our messaging + phone mock; mobile: tighter type, generous side pad (`--space-1` rhythm) |
| **Pitch (4 taglines)** | `#listen` They speak / You read | **Pinned split panel**: Obsidian half + lime half; taglines wipe across like caption rows; no step numbers / no icons; subtle progress bars; mobile stacks lime→dark |
| **Problem** ("They own the audience…") | `#listen` head + `readAlong` | Two-column head on desktop; word/line reveal; flow cards as calm band — no pin |
| **Who it's for** | `#rooms` horizontal scrub | Keep current scroll-scrub Who rail (auto, no manual swipe); sticky stage, translate3d track |
| **"We make influence transactable"** | `#setup` / `#voices` head | Title + lead grid; stacked feature cards with band backgrounds |
| **Golden path** | `#calls` sticky phone | Sticky phone + stepped list already; tighten mobile dock + type |
| **Film** | `#start` / dark band | Full-bleed dark sheet; caption-in title; keep existing film embed |
| **Calculators** | `#tune` / `#setup` cards | Large title + card grid; no invented stats beyond existing calculator UI |
| **Flywheel / value** | `#setup` stacked cards | Alternating Obsidian / lime / soft cards, large type |
| **Partners + CTA** | rooms grid + `#start` CTA | Theme-aware marquee; closing CTA band; HubSpot form untouched |
| **Footer** | `#footer` | Keep Linea MIT credit; compact mobile |

## Mobile (390 / 375 / 430) rules from Linea
- Side pad ≈ `clamp(1.125rem, 4.2vw, 3.5rem)`; section pad ≈ `clamp(5rem, 10vw, 9rem)` scaled to our sheets
- Pins use `100svh`, no transform on sticky ancestors, `scroll-behavior: auto` on touch
- Split panels stack (lime/read on top); type steps down cleanly; zero horizontal overflow
- Reduced motion → finished static layouts (joined panels, stacked who cards, visible path steps)

## Out of scope / do not touch
HubSpot form config, roster ENC / sig / Last synced, `assets/roster.css`, invented stats/logos/stock video.

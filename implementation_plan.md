# Procedural AR Ring Try-On — Implementation

This document describes the implemented architecture for the virtual ring try-on: a **pure, imperative Vanilla Three.js** engine that procedurally generates a photo-real 3D ring from the shop selections and anchors it to the user's finger via MediaPipe hand tracking.

> **Note:** This supersedes the earlier "Backend Image Compositing" plan (PNG assets + `sharp`). The diamond and setting are **not** flat composited images — they are generated as true 3D geometry on the client. There is no `/api/render/ring` endpoint and no asset-compositing pipeline.

## Milestones

Git checkpoints for this work live in a **dedicated repo** initialized at the project root
(`/Users/riteesh/Documents/Windsurf/Aura-ring-AR`), separate from the surrounding home-directory
git repo. Each milestone is a tag; intermediate Milestone 2 steps are individual commits.

### Milestone 1 ✅ (tag `milestone-1`, commit `8a9ebb1`)

`git reset --hard milestone-1` / `git checkout milestone-1` restores this exact, building state
(verified: clean tree, tag == HEAD, `tsc --noEmit` clean on both files).

- **Achieved:**
  - Config changes correctly trigger full regeneration — the earlier static-render bug is fixed and
    verified across multiple stone+setting combinations (headless: distinct geometry/part trees).
  - Metal type visibly changes material/color (catalog "18k White Gold" etc. now keyword-mapped).
  - Band geometry reads as a curved closed loop following the finger (band bbox 19.5mm in X and Z).
  - Diamond uses a true faceted mesh (hand-built brilliant/step-cut polyhedra), not a smooth revolve
    or primitive.
- **Known gaps carried into Milestone 2:**
  - Setting types (solitaire / three-stone / halo) don't yet read as structurally correct/distinct
    against real jewelry.
  - Diamond material is close but not fully photoreal — specular character, fire, and color
    neutrality not yet fully dialed in.

### Milestone 2 (in progress)

Living changelog — one line + commit hash per meaningful change; small separately-committed steps
so any single one can be reverted without losing the rest.

- `850caf6` — open milestone changelog; record Milestone 1 checkpoint.
- `7ca6c7c` — three-stone: rebuilt with gallery bridges + a visible band gap between clusters
  (headless-verified: 3 distinct stone assemblies + 2 connecting bridges; side stones no longer float).
- `e6648bb` — halo: tightened accent size/spacing for a continuous melee ring
  (headless-verified: 14 accents hugging the girdle; range 14–20).
- `6a29d69` — diamond: neutral `attenuationColor` (`0xfbfdff`, long distance) for a colourless/icy
  read (was a warm `0xfff6ec` that tinted the stone yellow).
- `3bdb52d` — diamond: reduced `dispersion` 0.035 → 0.02 (occasional facet flashes, not a constant
  rainbow tint).
- `510bf6a` — changelog update; propose close.
- `40aa450` — real per-shape carat→mm stone sizing from diamond size charts (half-width table +
  per-cut length:width). Headless-verified 1.00ct footprints: round 6.5², oval 5.7×7.7, emerald
  5.0×7.0, princess 5.5², cushion 6.0², radiant 5.4×7.0 — all matching standard charts.
- `b188bf7` — snug band fit: scale now derived from the band inner diameter (14.5) × 6% clearance
  instead of the magic `/10.4` that produced a loose ~1.4× loop with visible daylight.
- `99b2dca` — **hidden-halo given its own assembly** (under-basket accents tilted outward, hidden
  from top / visible in profile) — fixes the fall-through to the visible-halo path (the "flower-blob"
  bug). Added **shoulder pavé** melee to halo (2 split rows), hidden-halo (1 row) and three-stone,
  matching the catalog reference PNGs. `createHalo` generalized with explicit seat height + tilt.

#### Catalog coverage — every setting has its own explicit, non-degenerate path

Authoritative catalog (`Customizer.ts`): shapes = Round/Oval/Emerald/Princess/Cushion/Radiant;
settings = Solitaire/Halo/Hidden Halo/Three Stone. Built each to match `public/settings/*.png`.
Headless QA over all **6 × 4 = 24** combinations — all non-degenerate (finite bbox, tris > 0), and:

| setting | stones | halo accents | shoulder pavé | matches reference |
| --- | --- | --- | --- | --- |
| solitaire | 1 | 0 | none | clean band + basket ✓ |
| three_stone | 3 | 0 | 1 row + 2 bridges | centre + 2 sides + shoulder pavé ✓ |
| halo | 1 | 14 (girdle) | 2 split rows | bold top ring + split-shoulder pavé ✓ |
| hidden_halo | 1 | 15 (under basket, tilted) | 1 row | accents under crown + pavé ✓ |

No two settings share a shape; hidden_halo ≠ halo (10063 vs 11647 tris). The previously-broken
**3.11ct oval hidden_halo** now produces sane geometry (finite bbox, 15 accents).

Verification notes (no code change needed):
- **Per-finger fit** — MCP/PIP indices confirmed correct for all four fingers (index 5/6, middle
  9/10, ring 13/14, pinky 17/18), identical in the sizing and try-on paths.
- **Specular character** — custom HDR env has 4 small bright softboxes (`createStudioEnvironment`),
  bound once in `initThreeJS`; gem uses `roughness 0.015` + `flatShading` for scattered glints.
- **Transparency / colour** — `transmission 1.0`, `ior 2.417`, neutral `0xfbfdff` attenuation → glassy
  and colourless.

- `1761167` — **per-SKU field-driven assembly**: new `src/data/settingSpecs.ts` defines a
  `SettingSpec` (structural fields: `prongCount`, `halo` mode, `haloRows`, `accentScale`,
  `paveRows`, `sideStones`, `sideStoneScale`, `gallery`). `generateRing` now builds from these
  fields instead of a `settingType` switch. `resolveSettingSpec(catalogSetting)` returns the
  design default by `style` merged with any per-SKU `spec` override.

#### Per-SKU vs per-category — data reality & coverage

**Finding (verified in `Customizer.ts`):** the catalog has **150 setting SKUs but only 4 distinct
designs** — `img` is a 1:1 function of `style`, so every "Halo" SKU shares `halo.png`, etc. The
only per-SKU variation in the data is **metal + price**. There are no per-SKU distinct photos or
structural fields to derive bespoke geometry from, so "per-SKU" legitimately collapses to
"per-design (4)" here. We did **not** fabricate per-SKU differences (would violate "derive from the
SKU's own photo"). Chosen approach (user-confirmed): field-driven refactor for the 4 real designs,
made **per-SKU-override-ready**.

| design (SKU group) | source | status |
| --- | --- | --- |
| Solitaire | `public/settings/solitaire.png` | ✅ per-design accurate (plain band, 4-prong basket) |
| Halo | `public/settings/halo.png` | ✅ per-design accurate (single girdle ring + split-shoulder pavé) |
| Hidden Halo | `public/settings/hidden_halo.png` | ✅ per-design accurate (under-basket accents + 1 pavé row) |
| Three Stone | `public/settings/threestone.png` | ✅ per-design accurate (centre + 2 sides + pavé) |
| true per-SKU bespoke designs | — | ⏳ pending real catalog data (no distinct SKU photos/fields exist yet) |

**Self-check (headless):** two `Halo` SKUs — one default, one with a per-SKU override
`{ haloRows: 2, accentScale: 0.34, paveRows: 1 }` — render **differently** (14 accents/24 pavé vs
32 accents/12 pavé); two identical specs render **identically**. So the fields genuinely drive the
geometry, and real per-SKU data will diverge automatically the moment the catalog carries it.

#### Fine-detail pass — render what each reference photo actually shows

Extended `SettingSpec` with detail fields (`prongStyle`, `meleeCount`, `meleeSpacing`, `hasMilgrain`,
`ridgeStyle`, richer `gallery`), each **read off the design's own photo** — no invented detail:

| design | band | milgrain | melee | prongs | gallery |
| --- | --- | --- | --- | --- | --- |
| solitaire | plain half-round (no ridges) | no | 0 | 4 claw | open box-basket (crossed bars) |
| halo | split-shoulder pavé | **yes — beaded rim** | **22** flush, single ring | 4 claw | rail |
| hidden_halo | single-row pavé | no | 18 under-basket | 4 cross-claw | rail |
| three_stone | single-row pavé | no | 0 (2 side stones) | 4 cross + 3-claw sides | rail |

New geometry: `createMilgrain` (beaded edge, halo only), flush melee seating in `createHalo`
(accent size capped so neighbours nearly touch at the photo's count), `prongStyle: 'cross'`
(heavier claws reaching further over the crown), and crossed basket bars for the solitaire's open
box-basket. **`ridgeStyle` is `'none'` for all four** — none of the photos show band fluting, so none
is rendered (resolution, not invention). Headless-verified: melee counts match specs exactly (halo 22,
hidden 18), milgrain appears **only** on halo (2 rings / 183 beads) and nowhere else.

#### Legibility-at-AR-scale pass (post-close fidelity tradeoffs)

A ring on a webcam hand occupies only a few dozen pixels; detail tuned in isolated macro renders
collapsed into a "foggy grey blob / rod-on-a-blob". Fixed for readability at actual scale, with
**explicit, deliberate trades of physical fidelity for legibility** (all called out here, not silent):

- **Diamond** — `transmission 1.0 → 0.6`, `envMapIntensity 3.5 → 5.0`, `reflectivity 1.0`,
  `roughness → 0.01`. A pure-transmission stone reads as grey fog with nothing behind it to refract;
  leaning to bright facet *reflection* makes it a crisp sparkly gem at small scale. (Less "correct" macro.)
- **Metal** — `envMapIntensity 2.5 → 3.4` so the band silhouette reads bright against skin, not a dim rod.
- **Milgrain** — the ~180-bead row aliases into shimmer at scale → replaced with a single slim bright
  **torus rim** per edge (reads as the defined halo edge milgrain communicates, without the noise).
- **Halo melee** — photo shows ~22 (halo) / ~18 (hidden); at AR scale they fuse into a ring of mush, so
  **fewer, larger** accents (12 / 10) that read as distinct sparkle points. Spec comments note the photo counts.
- **Lighting** — added a sharp camera-attached headlight (`PointLight`) for tight specular glints so parts
  read as separable shiny surfaces, not a uniform soft-lit disc.
- **Tracking smoothing** — EMA on position/scale + slerp on rotation (factor 0.45), reset on hand-loss, so
  the silhouette holds stable/sharp as the hand moves instead of smearing from per-frame landmark jitter.
- AA confirmed (`antialias: true`, pixel ratio capped at devicePixelRatio≤2).

**Not verified live** — these are principled changes; the in-webcam result at scale still needs the
user's visual confirmation across 2–3 configs (this remains the standing visual-QA gap). Candidate
**Milestone 3** if any config still reads as mush after live testing.

### Milestone 2 — CLOSE (tag `milestone-2`)

Structural accuracy, full catalog coverage, real sizing, and snug fit are complete and
**headless-verified** (24/24 combos non-degenerate and distinct; sizing matches charts). `tsc
--noEmit` clean on both files.

**Caveat — live visual QA still pending:** the WebGL render could not be run in this environment, so
the *material look* (sparkle/fire intensity, metal hotspot, pavé read at scale) and on-finger fit were
verified by math/geometry, not by eye. Confirm in-browser across the 24 combos and on ≥2 fingers
(index + pinky). Anything that still looks off after that goes to **Milestone 3**, candidates:
metal specular hotspot tightness vs HDRI, prong/pavé close-up fidelity, three-stone bridge styling,
and per-shape prong placement for non-round corners.

## Architecture Overview

- **Framework:** Vanilla Three.js (`three@0.184`). **No** React Three Fiber / drei — they caused WebGL context conflicts with the camera tracking loop.
- **Tracking:** MediaPipe Hands (loaded via CDN) feeds 21 landmarks per frame.
- **Lighting:** `RoomEnvironment` + `PMREMGenerator` provide studio-quality HDR reflections — mandatory for the PBR metals and the refractive diamond to read as real.
- **Key files:**
  - `frontend/src/utils/JewelryGenerator.ts` — procedural mesh generation.
  - `frontend/src/utils/calibration.ts` — MediaPipe loop, sizing, and the AR position/orientation update.

## 1. JewelryGenerator (`JewelryGenerator.ts`)

`JewelryGenerator.generateRing(config: RingConfig): THREE.Group` assembles a multi-part group.

**Local coordinate convention (consumed by the tracking loop):**
- Hole axis = **local Y** (the finger bone runs along Y).
- Stone sits at **+Z**, so after orientation +Z = dorsal / back-of-hand / camera.

**Parts:**

- **A. Metal shank** — `TorusGeometry(ringRadius, tubeRadius, 64, 256)`, `rotateX(π/2)` so the hole runs along Y. Band profile (`dome`/`flat`/`knife-edge`) shaped by non-uniform tube scaling. Material `MeshPhysicalMaterial`: `metalness 1.0, roughness 0.02, clearcoat 1.0, clearcoatRoughness 0.05, envMapIntensity 2.0, flatShading false`.
- **B. Faceted gem** — true faceting, no Octahedron:
  - Round / Oval / Princess → `LatheGeometry` revolving a real gemstone profile (culet → lower girdle → upper girdle → table edge → capped table). Round = 24 segments; Princess = 4 + 45° rotate; Oval = `scale(1,1,1.4)`.
  - Emerald → `BoxGeometry` with lower vertices pulled inward to carve a tapered step-cut pavilion.
  - All rotated `rotateX(π/2)` so the table faces +Z and the culet points into the setting. Material: `flatShading true` (per-facet sparkle), `transmission 1.0, ior 2.417, thickness 0.2, roughness 0, metalness 0, dispersion 0.05, envMapIntensity 3.0`.
- **C. Setting** — a basket/gallery torus encircling the pavilion, plus 6 prongs (round/oval) or 4 (corner), each a `CylinderGeometry` shaft + `SphereGeometry` claw cap, `lookAt`-tilted inward to clutch the girdle.
- **D. Halo (optional)** — ring of 14 tiny brilliant-cut accent stones around the girdle. Enabled when the shop's setting name contains `"halo"`.
- **E. Occlusion cylinder** — `CylinderGeometry` on local Y, centered at the group origin. `MeshBasicMaterial { colorWrite: false, depthWrite: true }`, `renderOrder = -1`. Writes depth only so the back of the ring (and the stone when it rotates behind the finger) is masked.

`disposeGroup()` uses `traverse` to dispose all nested geometries/materials.

### `RingConfig`
```ts
{ ringSize, bandWidth, bandProfile, metalType, stoneShape, stoneCarat, halo? }
```
Built in `calibration.ts#build3DRing` from `appState.cart.diamond`, `appState.selectedMetal`, and the setting name.

## 2. Tracking & Placement (`calibration.ts`)

`renderTryOnMode` → `drawAugmentedRing3D` runs every frame in **raw (unmirrored) MediaPipe space**. Both `#webcam-source` and `#three-canvas` carry `transform: scaleX(-1)`, so the scene is rendered unmirrored and flipped uniformly by CSS at display time.

- **Position** — `lerpVectors(mcpVec, pipVec, 0.55)` seats the band past the knuckle, in the webbed pocket at the base of the proximal phalanx (not on the knuckle).
- **Orientation (quaternion via orthonormal basis):**
  - **Y axis** = finger bone direction (pitch-aware, from MCP→PIP including MediaPipe z).
  - **Dorsal normal** = `(indexMCP − wrist) × (pinkyMCP − wrist)` (`computeDorsalNormal`). The cross-product sign is fixed by hand chirality, so it is flipped by a `HANDEDNESS_SIGN` constant derived from MediaPipe's handedness label.
  - **Basis:** `X = Y × dorsal`, `Z = X × Y` (re-orthogonalized dorsal), fed to `Matrix4.makeBasis` → `quaternion`. Local +Z (the stone) tracks the dorsal normal, so when the palm faces the camera the stone rotates away and the occlusion cylinder hides it.
- **Scale** — `requiredScale = fingerWidthPx / 10.4`, matched to the measured finger width.

### Sizing (credit-card calibration)
`detectCreditCardEdges` finds a card's pixel width (Sobel edges) to derive `mm/pixel`. `calculateRingSize` uses the 3D proximal-phalanx length (× 0.48) for finger width, EMA-smoothed, with a 30-frame stability lock that writes `appState.lockedSizeResult`. In try-on mode the locked physical width back-solves the scale, so no card is needed live.

## Photorealism Pass (current state)

The gem, setting, lighting and compositing were upgraded together (they're interdependent —
new facets/prongs need the occlusion volume and a bright-source HDRI to read correctly).

- **Gem geometry** — replaced the lathe revolve / carved box with hand-built faceted polyhedra
  (non-indexed triangle soups → flat per-facet normals → real sparkle). Round/oval follow a
  near-GIA round brilliant (table 55%, crown ≈34.5°, pavilion ≈40.7°, bezel+star break-up via
  an 8→16 ring bridge); princess = corner-cut square modified brilliant; emerald = concentric
  stepped frames with cut corners.
- **Diamond material** — `thickness` derived from carat→mm depth, warm-white `attenuationColor`,
  `dispersion 0.035`, `flatShading`, `envMapIntensity 3.5`, `ior` exposed via config.
- **Setting** — tapered claw prongs (taper + curled partial-torus claw, `lookAt` aimed above/inward
  so claws curl over the crown), plus a two-rail gallery with posts (light passes through).
- **Metal** — `scene.environment` bound once in `initThreeJS`; `envMapIntensity 2.5`; polished vs
  brushed finish (procedural micro-streak normal map) selectable via `metalFinish`.
- **Lighting/env** — custom **HDR** equirectangular studio environment (Float32 DataTexture: dark
  gradient + 4 bright softbox sources) through PMREM; `ACESFilmicToneMapping` + explicit
  `SRGBColorSpace`; pixel ratio capped at 2.
- **AR compositing** — soft contact-shadow sprite grounds the ring against the skin; webcam average
  luminance sampled (16×16, 1/30 frames) nudges tone-mapping exposure to match the room.

## Selection-Driven Assembly Pass (regeneration bug + structural settings)

Fixed a regression where the rendered ring was identical across selections even though the
"Currently Wearing" card updated. Regeneration *was* firing (`shop → notify → subscribe →
rebuildRing`); the failure was in `build3DRing` mapping the loose catalog strings onto the
generator enums:

- **Metal** — catalog stores `"18k White Gold"`; the old `.replace(/[\s-]/g,'_')` produced
  `"18k_white_gold"` (not a valid key → wrong colour). Now keyword-matched to the metal enum.
- **Setting** — old code read `setting.name`/`.type`; the real field is `setting.style`
  (`"Solitaire" | "Halo" | "Hidden Halo" | "Three Stone"`) → halo was never detected. Now
  mapped to a `settingType` enum that drives the assembly.
- **Shape** — `"Cushion"`/`"Radiant"` silently fell back to round; now handled (radiant =
  elongated rectangular brilliant, cushion = softened princess).

`generateRing` now branches on `settingType` into genuinely different part layouts:
**solitaire** (one cluster), **halo / hidden halo** (centre + tight ~15-stone accent ring
hugging the girdle), **three_stone** (larger centre + two flanking stones in a row along the
finger). Verified headlessly: the four test configs produce distinct triangle counts, part
trees, stone counts (1 / 1+15 accents / 3), and bounding boxes; band bbox is 19.5mm in both X
and Z (a true closed loop). A `window.DEBUG_RING` console log (on by default) prints the
resolved config at both the call site and inside the generator — leave it until the fix is
visually confirmed in-browser, then set `window.DEBUG_RING = false`.

**Structural realism:** prongs rebuilt as SHORT inward-leaning claws (length ≈ crown height,
not band-spanning needles) tipped with small beads; the gallery is a single slim rail; stone
assemblies are reused for centre and side stones so spacing is tight.

## Status

| Area | Status |
| --- | --- |
| Selection → distinct rendered assembly (regeneration bug) | **Fixed** (catalog→enum mapping; headless-verified distinct geometry) |
| Per-setting assembly (solitaire / halo / hidden-halo / three-stone) | Implemented |
| Catalog shape coverage (round/oval/emerald/princess/cushion/radiant) | Implemented |
| Short inward claw prongs + slim basket (no starburst) | Implemented |
| Faceted gem polyhedra (round/oval/princess/emerald) | Implemented |
| Diamond PBR (carat-derived thickness, dispersion, flat facets, configurable ior) | Implemented |
| Metal env reflections + polished/brushed finishes | Implemented |
| Custom HDR studio environment (bright softboxes) | Implemented |
| ACES tone-map + sRGB output + pixel-ratio cap | Implemented |
| Contact shadow + webcam exposure matching | Implemented |
| Base-of-finger placement (lerp 0.55) | Implemented |
| Cross-product dorsal front/back detection | Implemented — handedness sign **resolved** (MP label inverted vs real hand; see `computeDorsalNormal`) |
| Occlusion cylinder re-derived for new parts | Implemented (band-radius driven; length → bandWidth×4.5) |
| Credit-card sizing + stability lock | Implemented |
| GPU cleanup on rebuild (geometry + per-ring textures) | Implemented (`disposeGroup` traverses; env map intentionally shared, not disposed) |

## Open TODOs / risks

- **Live visual QA not yet done in this pass** — `tsc` is clean and structural difference across
  configs is headless-verified, but the WebGL render could not be run here. Confirm in-browser:
  the ring now reads as a closed loop (not a bar), prongs are short curled grips (not a starburst),
  the gem sits upright table-out (not a ball), facet break-up + fire on the gem, a *tight* moving
  specular hotspot on the metal, and a believable contact shadow. Test at least round/solitaire,
  radiant/halo, oval/three-stone and confirm they're visibly distinct assemblies.
- **Three-stone side stones float** — the two flanking stones sit tightly beside the centre but are
  not yet tied to the band with metal (shared prongs / connecting bridge). Reads as a row of three
  at AR scale; add connecting metalwork if close-up inspection shows a gap.
- **Halo seat for non-round centres** — the halo ring height uses the round-brilliant pavilion
  fraction (`haloSeatDepth`); for a princess/emerald centre the accent ring may sit a hair off the
  girdle plane. Derive the seat from the actual centre `spec.pavilionDepth` if it reads wrong.
- **Handedness** — sign is committed (no longer a "maybe flip"); if a live test shows front/back
  inverted, flip the single `sign` in `computeDorsalNormal` and note the camera/mirror setup.
- **HDRI source** — environment is fully procedural (no external asset), so there is **no licensing
  concern**. If art direction wants a richer reflection, swap in a baked `.hdr` via `RGBELoader`
  and record its source/license here.
- **Emerald/princess facet realism** — these are plausible step/modified-brilliant approximations,
  not exact GIA facet maps; revisit if a specific SKU's facet pattern must match exactly.
- **Brushed metal** is wired but only triggers when the shop metal name contains
  `brushed|satin|matte`; expose an explicit finish control in the shop UI to use it deliberately.

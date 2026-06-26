# Procedural AR Ring Try-On — Implementation

This document describes the implemented architecture for the virtual ring try-on: a **pure, imperative Vanilla Three.js** engine that procedurally generates a photo-real 3D ring from the shop selections and anchors it to the user's finger via MediaPipe hand tracking.

> **Note:** This supersedes the earlier "Backend Image Compositing" plan (PNG assets + `sharp`). The diamond and setting are **not** flat composited images — they are generated as true 3D geometry on the client. There is no `/api/render/ring` endpoint and no asset-compositing pipeline.

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

/**
 * JewelryGenerator — Ultra-HD Parametric Jewelry Engine (Vanilla Three.js)
 *
 * Builds a photo-real, multi-part ring as a THREE.Group from a RingConfig:
 *   • High-res polished/brushed metal shank (TorusGeometry 64×256)
 *   • A TRUE faceted gemstone — hand-built polyhedra (not a lathe revolve / carved box):
 *       round/oval → near-GIA round brilliant facet map (table, bezel, star, upper/lower
 *       girdle, pavilion mains, culet); princess → square modified brilliant; emerald →
 *       concentric stepped frames with cut corners.
 *   • Tapered claw prongs (taper + curled torus claw) gripping the crown, over a gallery rail
 *   • Optional halo of accent stones
 *   • An invisible depth-only occlusion cylinder so the back of the ring is masked by the finger
 *
 * Local coordinate convention (consumed by calibration.ts):
 *   Hole axis  = LOCAL Y   (finger bone runs along Y)
 *   Stone sits at +Z       → after orientation, +Z = dorsal / back-of-hand / camera
 *
 * IMPORTANT: per-facet sparkle is GEOMETRY-driven (real facets) AND environment-driven.
 * The diamond needs a few small, bright sources in scene.environment to throw fire — see
 * createStudioEnvironment() in calibration.ts. Material tuning alone cannot fake it.
 */

import * as THREE from 'three';
import { SettingSpec } from '../data/settingSpecs';

// ─── Configuration ───────────────────────────────────────────────────────────

export type StoneShape = 'round' | 'oval' | 'emerald' | 'princess' | 'cushion' | 'radiant';

export interface RingConfig {
  ringSize: number;                 // shank radius (world units ≈ mm)
  bandWidth: number;                // tube diameter of the shank
  bandProfile: 'dome' | 'flat' | 'knife-edge';
  metalType: 'yellow_gold' | 'white_gold' | 'rose_gold' | 'platinum';
  metalFinish?: 'polished' | 'brushed';
  stoneShape: StoneShape;
  setting: SettingSpec;             // explicit STRUCTURAL fields drive assembly (not a category name)
  stoneCarat: number;
  stoneIor?: number;                // 2.417 = diamond; exposed for future stone types
}

const METAL_COLORS: Record<RingConfig['metalType'], number> = {
  yellow_gold: 0xffd76a,
  white_gold:  0xeceef0,
  rose_gold:   0xe0a899,
  platinum:    0xe5e4e2,
};

/** Resolved facet geometry of a cut stone — shared between the gem and its setting. */
interface StoneSpec {
  geometry: THREE.BufferGeometry;
  radius: number;        // outer girdle half-width in X (world units)
  depthTotal: number;    // table-to-culet height (drives material thickness)
  crownHeight: number;   // girdle → table
  girdleThickness: number;
  pavilionDepth: number; // girdle → culet
}

// ─── Low-level facet helpers (module-private) ────────────────────────────────
//  Gems are built as NON-INDEXED triangle soups. Because no vertices are shared,
//  computeVertexNormals() yields a single flat normal per triangle → crisp facets
//  that each catch light independently (the optical source of sparkle).

type V3 = THREE.Vector3;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function tri(out: number[], a: V3, b: V3, c: V3): void {
  out.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}

/** Circular ring of `count` vertices at a given radius/height. */
function polarRing(count: number, radius: number, y: number, phase = 0): V3[] {
  const r: V3[] = [];
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    r.push(V(Math.cos(a) * radius, y, Math.sin(a) * radius));
  }
  return r;
}

/** Corner-cut rectangle (octagonal outline) — for princess/emerald step cuts. */
function rectRing(halfX: number, halfZ: number, y: number, cut: number): V3[] {
  return [
    V(-halfX + cut, y, -halfZ), V(halfX - cut, y, -halfZ),
    V(halfX, y, -halfZ + cut),  V(halfX, y, halfZ - cut),
    V(halfX - cut, y, halfZ),   V(-halfX + cut, y, halfZ),
    V(-halfX, y, halfZ - cut),  V(-halfX, y, -halfZ + cut),
  ];
}

/** Quad strip between two equal-length rings. */
function bridgeEqual(out: number[], A: V3[], B: V3[]): void {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(out, A[i], B[i], B[j]);
    tri(out, A[i], B[j], A[j]);
  }
}

/** Bridge an N-ring to a 2N-ring (e.g. 8 table corners → 16 crown verts). This 1→2
 *  fan-out is what creates the alternating bezel / star facet pattern of a brilliant. */
function bridgeUneven(out: number[], small: V3[], large: V3[]): void {
  const n = small.length;
  for (let i = 0; i < n; i++) {
    const s0 = small[i], s1 = small[(i + 1) % n];
    const l0 = large[2 * i], l1 = large[2 * i + 1], l2 = large[(2 * i + 2) % large.length];
    tri(out, s0, l0, l1);   // bezel half
    tri(out, s0, l1, s1);   // star facet
    tri(out, s1, l1, l2);   // bezel half (next)
  }
}

function fanToApex(out: number[], ring: V3[], apex: V3): void {
  const n = ring.length;
  for (let i = 0; i < n; i++) tri(out, ring[i], apex, ring[(i + 1) % n]);
}

function capFromCenter(out: number[], center: V3, ring: V3[]): void {
  const n = ring.length;
  for (let i = 0; i < n; i++) tri(out, center, ring[i], ring[(i + 1) % n]);
}

function buildGeo(out: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals(); // non-indexed → flat per-facet normals
  return g;
}

// ─── Generator ───────────────────────────────────────────────────────────────

/** Shared context passed to the per-layout assembly builders. */
interface AssemblyCtx {
  group: THREE.Group;
  config: RingConfig;
  R: number;            // centre stone half-width (world units)
  bandOuter: number;    // band outer radius
  ringRadius: number;   // band centreline radius
  tubeRadius: number;   // band tube radius
  spec: SettingSpec;    // structural fields driving the assembly
}

export class JewelryGenerator {

  public static generateRing(config: RingConfig): THREE.Group {
    if (((window as any).DEBUG_RING ?? true)) {
      // eslint-disable-next-line no-console
      console.log('[JewelryGenerator] generateRing config →', JSON.stringify(config));
    }
    const group = new THREE.Group();
    group.name = 'ring-assembly';

    const ringRadius = config.ringSize;
    const tubeRadius = config.bandWidth / 2;
    const bandOuter  = ringRadius + tubeRadius;

    // 0. Finger occlusion — depth-only cylinder filling the hole (renders first, masks back).
    group.add(JewelryGenerator.createOcclusionCylinder(config, ringRadius));

    // 1. High-def shank.
    group.add(JewelryGenerator.createBand(config, ringRadius, tubeRadius));

    // 2. Centre-stone HALF-WIDTH from real carat→mm size charts per shape (not a single factor).
    const R = JewelryGenerator.halfWidthMm(config.stoneShape, config.stoneCarat);

    // 3. Assemble parts from the SettingSpec's STRUCTURAL FIELDS (not a category switch).
    //    Two SKUs render differently iff these fields differ. Three-stone is distinguished by
    //    sideStones; everything else is a centre cluster whose halo/pavé/prongs come from fields.
    const ctx = { group, config, R, bandOuter, ringRadius, tubeRadius, spec: config.setting };
    if (config.setting.sideStones >= 2) {
      JewelryGenerator.buildThreeStone(ctx);
    } else {
      JewelryGenerator.buildCentreCluster(ctx);
    }

    return group;
  }

  // ─── Public API for the GLB-mesh setting path ───────────────────────────────
  //  The setting (band/gallery/prongs) may come from a baked AI-generated mesh, but the DIAMOND
  //  stays procedural so it can resize per carat. These let the mesh path reuse the exact same
  //  faceted stone + PBR metal material as the procedural path.

  /** PBR metal material for the selected metal type/finish (used to recolour loaded meshes). */
  public static getMetalMaterial(config: RingConfig): THREE.MeshPhysicalMaterial {
    return JewelryGenerator.createMetalMaterial(config);
  }

  /**
   * The procedural centre diamond, sized for the selected carat/shape. Returned in its local
   * frame: girdle plane z≈0, table → +Z, culet → −Z; half-width carried on userData.halfWidth.
   * Caller positions/orients it into the loaded setting's basket via the per-design anchor.
   */
  public static createCenterStone(config: RingConfig): THREE.Mesh {
    const R = JewelryGenerator.halfWidthMm(config.stoneShape, config.stoneCarat);
    const spec = JewelryGenerator.buildShape(config.stoneShape, R);
    const mesh = new THREE.Mesh(spec.geometry, JewelryGenerator.createDiamondMaterial(config));
    mesh.name = 'stone';
    mesh.userData.halfWidth = R;
    mesh.userData.pavilionDepth = spec.pavilionDepth;
    return mesh;
  }

  /** Depth-only finger-occlusion cylinder (Y axis) sized to a given hole radius / band length. */
  public static createOcclusion(radius: number, length: number): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(radius, radius, length, 32);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }));
    mesh.renderOrder = -1;
    mesh.name = 'occlusion-finger';
    return mesh;
  }

  // ─── Assembly layouts (driven by SettingSpec structural fields) ──────────────

  /** Solitaire / halo / hidden-halo: one centre cluster, accents driven by the spec fields. */
  private static buildCentreCluster(ctx: AssemblyCtx): void {
    const { group, config, R, bandOuter, ringRadius, tubeRadius, spec } = ctx;
    const stone = JewelryGenerator.buildShape(config.stoneShape, R);
    const asm = JewelryGenerator.createStoneAssembly(config, stone, R, spec.prongCount, spec.prongStyle, spec.gallery);
    const girdleZ = bandOuter + stone.pavilionDepth;       // world z of the centre girdle plane
    asm.position.set(0, 0, girdleZ);                       // culet rests on the band
    group.add(asm);

    if (spec.halo === 'visible') {
      // Flat accent ring(s) level with the girdle, flush at the photo's melee count.
      const accentR = R * spec.accentScale;
      for (let row = 0; row < Math.max(1, spec.haloRows); row++) {
        const orbit = R + accentR * (0.82 + row * 1.7);    // each row sits one accent further out
        group.add(JewelryGenerator.createHalo(config, accentR, orbit, girdleZ, /*tiltDeg*/ 0, spec.meleeCount, spec.meleeSpacing));
        // Beaded milgrain edge around the halo rim — only where the photo shows it.
        if (spec.hasMilgrain) {
          const beadR = accentR * 0.16;
          group.add(JewelryGenerator.createMilgrain(config, orbit + accentR + beadR, girdleZ - beadR * 0.5, beadR)); // outer rim
          group.add(JewelryGenerator.createMilgrain(config, orbit - accentR - beadR, girdleZ - beadR * 0.5, beadR)); // inner rim
        }
      }
    } else if (spec.halo === 'hidden') {
      // Accents tucked UNDER the crown (below the girdle, tilted outward) — hidden from top.
      const accentR = R * spec.accentScale;
      const orbit   = R * 0.92;
      const seatZ   = girdleZ - stone.pavilionDepth * 0.45;
      group.add(JewelryGenerator.createHalo(config, accentR, orbit, seatZ, /*tiltDeg*/ 55, spec.meleeCount, spec.meleeSpacing));
    }
    if (spec.paveRows > 0) {
      JewelryGenerator.addShoulderPave(group, config, ringRadius, tubeRadius, spec.paveRows);
    }
    // solitaire (halo 'none', paveRows 0): clean band + basket only.
  }

  /** Three-stone: larger centre + two smaller flanking stones, joined by gallery bridges. */
  private static buildThreeStone(ctx: AssemblyCtx): void {
    const { group, config, R, bandOuter, ringRadius, tubeRadius, spec } = ctx;
    const sideR = R * (spec.sideStoneScale || 0.60);       // side stone size from the spec
    const specC = JewelryGenerator.buildShape(config.stoneShape, R);
    const specS1 = JewelryGenerator.buildShape(config.stoneShape, sideR);
    const specS2 = JewelryGenerator.buildShape(config.stoneShape, sideR);

    const centre = JewelryGenerator.createStoneAssembly(config, specC, R, spec.prongCount, spec.prongStyle, spec.gallery);
    centre.position.set(0, 0, bandOuter + specC.pavilionDepth);
    group.add(centre);

    // A small visible gap of metal between adjacent stones (girdles do not touch).
    const gap = R + sideR + R * 0.30;
    // Side stones are prong-set like the photo (3 claws each), not haloed.
    const left  = JewelryGenerator.createStoneAssembly(config, specS1, sideR, 3, spec.prongStyle, spec.gallery);
    const right = JewelryGenerator.createStoneAssembly(config, specS2, sideR, 3, spec.prongStyle, spec.gallery);
    left.position.set(0,  gap, bandOuter + specS1.pavilionDepth);
    right.position.set(0, -gap, bandOuter + specS2.pavilionDepth);
    group.add(left, right);

    // Gallery bridges: thin metal bars along Y at the band surface tying each side stone to
    // the centre, so metal is visible between the clusters and the sides aren't floating.
    const metal = JewelryGenerator.createMetalMaterial(config);
    const bridgeGeo = new THREE.CylinderGeometry(R * 0.10, R * 0.10, gap, 8);
    for (const dir of [1, -1]) {
      const bridge = new THREE.Mesh(bridgeGeo, metal);
      bridge.position.set(0, (dir * gap) / 2, bandOuter - R * 0.05); // sit just on the shank
      // Cylinder default axis = Y → already along the finger; no rotation needed.
      group.add(bridge);
    }

    // Shoulder pavé running down each side past the side stones (rows from the spec).
    if (spec.paveRows > 0) {
      JewelryGenerator.addShoulderPave(group, config, ringRadius, tubeRadius, spec.paveRows);
    }
  }

  /**
   * Pavé melee set into the band shoulders. Tiny round accents seated on the band's outer
   * surface, running down each shoulder from near the top toward the finger sides, tables
   * facing radially outward. `rows` = 1 (single line) or 2 (split-shoulder look).
   */
  private static addShoulderPave(
    group: THREE.Group, config: RingConfig, ringRadius: number, tubeRadius: number, rows: number
  ): void {
    const mat = JewelryGenerator.createDiamondMaterial(config);
    const accentR = Math.max(0.45, tubeRadius * 0.32);     // small melee
    const accent = JewelryGenerator.buildShape('round', accentR); // table faces +Z
    const surface = ringRadius + tubeRadius * 0.55;        // seated into the outer surface
    const zUp = new THREE.Vector3(0, 0, 1);
    const yOffset = rows === 2 ? tubeRadius * 0.42 : 0;     // split rows along the band width

    // Walk each shoulder: φ from just off the top down toward the finger sides.
    const phiStart = 0.32, phiEnd = 1.35, step = 0.20;     // radians (~18°→77°)
    for (let phi = phiStart; phi <= phiEnd; phi += step) {
      for (const sideSign of [1, -1]) {                    // both shoulders (left/right of top)
        const a = sideSign * phi;
        // Band centreline point at circumferential angle `a` (0 = +Z top), hole axis = Y.
        const radial = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)); // outward normal
        const quat = new THREE.Quaternion().setFromUnitVectors(zUp, radial);
        const rowOffsets = rows === 2 ? [yOffset, -yOffset] : [0];
        for (const oy of rowOffsets) {
          const m = new THREE.Mesh(accent.geometry, mat);
          m.position.copy(radial).multiplyScalar(surface).setY(oy);
          m.quaternion.copy(quat);
          group.add(m);
        }
      }
    }
  }

  // ─── Stone spec dispatch ──────────────────────────────────────────────────────

  /**
   * Real per-shape HALF-WIDTH (mm) for a given carat, from standard diamond size charts.
   * Linear dimension ∝ carat^(1/3). Values are the half of the SHORT axis (width); the long
   * axis is produced by each cut's length:width stretch (see buildShape). For 1.00ct:
   *   round 6.5mm dia · oval 5.7×7.7 · emerald 5.0×7.0 · princess 5.5² · cushion 6.0² · radiant 5.4×7.0
   */
  private static halfWidthMm(shape: StoneShape, carat: number): number {
    const cs = Math.cbrt(Math.max(carat, 0.05));
    const halfWidth1ct: Record<StoneShape, number> = {
      round: 3.25, oval: 2.85, emerald: 2.50, princess: 2.75, cushion: 3.00, radiant: 2.70,
    };
    return (halfWidth1ct[shape] ?? 3.25) * cs;
  }

  private static buildShape(shape: StoneShape, R: number): StoneSpec {
    // R is the stone's HALF-WIDTH; per-cut length:width ratios produce the long axis.
    let spec: StoneSpec;
    switch (shape) {
      case 'emerald':  spec = JewelryGenerator.buildEmeraldCut(R); break;           // LW 1.40 (internal)
      case 'princess': spec = JewelryGenerator.buildPrincessCut(R, 1.0); break;     // square
      case 'radiant':  spec = JewelryGenerator.buildPrincessCut(R, 1.30); break;    // LW 1.30 rectangular brilliant
      case 'cushion':  spec = JewelryGenerator.buildPrincessCut(R, 1.0, 0.32); break; // square, softened corners
      case 'oval':     spec = JewelryGenerator.buildRoundBrilliant(R, 1.35); break; // LW 1.35
      default:         spec = JewelryGenerator.buildRoundBrilliant(R, 1.0); break;  // round
    }
    // Rotate so the table (+Y) faces +Z (outward) and the culet points into the setting.
    spec.geometry.rotateX(Math.PI / 2);
    spec.geometry.computeVertexNormals();
    return spec;
  }

  // ─── Materials ──────────────────────────────────────────────────────────────

  private static createMetalMaterial(config: RingConfig): THREE.MeshPhysicalMaterial {
    const brushed = config.metalFinish === 'brushed';
    const mat = new THREE.MeshPhysicalMaterial({
      color: METAL_COLORS[config.metalType],
      metalness: 1.0,
      roughness: brushed ? 0.3 : 0.04,         // satin micro-roughness vs mirror polish
      clearcoat: brushed ? 0.0 : 1.0,
      clearcoatRoughness: 0.05,
      // ↑ envMap reflection (legibility): a brighter, higher-contrast band silhouette separates
      // the ring from skin at webcam scale instead of reading as a dim grey rod.
      envMapIntensity: 3.4,
      flatShading: false,
    });
    if (brushed) {
      // Directional micro-streak normal map gives the satin "drag" along the band.
      const nrm = JewelryGenerator.createBrushedNormalMap();
      nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping;
      nrm.repeat.set(24, 1);                    // many streaks around the circumference
      mat.normalMap = nrm;
      mat.normalScale.set(0.35, 0.35);
    }
    return mat;
  }

  private static createDiamondMaterial(config: RingConfig): THREE.MeshPhysicalMaterial {
    const cs = Math.cbrt(Math.max(config.stoneCarat, 0.05));
    // LEGIBILITY TRADEOFF (AR scale): a physically pure transmission:1.0 diamond reads as a
    // foggy grey blob when it's only ~30px on a webcam hand with nothing behind it to refract.
    // We lean the stone toward bright FACET REFLECTION (lower transmission, higher envMap) so it
    // reads as a crisp sparkly gem at small scale. Less physically "correct" up close, but the
    // whole point is reading as a diamond on a hand, not a studio macro shot.
    return new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.01,                          // sharp, mirror-like facet glints (not soft sheen)
      transmission: 0.6,                        // ↓ from 1.0 — reflection dominates → bright, not foggy
      ior: config.stoneIor ?? 2.417,
      thickness: 3.0 * cs,
      attenuationColor: new THREE.Color(0xfbfdff),
      attenuationDistance: 14.0 * cs,
      dispersion: 0.02,
      transparent: true,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      envMapIntensity: 5.0,                      // ↑ catch bright HDRI sources → high-contrast sparkle
      reflectivity: 1.0,
      flatShading: true,                         // per-facet shading = crisp, separable glints
      side: THREE.DoubleSide,
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
    });
  }

  /** Procedural brushed-metal normal map (vertical micro-streaks). */
  private static createBrushedNormalMap(): THREE.CanvasTexture {
    const w = 256, h = 8;
    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const c = cvs.getContext('2d')!;
    const img = c.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      // Random per-column slope perturbs the surface tangent → anisotropic streaks.
      const slope = (Math.random() - 0.5) * 2;
      const nx = Math.max(-1, Math.min(1, slope * 0.6));
      const r = Math.floor((nx * 0.5 + 0.5) * 255);
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        img.data[i] = r; img.data[i + 1] = 128; img.data[i + 2] = 255; img.data[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.NoColorSpace; // normal data is linear, not sRGB
    return tex;
  }

  // ─── Band (shank) ─────────────────────────────────────────────────────────

  private static createBand(config: RingConfig, ringRadius: number, tubeRadius: number): THREE.Mesh {
    const geo = new THREE.TorusGeometry(ringRadius, tubeRadius, 64, 256);
    // Torus lies in XY (hole along Z); rotate so the hole runs along LOCAL Y.
    geo.rotateX(Math.PI / 2);
    switch (config.bandProfile) {
      case 'knife-edge': geo.scale(1.0, 1.0, 1.35); break;
      case 'flat':       geo.scale(1.0, 1.0, 0.7);  break;
      default: break; // dome
    }
    const mesh = new THREE.Mesh(geo, JewelryGenerator.createMetalMaterial(config));
    mesh.name = 'band';
    return mesh;
  }

  /**
   * Round brilliant (and oval via `stretch`). Built from stacked vertex rings whose
   * proportions follow a real round brilliant:
   *   table   = 55% of girdle diameter
   *   crown   ≈ 34.5° crown angle  (table-edge rises over 0.45R for crownH≈0.31R)
   *   pavilion≈ 40.7° pavilion angle (culet drops pavD≈0.86R below the girdle)
   * The 8-corner table bridged to a 16-vertex crown ring produces the bezel+star facet
   * break-up; the girdle band and pavilion-main fan complete the ~57/58-facet feel.
   */
  private static buildRoundBrilliant(R: number, stretch: number): StoneSpec {
    const rTable   = 0.55 * R;
    const crownH   = 0.31 * R;
    const pavD     = 0.86 * R;
    const girH     = 0.04 * R;

    const tableCenter = V(0, crownH, 0);
    const T8   = polarRing(8,  rTable,    crownH);                 // table octagon corners
    const C16  = polarRing(16, 0.84 * R,  crownH * 0.45);         // crown mid (star/bezel break)
    const GT16 = polarRing(16, R,          girH / 2);             // girdle top
    const GB16 = polarRing(16, R,         -girH / 2);             // girdle bottom
    const PM16 = polarRing(16, 0.52 * R,  -pavD * 0.55);          // pavilion mid
    const culet = V(0, -pavD, 0);

    const out: number[] = [];
    capFromCenter(out, tableCenter, T8);  // flat table
    bridgeUneven(out, T8, C16);           // crown bezel + star facets
    bridgeEqual(out, C16, GT16);          // upper-girdle facets
    bridgeEqual(out, GT16, GB16);         // girdle band
    bridgeEqual(out, GB16, PM16);         // lower-girdle facets
    fanToApex(out, PM16, culet);          // pavilion mains → culet

    const geo = buildGeo(out);
    if (stretch !== 1.0) geo.scale(1.0, 1.0, stretch); // oval elongation along finger axis

    return { geometry: geo, radius: R, depthTotal: crownH + girH + pavD, crownHeight: crownH, girdleThickness: girH, pavilionDepth: pavD };
  }

  /**
   * Princess (square modified brilliant) and its variants:
   *   stretch > 1 → radiant (elongated rectangular brilliant)
   *   cutFrac larger → cushion (softer, rounder corners)
   * Corner-cut square rings + chevron pavilion to a culet point.
   */
  private static buildPrincessCut(R: number, stretch = 1.0, cutFrac = 0.16): StoneSpec {
    const s      = R;            // half-width of the square girdle
    const cut    = s * cutFrac;  // corner truncation
    const rTable = 0.62 * s;
    const crownH = 0.30 * R;
    const pavD   = 0.95 * R;     // princess pavilions are deep
    const girH   = 0.05 * R;

    const tableCenter = V(0, crownH, 0);
    const Ttab = rectRing(rTable, rTable, crownH, cut * 0.6);
    const Cmid = rectRing(0.86 * s, 0.86 * s, crownH * 0.45, cut * 0.85);
    const Gt   = rectRing(s, s,  girH / 2, cut);
    const Gb   = rectRing(s, s, -girH / 2, cut);
    const Pm   = rectRing(0.5 * s, 0.5 * s, -pavD * 0.5, cut * 0.6);
    const culet = V(0, -pavD, 0);

    const out: number[] = [];
    capFromCenter(out, tableCenter, Ttab);
    bridgeEqual(out, Ttab, Cmid);
    bridgeEqual(out, Cmid, Gt);
    bridgeEqual(out, Gt, Gb);
    bridgeEqual(out, Gb, Pm);
    fanToApex(out, Pm, culet);

    const geo = buildGeo(out);
    if (stretch !== 1.0) geo.scale(1.0, 1.0, stretch); // radiant elongation along finger axis

    return { geometry: geo, radius: s * Math.max(1, stretch), depthTotal: crownH + girH + pavD, crownHeight: crownH, girdleThickness: girH, pavilionDepth: pavD };
  }

  /** Emerald: rectangular step cut — concentric cut-corner frames stepping in crown & pavilion.
   *  R is the half-WIDTH; emerald length:width ≈ 1.40. */
  private static buildEmeraldCut(R: number): StoneSpec {
    const hx   = R;              // narrow axis (across finger) = half-width
    const hz   = 1.40 * R;       // long axis (along finger after rotation)
    const cut  = Math.min(hx, hz) * 0.2;
    const crownH = 0.18 * R;
    const pavD   = 0.85 * R;
    const girH   = 0.06 * R;

    const topCenter = V(0, crownH, 0);
    const F1 = rectRing(0.55 * hx, 0.55 * hz, crownH,      cut * 0.5); // table edge
    const F2 = rectRing(0.80 * hx, 0.80 * hz, crownH * 0.5, cut * 0.8); // crown step
    const F3 = rectRing(hx, hz,  girH / 2, cut);                       // girdle top
    const F4 = rectRing(hx, hz, -girH / 2, cut);                       // girdle bottom
    const F5 = rectRing(0.72 * hx, 0.72 * hz, -pavD * 0.45, cut * 0.8); // pavilion step
    const F6 = rectRing(0.34 * hx, 0.34 * hz, -pavD,        cut * 0.5); // culet ridge
    const botCenter = V(0, -pavD, 0);

    const out: number[] = [];
    capFromCenter(out, topCenter, F1);
    bridgeEqual(out, F1, F2);
    bridgeEqual(out, F2, F3);
    bridgeEqual(out, F3, F4);
    bridgeEqual(out, F4, F5);
    bridgeEqual(out, F5, F6);
    capFromCenter(out, botCenter, F6);

    return { geometry: buildGeo(out), radius: Math.max(hx, hz), depthTotal: crownH + girH + pavD, crownHeight: crownH, girdleThickness: girH, pavilionDepth: pavD };
  }

  // ─── Stone assembly: one stone + short claws + slim basket ───────────────────
  //  Returned in a LOCAL frame where the girdle plane is z≈0, the table faces +Z, and the
  //  culet points to −Z (toward the band). Caller positions it on the band so the culet
  //  rests at bandOuter. The same assembly is reused for centre and side stones.

  private static createStoneAssembly(
    config: RingConfig, spec: StoneSpec, R: number,
    prongCount = 4, prongStyle: 'claw' | 'cross' = 'claw', gallery: 'open_basket' | 'rail' = 'rail'
  ): THREE.Group {
    const g = new THREE.Group();
    g.name = 'stone-assembly';
    const metal = JewelryGenerator.createMetalMaterial(config);

    // The faceted stone (girdle z≈0, table +Z, culet −Z).
    const stone = new THREE.Mesh(spec.geometry, JewelryGenerator.createDiamondMaterial(config));
    stone.name = 'stone';
    g.add(stone);

    // Gallery: a slim rail under the girdle, plus crossed basket bars for an open box-basket.
    const railTube = Math.max(0.07, R * 0.045);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(R * 0.74, railTube, 10, 32), metal);
    rail.position.set(0, 0, -spec.pavilionDepth * 0.42);
    rail.name = 'basket-rail';
    g.add(rail);
    if (gallery === 'open_basket') {
      // Two crossed bars spanning the rail → the open box-basket seen in the solitaire photo.
      const barGeo = new THREE.CylinderGeometry(railTube, railTube, R * 1.48, 8);
      for (const ang of [0, Math.PI / 2]) {
        const bar = new THREE.Mesh(barGeo, metal);
        bar.rotation.z = Math.PI / 2;           // lay the cylinder horizontal (across the basket)
        bar.rotation.y = ang;
        bar.position.set(0, 0, -spec.pavilionDepth * 0.42);
        g.add(bar);
      }
    }

    // SHORT claw prongs that barely clear the crown and curl inward — not long needles.
    // 'cross' prongs are heavier and reach a touch further over the crown (the X-grip look).
    const count   = Math.max(3, prongCount);
    const heavy   = prongStyle === 'cross';
    const prongR  = Math.max(0.12, R * (heavy ? 0.13 : 0.10));
    // Total prong length ≈ crown height + a touch — short and unobtrusive.
    const L       = spec.crownHeight + spec.girdleThickness + R * (heavy ? 0.20 : 0.12);
    const tilt    = heavy ? 0.40 : 0.30; // inward lean so the tip curls over the crown
    const shaftGeo = new THREE.CylinderGeometry(prongR * 0.5, prongR, L, 10);
    const beadGeo  = new THREE.SphereGeometry(prongR * 1.05, 12, 10);
    const yAxis = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < count; i++) {
      const a = Math.PI / 4 + (i / count) * Math.PI * 2; // diagonal placement → reads as an X
      const cos = Math.cos(a), sin = Math.sin(a);
      // Direction: mostly +Z (outward) leaning inward (−radial) so claws grip, not splay.
      const dir = new THREE.Vector3(-cos * Math.sin(tilt), -sin * Math.sin(tilt), Math.cos(tilt)).normalize();
      // Base sits at the girdle radius, a hair below the girdle plane.
      const base = new THREE.Vector3(cos * R * 0.98, sin * R * 0.98, -spec.girdleThickness * 0.5);
      const quat = new THREE.Quaternion().setFromUnitVectors(yAxis, dir);

      const shaft = new THREE.Mesh(shaftGeo, metal);
      shaft.quaternion.copy(quat);
      shaft.position.copy(base).addScaledVector(dir, L * 0.5); // cylinder is centred
      g.add(shaft);

      const bead = new THREE.Mesh(beadGeo, metal); // claw tip gripping over the crown edge
      bead.position.copy(base).addScaledVector(dir, L);
      g.add(bead);
    }

    return g;
  }

  /**
   * A tight accent ring around the centre axis at world height `seatZ`.
   *   tiltDeg 0   → flat ring, tables facing the camera (visible halo at the girdle).
   *   tiltDeg > 0 → tables tilted outward (hidden halo: tucked under the crown, seen in profile).
   */
  private static createHalo(
    config: RingConfig, accentR: number, orbit: number, seatZ: number, tiltDeg: number,
    meleeCount = 0, meleeSpacing = 1.9
  ): THREE.Group {
    const g = new THREE.Group();
    g.name = 'halo';
    const mat = JewelryGenerator.createDiamondMaterial(config);

    // Use the photo's explicit melee count when given; otherwise pack flush by spacing factor.
    const count = meleeCount > 0
      ? meleeCount
      : Math.max(14, Math.round((2 * Math.PI * orbit) / (accentR * meleeSpacing)));
    // Seat the accents flush: size each stone so neighbours nearly touch at this count/orbit,
    // leaving minimal bare metal between them (not placeholder stones with daylight around them).
    const flushR = Math.min(accentR, (Math.PI * orbit) / count * 0.96);
    const accent = JewelryGenerator.buildShape('round', flushR); // table faces +Z
    const tilt = (tiltDeg * Math.PI) / 180;
    const zUp = new THREE.Vector3(0, 0, 1);

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const m = new THREE.Mesh(accent.geometry, mat);
      m.position.set(Math.cos(a) * orbit, Math.sin(a) * orbit, seatZ);
      if (tilt > 0) {
        // Tilt the table from +Z toward the outward radial direction in the vertical plane.
        const radial = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
        const dir = zUp.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(radial, Math.sin(tilt)).normalize();
        m.quaternion.setFromUnitVectors(zUp, dir);
      }
      g.add(m);
    }
    return g;
  }

  /**
   * Milgrain — the beaded edge along the halo rim. LEGIBILITY TRADEOFF (AR scale): a true row of
   * ~180 tiny beads aliases into noise at the few-dozen pixels the ring occupies on a webcam hand,
   * so instead of individual beads we render a single slim, bright metal torus rim. It reads as a
   * crisp defined edge around the halo (which is what milgrain communicates at a glance) without
   * the high-frequency shimmer. At true macro zoom this would want the bead row back.
   */
  private static createMilgrain(
    config: RingConfig, radius: number, z: number, beadR: number
  ): THREE.Group {
    const g = new THREE.Group();
    g.name = 'milgrain';
    const metal = JewelryGenerator.createMetalMaterial(config);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, beadR * 0.9, 8, 64), metal);
    rim.position.set(0, 0, z);
    g.add(rim);
    return g;
  }

  // ─── Occlusion cylinder ──────────────────────────────────────────────────────

  private static createOcclusionCylinder(config: RingConfig, ringRadius: number): THREE.Mesh {
    // Axis = Y (the finger axis), centred at the group origin so it sits inside the band.
    // Radius hugs the inner hole; length spans well beyond the band + prong reach so the
    // back half of every part (band, stone, prongs) is depth-masked when it swings behind
    // the finger. Derived from band dims only — the band radius is what sets the fit, and it
    // is unchanged by the new stone/prong geometry, so this volume stays correct.
    const geo = new THREE.CylinderGeometry(ringRadius * 0.92, ringRadius * 0.92, config.bandWidth * 4.5, 32);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }));
    mesh.renderOrder = -1;
    mesh.name = 'occlusion-finger';
    return mesh;
  }

  // ─── Disposal ────────────────────────────────────────────────────────────────

  public static disposeGroup(group: THREE.Group): void {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (m) {
        const mats = Array.isArray(m) ? m : [m];
        for (const mat of mats) {
          // Dispose per-ring textures we created (env map is shared — never dispose it here).
          const pm = mat as THREE.MeshPhysicalMaterial;
          pm.normalMap?.dispose();
          pm.map?.dispose();
          mat.dispose();
        }
      }
    });
    while (group.children.length > 0) group.remove(group.children[0]);
  }
}

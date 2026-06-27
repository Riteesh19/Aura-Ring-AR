/**
 * SettingMeshLoader — loads real AI-generated (Meshy/Tripo/CGDream) GLB meshes for the 4 metal
 * SETTINGS and assembles them with the procedural diamond. The diamond stays procedural (resizes
 * per carat); only the band/gallery/prongs come from the baked mesh.
 *
 * STATUS: scaffold, INERT by default. Every design's `enabled` is false until (a) its GLB exists
 * at the `url` below and (b) its per-design fields (normalize transform, stone nodes, metal
 * materials, diamond anchor, occlusion) are calibrated from the inspection step. Until then,
 * build3DRing falls back to the procedural setting, so nothing regresses.
 *
 * WORKFLOW once the 4 GLBs are generated (Step 0):
 *   1. Copy them into the app's served folder:  frontend/public/setting-models/<key>.glb
 *      (they currently live on the Desktop; the browser can only load from /public).
 *   2. In the running app's console:  window.inspectSettingMesh('halo')  → logs the scene graph
 *      (node names, material names, vertex counts, bbox) so we can read the real structure.
 *   3. Fill the per-design fields below from that output, flip `enabled: true`, and the GLB path
 *      activates for that design.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export interface SettingMeshConfig {
  key: string;
  url: string;                         // path under /public the browser can fetch
  enabled: boolean;                    // false until the GLB exists AND the fields below are calibrated

  /** Substrings (case-insensitive) of mesh/material names that are the baked CENTRE STONE → hidden. */
  stoneNodeMatchers: string[];
  /** Substrings of material names that are METAL → swapped to the PBR metal material at runtime.
   *  Empty array = swap ALL materials that aren't on a hidden stone node. */
  metalMaterialMatchers: string[];

  /** Auto-fit: recenter the mesh's bbox to the origin and scale it so its largest dimension equals
   *  `targetMaxDim` (≈ mm). AI outputs have arbitrary scale/centering, so this gets them in the
   *  ballpark automatically; `normalize` below then fine-tunes (mainly ROTATION, which can't be
   *  auto-derived). Set null to skip and rely entirely on `normalize`. */
  autoFit: { targetMaxDim: number } | null;

  /** Fine-tune on top of auto-fit: hole axis = local Y, table/front = +Z. Mainly the rotation to
   *  orient the AI mesh (band plane in XZ, front toward +Z). Read off the inspected mesh once. */
  normalize: { rotationEuler: [number, number, number]; scale: number; translate: [number, number, number] };

  /** Where the procedural diamond seats inside the normalised setting (girdle-centre position). */
  diamondAnchor: { position: [number, number, number] };

  /** Finger-occlusion cylinder for this design's band inner hole, in normalised (mm-ish) units. */
  occlusion: { radius: number; length: number };
}

/** Per-design config. Values marked TODO must be filled from the inspection output before enabling. */
export const SETTING_MESH_CONFIGS: Record<string, SettingMeshConfig> = {
  solitaire: {
    key: 'solitaire', url: '/setting-models/solitaire.glb', enabled: false,
    stoneNodeMatchers: ['stone', 'diamond', 'gem', 'center', 'centre'],
    metalMaterialMatchers: [], // TODO: name the metal material(s) after inspection (empty = swap all)
    autoFit: { targetMaxDim: 22 }, // ≈ mm largest extent; tune per design after inspection
    normalize: { rotationEuler: [0, 0, 0], scale: 1, translate: [0, 0, 0] }, // TODO calibrate rotation
    diamondAnchor: { position: [0, 0, 0] },                                   // TODO calibrate
    occlusion: { radius: 7.8, length: 11 },                                   // TODO calibrate to band hole
  },
  halo: {
    key: 'halo', url: '/setting-models/halo.glb', enabled: false,
    stoneNodeMatchers: ['stone', 'diamond', 'gem', 'center', 'centre'],
    metalMaterialMatchers: [],
    autoFit: { targetMaxDim: 22 }, // ≈ mm largest extent; tune per design after inspection
    normalize: { rotationEuler: [0, 0, 0], scale: 1, translate: [0, 0, 0] },
    diamondAnchor: { position: [0, 0, 0] },
    occlusion: { radius: 7.8, length: 11 },
  },
  hidden_halo: {
    key: 'hidden_halo', url: '/setting-models/hidden-halo.glb', enabled: false,
    stoneNodeMatchers: ['stone', 'diamond', 'gem', 'center', 'centre'],
    metalMaterialMatchers: [],
    autoFit: { targetMaxDim: 22 }, // ≈ mm largest extent; tune per design after inspection
    normalize: { rotationEuler: [0, 0, 0], scale: 1, translate: [0, 0, 0] },
    diamondAnchor: { position: [0, 0, 0] },
    occlusion: { radius: 7.8, length: 11 },
  },
  three_stone: {
    key: 'three_stone', url: '/setting-models/three-stone.glb', enabled: false,
    stoneNodeMatchers: ['stone', 'diamond', 'gem', 'center', 'centre'],
    metalMaterialMatchers: [],
    autoFit: { targetMaxDim: 22 }, // ≈ mm largest extent; tune per design after inspection
    normalize: { rotationEuler: [0, 0, 0], scale: 1, translate: [0, 0, 0] },
    diamondAnchor: { position: [0, 0, 0] },
    occlusion: { radius: 7.8, length: 11 },
  },
};

// ─── Loader (GLTF + optional Draco; Meshy/Tripo exports are often Draco-compressed) ──────────

let _loader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (_loader) return _loader;
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
  loader.setDRACOLoader(draco);
  _loader = loader;
  return loader;
}

const _sceneCache = new Map<string, Promise<THREE.Group>>();

/** Load a GLB scene (cached). Returns a deep clone so each ring instance is independent. */
export function loadSettingScene(cfg: SettingMeshConfig): Promise<THREE.Group> {
  if (!_sceneCache.has(cfg.url)) {
    _sceneCache.set(cfg.url, new Promise<THREE.Group>((resolve, reject) => {
      getLoader().load(cfg.url, (gltf) => resolve(gltf.scene), undefined, reject);
    }));
  }
  return _sceneCache.get(cfg.url)!.then((scene) => scene.clone(true));
}

// ─── Inspection (Step 1.1 — run this in the browser console once the GLBs are in /public) ────

export function inspectSceneGraph(root: THREE.Object3D, label: string): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  const centre = new THREE.Vector3(); box.getCenter(centre);
  // eslint-disable-next-line no-console
  console.group(`[SettingMesh] "${label}"  bbox=${size.toArray().map(n => +n.toFixed(3))}  centre=${centre.toArray().map(n => +n.toFixed(3))}`);
  root.traverse((o: any) => {
    const matName = o.material
      ? (Array.isArray(o.material) ? o.material.map((m: any) => m.name || m.type).join('|') : (o.material.name || o.material.type))
      : '';
    const verts = o.geometry?.attributes?.position?.count ?? '';
    // eslint-disable-next-line no-console
    console.log(`${String(o.type).padEnd(12)} name="${o.name}" material="${matName}" verts=${verts}`);
  });
  // eslint-disable-next-line no-console
  console.groupEnd();
}

function nameMatches(name: string, matchers: string[]): boolean {
  const n = (name || '').toLowerCase();
  return matchers.some((m) => n.includes(m.toLowerCase()));
}

function isStoneNode(o: any, cfg: SettingMeshConfig): boolean {
  if (nameMatches(o.name, cfg.stoneNodeMatchers)) return true;
  const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
  return mats.some((m: any) => nameMatches(m?.name || '', cfg.stoneNodeMatchers));
}

/**
 * Assemble a loaded GLB scene into a setting group in the engine convention:
 *   - hide any baked centre-stone geometry (the diamond is procedural),
 *   - swap metal materials to the PBR metal material so metal-type selection recolours it,
 *   - apply the per-design normalise transform.
 * Returns a group ready to receive the procedural diamond + occlusion cylinder.
 */
export function assembleSetting(scene: THREE.Group, cfg: SettingMeshConfig, metalMat: THREE.Material): THREE.Group {
  scene.traverse((o: any) => {
    if (!o.isMesh) return;
    if (isStoneNode(o, cfg)) { o.visible = false; return; }       // drop baked stone (if separable)
    const matName = o.material ? (Array.isArray(o.material) ? o.material[0]?.name : o.material.name) || '' : '';
    const isMetal = cfg.metalMaterialMatchers.length === 0 || nameMatches(matName, cfg.metalMaterialMatchers);
    if (isMetal) o.material = metalMat;                            // recolour to selected metal
  });

  // AUTO-FIT: AI outputs have arbitrary scale/centering. Recenter the bbox to the origin and scale
  // so the largest extent ≈ targetMaxDim (mm). With Object3D's S-then-T compose (final = s·v + pos),
  // recentring while scaling means pos = -centre·s.
  if (cfg.autoFit) {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3(); box.getSize(size);
    const centre = new THREE.Vector3(); box.getCenter(centre);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = cfg.autoFit.targetMaxDim / maxDim;
    scene.scale.setScalar(s);
    scene.position.copy(centre).multiplyScalar(-s);
  }

  // Fine-tune (mainly rotation) goes on the wrap so it pivots about the recentred origin.
  const wrap = new THREE.Group();
  wrap.name = `setting-mesh-${cfg.key}`;
  wrap.rotation.set(cfg.normalize.rotationEuler[0], cfg.normalize.rotationEuler[1], cfg.normalize.rotationEuler[2]);
  wrap.scale.setScalar(cfg.normalize.scale);
  wrap.position.set(cfg.normalize.translate[0], cfg.normalize.translate[1], cfg.normalize.translate[2]);
  wrap.add(scene);
  return wrap;
}

// Console hook for the inspection step. Usage in the running app:  window.inspectSettingMesh('halo')
(window as any).inspectSettingMesh = (key: string) => {
  const cfg = SETTING_MESH_CONFIGS[key];
  if (!cfg) { console.error('unknown design key; use one of', Object.keys(SETTING_MESH_CONFIGS)); return; }
  loadSettingScene(cfg)
    .then((scene) => inspectSceneGraph(scene, key))
    .catch((e) => console.error(`[SettingMesh] failed to load ${cfg.url} — is it in frontend/public/setting-models/ ?`, e));
};

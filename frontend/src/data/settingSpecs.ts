/**
 * SettingSpec — explicit STRUCTURAL fields that drive ring assembly, replacing the old
 * "one hardcoded shape per settingType" switch. Geometry is built from these fields, so two
 * SKUs render differently iff their fields differ (and identically only when they truly match).
 *
 * DATA REALITY (verified against the shop catalog in Customizer.ts):
 *   The catalog has 150 setting SKUs but only 4 DISTINCT designs — `img` is a 1:1 function of
 *   `style`, so every "Halo" SKU shares public/settings/halo.png, etc. The only per-SKU variation
 *   in the data is metal + price. Therefore "per-SKU" currently collapses to "per-design (4)".
 *   The four DESIGN_SPECS below were read off the four reference photos. `resolveSettingSpec`
 *   additionally merges any per-SKU `spec` override carried on a catalog item, so the moment the
 *   catalog stores real SKU-specific structure it flows straight through with no generator change.
 */

export interface SettingSpec {
  key: string;                              // design id (for debugging / change detection)
  prongCount: number;                       // centre-head claws
  prongStyle: 'claw' | 'cross';             // 'cross' = heavier prongs meeting in an X over the crown
  sideStones: number;                       // 0 = none, 2 = three-stone flanks
  sideStoneScale: number;                   // side stone size relative to centre half-width
  halo: 'none' | 'visible' | 'hidden';      // accent ring style around the centre
  haloRows: number;                         // 1 = single, 2 = double concentric halo (visible only)
  accentScale: number;                      // halo accent half-width relative to centre (melee size)
  meleeCount: number;                       // explicit halo accent count from the photo; 0 = auto
  meleeSpacing: number;                     // centre-to-centre spacing factor (× accent dia); lower = tighter
  paveRows: number;                         // 0 / 1 / 2 rows of shoulder pavé melee
  hasMilgrain: boolean;                     // beaded edge along the halo rim (only where the photo shows it)
  ridgeStyle: 'none';                       // band fluting — NONE of the 4 photos show any, so 'none'
  gallery: 'open_basket' | 'rail';          // under-stone gallery treatment
}

/** One spec per distinct catalog DESIGN, fine detail read directly off public/settings/<key>.png. */
export const DESIGN_SPECS: Record<string, SettingSpec> = {
  // solitaire.png — plain polished half-round band, open 4-prong box-basket, no accents, no milgrain.
  solitaire:   { key: 'solitaire',   prongCount: 4, prongStyle: 'claw',  sideStones: 0, sideStoneScale: 0,    halo: 'none',    haloRows: 0, accentScale: 0,    meleeCount: 0,  meleeSpacing: 1.95, paveRows: 0, hasMilgrain: false, ridgeStyle: 'none', gallery: 'open_basket' },
  // halo.png — the photo shows ~22 melee, but at AR scale that fuses into a grey ring, so we use
  // FEWER, LARGER accents (12) that read as distinct sparkle points (legibility tradeoff). Milgrain rim.
  halo:        { key: 'halo',        prongCount: 4, prongStyle: 'claw',  sideStones: 0, sideStoneScale: 0,    halo: 'visible', haloRows: 1, accentScale: 0.34, meleeCount: 12, meleeSpacing: 2.1,  paveRows: 2, hasMilgrain: true,  ridgeStyle: 'none', gallery: 'rail' },
  // hidden_halo.png — under-basket halo; ~18 in the photo → 10 larger sparkle points at AR scale.
  hidden_halo: { key: 'hidden_halo', prongCount: 4, prongStyle: 'cross', sideStones: 0, sideStoneScale: 0,    halo: 'hidden',  haloRows: 1, accentScale: 0.26, meleeCount: 10, meleeSpacing: 2.1,  paveRows: 1, hasMilgrain: false, ridgeStyle: 'none', gallery: 'rail' },
  // threestone.png — centre + two flanking stones, single pavé shoulder row, cross prongs, no milgrain.
  three_stone: { key: 'three_stone', prongCount: 4, prongStyle: 'cross', sideStones: 2, sideStoneScale: 0.60, halo: 'none',    haloRows: 0, accentScale: 0,    meleeCount: 0,  meleeSpacing: 1.95, paveRows: 1, hasMilgrain: false, ridgeStyle: 'none', gallery: 'rail' },
};

/** Normalise a catalog `style` string ("Hidden Halo", "Three Stone", …) to a design key. */
export function styleKey(style: string | undefined): string {
  const s = (style || '').toLowerCase();
  if (s.includes('three')) return 'three_stone';
  if (s.includes('hidden')) return 'hidden_halo';
  if (s.includes('halo')) return 'halo';
  return 'solitaire';
}

/**
 * Resolve the structural spec for a catalog setting SKU: the design default (by style) with any
 * per-SKU `spec` override merged on top. This is the per-SKU layer — give a catalog item a
 * partial `spec` (e.g. `{ haloRows: 2, accentScale: 0.34 }`) and that SKU renders differently
 * from others in its category, with no changes needed in JewelryGenerator.
 */
export function resolveSettingSpec(catalogSetting: any): SettingSpec {
  const base = DESIGN_SPECS[styleKey(catalogSetting?.style)] ?? DESIGN_SPECS.solitaire;
  const override = catalogSetting?.spec && typeof catalogSetting.spec === 'object' ? catalogSetting.spec : null;
  return override ? { ...base, ...override } : { ...base };
}

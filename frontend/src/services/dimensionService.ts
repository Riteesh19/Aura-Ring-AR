export function getCustomRingDimensions(
  sizeUs: number,
  selectedSetting: string,
  selectedMetal: string,
  selectedCarat: number
) {
  // Map US size to inner diameter in mm: d = (sizeUs - 3.0) * 0.8128 + 14.07
  const diameter = (sizeUs - 3.0) * 0.8128 + 14.07;
  
  // Band Width (varies by setting)
  let bandWidth = 2.0;
  if (selectedSetting === 'three-stone') bandWidth = 2.4;
  if (selectedSetting === 'bypass') bandWidth = 1.8;

  // Band Thickness
  let thickness = 1.6;
  if (selectedMetal === 'platinum') thickness = 1.8;

  // Stone Diameter (approx based on carat weight)
  const stoneSize = 6.5 * Math.sqrt(selectedCarat);

  return {
    innerDiameterMm: parseFloat(diameter.toFixed(2)),
    bandWidthMm: bandWidth,
    thicknessMm: thickness,
    stoneSizeMm: parseFloat(stoneSize.toFixed(1))
  };
}

export function calculateCustomPrice(
  selectedMetal: string,
  selectedSetting: string,
  selectedStone: string,
  selectedCarat: number
): number {
  let basePrice = 0;
  
  // Metal pricing
  if (selectedMetal === 'yellow-gold') basePrice += 750;
  else if (selectedMetal === 'white-gold') basePrice += 800;
  else if (selectedMetal === 'rose-gold') basePrice += 800;
  else if (selectedMetal === 'platinum') basePrice += 1150;

  // Setting style pricing
  if (selectedSetting === 'solitaire') basePrice += 0;
  else if (selectedSetting === 'halo') basePrice += 400;
  else if (selectedSetting === 'three-stone') basePrice += 600;
  else if (selectedSetting === 'bypass') basePrice += 200;

  // Gemstone cost per carat
  let stoneCostPerCarat = 1800;
  if (selectedStone === 'sapphire') stoneCostPerCarat = 1100;
  else if (selectedStone === 'emerald') stoneCostPerCarat = 1450;
  else if (selectedStone === 'ruby') stoneCostPerCarat = 1600;
  else if (selectedStone === 'amethyst') stoneCostPerCarat = 280;

  return basePrice + (stoneCostPerCarat * selectedCarat);
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding the database with realistic ring data...');

  // Create ring inventory
  const rings = [
    {
      name: 'Aura Solitaire Classic',
      stoneType: 'diamond',
      setting: 'solitaire',
      price: 2550.0,
      stock: 50,
      thicknessMm: 1.6,
      widthMm: 2.0,
      innerDiameterMm: 16.51, // Default size 6
    },
    {
      name: 'Cosmic Halo Sapphire',
      stoneType: 'sapphire',
      setting: 'halo',
      price: 3200.0,
      stock: 30,
      thicknessMm: 1.8,
      widthMm: 2.2,
      innerDiameterMm: 16.51,
    },
    {
      name: 'Stellar Three-Stone Emerald',
      stoneType: 'emerald',
      setting: 'three-stone',
      price: 2900.0,
      stock: 20,
      thicknessMm: 1.8,
      widthMm: 2.4,
      innerDiameterMm: 16.51,
    },
    {
      name: 'Nebula Bypass Ruby',
      stoneType: 'ruby',
      setting: 'bypass',
      price: 2600.0,
      stock: 25,
      thicknessMm: 1.6,
      widthMm: 1.8,
      innerDiameterMm: 16.51,
    }
  ];

  for (const ring of rings) {
    await prisma.ringInventory.create({
      data: ring
    });
  }

  console.log('Database seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

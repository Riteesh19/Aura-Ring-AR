import { Request, Response } from 'express';
import { InventoryService } from '../services/inventoryService';
import { logger } from '../utils/logger';

export async function getInventory(req: Request, res: Response): Promise<void> {
  try {
    const { stoneType, setting, minPrice, maxPrice } = req.query;
    const filters: any = {};

    if (stoneType) filters.stoneType = String(stoneType);
    if (setting) filters.setting = String(setting);
    if (minPrice || maxPrice) {
      filters.price = {};
      if (minPrice) filters.price.gte = parseFloat(String(minPrice));
      if (maxPrice) filters.price.lte = parseFloat(String(maxPrice));
    }

    const inventory = await InventoryService.getInventory(filters);
    res.status(200).json({ status: 200, inventory });
  } catch (error) {
    logger.error('Error fetching inventory', error);
    res.status(500).json({ status: 500, message: 'Internal server error fetching ring inventory' });
  }
}

export async function createRing(req: Request, res: Response): Promise<void> {
  try {
    const { name, stoneType, setting, price, stock, thicknessMm, widthMm, innerDiameterMm } = req.body;

    if (!name || !stoneType || !setting || price === undefined || stock === undefined || thicknessMm === undefined || widthMm === undefined || innerDiameterMm === undefined) {
      res.status(400).json({ status: 400, message: 'All fields are required' });
      return;
    }

    const ring = await InventoryService.createRing({
      name, stoneType, setting, 
      price: parseFloat(String(price)), 
      stock: parseInt(String(stock), 10),
      thicknessMm: parseFloat(String(thicknessMm)),
      widthMm: parseFloat(String(widthMm)),
      innerDiameterMm: parseFloat(String(innerDiameterMm))
    });

    res.status(201).json({ status: 201, message: 'Ring added to inventory successfully', ring });
    logger.info(`Ring created in inventory: ${ring.id} by Admin`);
  } catch (error) {
    logger.error('Error creating ring item', error);
    res.status(500).json({ status: 500, message: 'Internal server error creating inventory item' });
  }
}

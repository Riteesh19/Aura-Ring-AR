import { prisma } from '../utils/db';
import NodeCache from 'node-cache';

// In-memory cache for 1 hour to protect DB from massive traffic
const inventoryCache = new NodeCache({ stdTTL: 3600 });

export class InventoryService {
  /**
   * Get all rings with optional filters. Caches the result if no filters are applied.
   */
  static async getInventory(filters: any) {
    const isCacheable = Object.keys(filters).length === 0;
    
    if (isCacheable) {
      const cached = inventoryCache.get('full_inventory');
      if (cached) return cached;
    }

    const inventory = await prisma.ringInventory.findMany({
      where: filters,
      orderBy: { price: 'asc' }
    });

    if (isCacheable) {
      inventoryCache.set('full_inventory', inventory);
    }

    return inventory;
  }

  /**
   * Create a new ring item
   */
  static async createRing(data: any) {
    const ring = await prisma.ringInventory.create({ data });
    
    // Invalidate cache when new inventory is added
    inventoryCache.del('full_inventory');
    
    return ring;
  }
}

import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';
import { logger } from '../utils/logger';

export async function createOrder(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const { itemType, sizeUs, totalAmount, details } = req.body;

    if (!itemType || sizeUs === undefined || totalAmount === undefined) {
      res.status(400).json({ status: 400, message: 'itemType, sizeUs, and totalAmount are required' });
      return;
    }

    const order = await OrderService.createOrder(
      userId, itemType, parseFloat(String(sizeUs)), parseFloat(String(totalAmount)), details
    );

    res.status(201).json({ status: 201, message: 'Order created successfully', order });
    logger.info(`Order ${order.id} created for user ${userId}`);
  } catch (error) {
    logger.error('Error creating order', error);
    res.status(500).json({ status: 500, message: 'Internal server error creating order' });
  }
}

export async function getOrders(req: Request, res: Response): Promise<void> {
  res.status(200).json({ status: 200, orders: [] });
}

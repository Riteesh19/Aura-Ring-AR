import { prisma } from '../utils/db';

export class OrderService {
  static async createOrder(userId: string, itemType: string, sizeUs: number, totalAmount: number, details: any) {
    const order = await prisma.order.create({
      data: {
        userId,
        orderItems: { itemType, sizeUs, ...details },
        totalAmount,
        status: 'PENDING'
      }
    });

    return order;
  }
}

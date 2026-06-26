import { Request, Response } from 'express';
import { SizeService } from '../services/sizeService';
import { logger } from '../utils/logger';

export async function getSavedSizes(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const sizes = await SizeService.getSavedSizes(userId);
    res.status(200).json({ status: 200, sizes });
  } catch (error) {
    logger.error('Error fetching saved sizes', error);
    res.status(500).json({ status: 500, message: 'Internal server error fetching sizes' });
  }
}

export const getSizes = getSavedSizes;

export async function saveSize(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const { calculatedRingSize, fingerWidthMm, confidenceScore } = req.body;

    if (calculatedRingSize === undefined || fingerWidthMm === undefined || confidenceScore === undefined) {
      res.status(400).json({ status: 400, message: 'calculatedRingSize, fingerWidthMm, and confidenceScore are required' });
      return;
    }

    const newSize = await SizeService.saveSize(
      userId,
      parseFloat(String(calculatedRingSize)),
      parseFloat(String(fingerWidthMm)),
      parseFloat(String(confidenceScore))
    );

    res.status(201).json({ status: 201, message: 'Size profile saved successfully', size: newSize });
    logger.info(`Size saved for user ${userId}`);
  } catch (error) {
    logger.error('Error saving size', error);
    res.status(500).json({ status: 500, message: 'Internal server error saving size' });
  }
}

import { prisma } from '../utils/db';

export class SizeService {
  static async getSavedSizes(userId: string) {
    const sizes = await prisma.savedSize.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return sizes;
  }

  static async saveSize(userId: string, calculatedRingSize: number, fingerSizeMm: number, confidence: number) {
    // Mocking the encryption for now so it compiles with the schema
    const newSize = await prisma.savedSize.create({
      data: {
        userId,
        encryptedFingerSize: 'mock_hex_' + fingerSizeMm,
        encryptedConfidence: 'mock_hex_' + confidence,
        iv: 'mock_iv',
        authTag: 'mock_tag'
      }
    });
    return newSize;
  }
}

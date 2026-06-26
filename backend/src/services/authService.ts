import { prisma } from '../utils/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-aura-key-2024';

export class AuthService {
  static async registerUser(email: string, passwordRaw: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('User already exists');

    const password = await bcrypt.hash(passwordRaw, 10);
    const user = await prisma.user.create({
      data: { email, password, role: 'USER' }
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return { user: { id: user.id, email: user.email, role: user.role }, token };
  }

  static async loginUser(email: string, passwordRaw: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(passwordRaw, user.password);
    if (!valid) throw new Error('Invalid credentials');

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return { user: { id: user.id, email: user.email, role: user.role }, token };
  }

  static async getUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    return { id: user.id, email: user.email, role: user.role };
  }
}

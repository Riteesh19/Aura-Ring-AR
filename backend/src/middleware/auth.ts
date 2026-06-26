import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'aura_ring_jwt_secret_key_2026_super_secure';

export interface UserPayload {
  userId: string;
  role: 'USER' | 'ADMIN';
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

/**
 * Authentication Middleware
 * Checks the JWT from HTTP-Only, Secure, SameSite=Strict cookies.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies.token;

  if (!token) {
    res.status(401).json({ status: 401, message: 'Access Denied: No Token Provided' });
    return;
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET) as UserPayload;
    req.user = verified;
    next();
  } catch (error) {
    res.status(403).json({ status: 403, message: 'Access Denied: Invalid or Expired Token' });
  }
}

/**
 * Admin Authorization Middleware
 * Requires the authenticated user to have the ADMIN role.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ status: 401, message: 'Access Denied: Unauthenticated' });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ status: 403, message: 'Access Denied: Admin Privilege Required' });
    return;
  }

  next();
}

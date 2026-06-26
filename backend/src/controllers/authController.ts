import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { logger } from '../utils/logger';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ status: 400, message: 'Email and password required' });
      return;
    }

    const { user, token } = await AuthService.registerUser(email, password);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({ status: 201, message: 'User registered successfully', user });
    logger.info(`New user registered: ${user.email}`);
  } catch (error: any) {
    if (error.message === 'User already exists') {
      res.status(409).json({ status: 409, message: 'Email already registered' });
      return;
    }
    logger.error('Registration Error:', error);
    res.status(500).json({ status: 500, message: 'Internal server error' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ status: 400, message: 'Email and password required' });
      return;
    }

    const { user, token } = await AuthService.loginUser(email, password);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ status: 200, message: 'Login successful', user });
    logger.info(`User logged in: ${user.email}`);
  } catch (error: any) {
    if (error.message === 'Invalid credentials') {
      res.status(401).json({ status: 401, message: 'Invalid credentials' });
      return;
    }
    logger.error('Login Error:', error);
    res.status(500).json({ status: 500, message: 'Internal server error' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie('auth_token');
  res.status(200).json({ status: 200, message: 'Logged out successfully' });
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const user = await AuthService.getUser(userId);
    res.status(200).json({ status: 200, user });
  } catch (error: any) {
    logger.error('GetMe Error:', error);
    res.status(404).json({ status: 404, message: 'User not found' });
  }
}

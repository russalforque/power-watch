import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService.js';
import { AdminUser } from '../../src/types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: AdminUser;
}

const authService = new AuthService();

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Admin authentication required.',
      errors: ['Missing or invalid Authorization header']
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  const user = authService.verifyToken(token);

  if (!user || user.role !== 'Admin') {
    res.status(403).json({
      success: false,
      message: 'Forbidden: Valid administrator privileges required.',
      errors: ['Token is invalid or expired']
    });
    return;
  }

  req.user = user;
  next();
}

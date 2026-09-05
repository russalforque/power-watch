import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Database } from '../data/database.js';
import { AdminUser, AuthResponse } from '../../src/types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'powerwatch-secure-jwt-secret-key-change-in-prod';
const TOKEN_EXPIRY = '7d';

export class AuthService {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  public async login(username: string, password: string): Promise<AuthResponse | null> {
    const user = this.db.getAdminUser(username);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    const adminUser: AdminUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    return { token, user: adminUser };
  }

  public verifyToken(token: string): AdminUser | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AdminUser;
      return decoded;
    } catch {
      return null;
    }
  }
}

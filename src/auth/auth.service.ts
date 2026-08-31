import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';

export interface SessionPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  generateOidcParam(): string {
    return randomBytes(32).toString('hex');
  }

  signSession(userId: string): string {
    const payload: SessionPayload = { sub: userId };
    return this.jwtService.sign(payload);
  }

  verifySession(token: string): SessionPayload {
    try {
      return this.jwtService.verify<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}

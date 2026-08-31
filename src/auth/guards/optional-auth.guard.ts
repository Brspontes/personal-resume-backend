import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { SESSION_COOKIE_NAME } from '../auth.constants';
import { UsersService } from '../../users/users.service';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

    if (!token) {
      return true;
    }

    try {
      const payload = this.authService.verifySession(token);
      const user = await this.usersService.findById(payload.sub);
      if (user) {
        request.user = user;
      }
    } catch {
      // Invalid or expired session: proceed unauthenticated rather than rejecting.
    }

    return true;
  }
}

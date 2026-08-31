import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authService: { verifySession: jest.Mock };
  let usersService: { findById: jest.Mock };

  const buildContext = (
    cookies: Record<string, string> = {},
  ): { context: ExecutionContext; request: Record<string, unknown> } => {
    const request: Record<string, unknown> = { cookies };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => {
    authService = { verifySession: jest.fn() };
    usersService = { findById: jest.fn() };
    guard = new AuthGuard(
      authService as unknown as AuthService,
      usersService as unknown as UsersService,
    );
  });

  it('rejects when no session cookie is present', async () => {
    const { context } = buildContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(authService.verifySession).not.toHaveBeenCalled();
  });

  it('rejects when the session token is invalid or expired', async () => {
    authService.verifySession.mockImplementation(() => {
      throw new UnauthorizedException('Invalid or expired session');
    });
    const { context } = buildContext({ session: 'bad-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the session refers to a user that no longer exists', async () => {
    authService.verifySession.mockReturnValue({ sub: 'user-1' });
    usersService.findById.mockResolvedValue(null);
    const { context } = buildContext({ session: 'good-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows the request and attaches the user when the session is valid', async () => {
    authService.verifySession.mockReturnValue({ sub: 'user-1' });
    usersService.findById.mockResolvedValue({ id: 'user-1', name: 'Jane' });
    const { context, request } = buildContext({ session: 'good-token' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({ id: 'user-1', name: 'Jane' });
  });
});

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { OptionalAuthGuard } from './optional-auth.guard';

describe('OptionalAuthGuard', () => {
  let guard: OptionalAuthGuard;
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
    guard = new OptionalAuthGuard(
      authService as unknown as AuthService,
      usersService as unknown as UsersService,
    );
  });

  it('allows the request through with no session cookie, without attaching a user', async () => {
    const { context, request } = buildContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toBeUndefined();
    expect(authService.verifySession).not.toHaveBeenCalled();
  });

  it('allows the request through and attaches the user with a valid session cookie', async () => {
    authService.verifySession.mockReturnValue({ sub: 'user-1' });
    usersService.findById.mockResolvedValue({ id: 'user-1', name: 'Jane' });
    const { context, request } = buildContext({ session: 'good-token' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({ id: 'user-1', name: 'Jane' });
  });

  it('allows the request through without a user when the session is invalid or expired', async () => {
    authService.verifySession.mockImplementation(() => {
      throw new UnauthorizedException('Invalid or expired session');
    });
    const { context, request } = buildContext({ session: 'bad-token' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('allows the request through without a user when the session refers to an unknown user', async () => {
    authService.verifySession.mockReturnValue({ sub: 'missing-user' });
    usersService.findById.mockResolvedValue(null);
    const { context, request } = buildContext({ session: 'good-token' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toBeUndefined();
  });
});

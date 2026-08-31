import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { Request, Response } from 'express';
import { LinkedinService } from '../linkedin/linkedin.service';
import { UsersService } from '../users/users.service';
import {
  OIDC_COOKIE_MAX_AGE_MS,
  OIDC_NONCE_COOKIE_NAME,
  OIDC_RETURN_TO_COOKIE_NAME,
  OIDC_STATE_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from './auth.constants';
import { AuthService } from './auth.service';
import { getBaseCookieOptions } from './cookie-options.util';
import { CurrentUser } from './decorators/current-user.decorator';
import { CurrentUserDto } from './dto/current-user.dto';
import { AuthGuard } from './guards/auth.guard';
import { isSafeReturnPath } from './return-to.util';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly linkedinService: LinkedinService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Get('linkedin')
  @ApiOperation({ summary: 'Start LinkedIn login' })
  @ApiQuery({
    name: 'returnTo',
    required: false,
    description:
      'Same-site relative path to return to after login (e.g. /articles/some-slug)',
  })
  @ApiResponse({
    status: 302,
    description: "Redirects the browser to LinkedIn's authorization endpoint",
  })
  async login(
    @Query('returnTo') returnTo: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const state = this.authService.generateOidcParam();
    const nonce = this.authService.generateOidcParam();
    const cookieOptions = this.getCookieOptions();

    res.cookie(OIDC_STATE_COOKIE_NAME, state, {
      ...cookieOptions,
      maxAge: OIDC_COOKIE_MAX_AGE_MS,
    });
    res.cookie(OIDC_NONCE_COOKIE_NAME, nonce, {
      ...cookieOptions,
      maxAge: OIDC_COOKIE_MAX_AGE_MS,
    });
    if (isSafeReturnPath(returnTo)) {
      res.cookie(OIDC_RETURN_TO_COOKIE_NAME, returnTo, {
        ...cookieOptions,
        maxAge: OIDC_COOKIE_MAX_AGE_MS,
      });
    }

    const authorizationUrl = await this.linkedinService.buildAuthorizationUrl(
      state,
      nonce,
    );
    res.redirect(authorizationUrl);
  }

  @Get('linkedin/callback')
  @ApiOperation({ summary: 'Complete LinkedIn login' })
  @ApiResponse({
    status: 302,
    description:
      'Establishes the application session and redirects back to the frontend',
  })
  @ApiResponse({
    status: 401,
    description:
      'LinkedIn reported an error, or the identity could not be validated',
  })
  async callback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    if (req.query.error) {
      throw new UnauthorizedException(
        'LinkedIn reported an authorization error',
      );
    }

    const state = req.cookies?.[OIDC_STATE_COOKIE_NAME] as string | undefined;
    const nonce = req.cookies?.[OIDC_NONCE_COOKIE_NAME] as string | undefined;

    if (!state || !nonce) {
      throw new UnauthorizedException('Missing LinkedIn login state');
    }

    const returnTo = req.cookies?.[OIDC_RETURN_TO_COOKIE_NAME] as
      string | undefined;

    const identity = await this.linkedinService.exchangeCodeForIdentity(req, {
      state,
      nonce,
    });
    const user = await this.usersService.findOrCreateFromLinkedin(identity);

    const cookieOptions = this.getCookieOptions();
    res.clearCookie(OIDC_STATE_COOKIE_NAME, cookieOptions);
    res.clearCookie(OIDC_NONCE_COOKIE_NAME, cookieOptions);
    res.clearCookie(OIDC_RETURN_TO_COOKIE_NAME, cookieOptions);

    const token = this.authService.signSession(user.id);
    res.cookie(SESSION_COOKIE_NAME, token, {
      ...cookieOptions,
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
    ) as string;
    const target = isSafeReturnPath(returnTo)
      ? `${frontendUrl}${returnTo}`
      : frontendUrl;
    res.redirect(target);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiResponse({ status: 200, type: CurrentUserDto })
  @ApiResponse({ status: 401, description: 'No valid session present' })
  me(@CurrentUser() user: User): CurrentUserDto {
    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      email: user.email ?? undefined,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear the current application session' })
  @ApiResponse({ status: 204, description: 'Session cleared' })
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE_NAME, this.getCookieOptions());
  }

  private getCookieOptions() {
    return getBaseCookieOptions(this.configService.get<string>('NODE_ENV'));
  }
}

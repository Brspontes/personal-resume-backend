import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthService } from '../src/auth/auth.service';
import { AuthGuard } from '../src/auth/guards/auth.guard';
import { UsersService } from '../src/users/users.service';

@Controller('protected')
class SampleProtectedController {
  @UseGuards(AuthGuard)
  @Get()
  getSecret() {
    return { secret: 'shh' };
  }
}

describe('AuthGuard reusability by other modules (e2e)', () => {
  let app: INestApplication;
  const verifySessionMock = jest.fn();
  const findByIdMock = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SampleProtectedController],
      providers: [
        AuthGuard,
        {
          provide: AuthService,
          useValue: { verifySession: verifySessionMock },
        },
        { provide: UsersService, useValue: { findById: findByIdMock } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    verifySessionMock.mockReset();
    findByIdMock.mockReset();
  });

  it('rejects a request with no session cookie, without executing the route handler', async () => {
    await request(app.getHttpServer()).get('/protected').expect(401);
    expect(verifySessionMock).not.toHaveBeenCalled();
  });

  it('allows an authenticated request through to the route handler', async () => {
    verifySessionMock.mockReturnValue({ sub: 'user-1' });
    findByIdMock.mockResolvedValue({ id: 'user-1', name: 'Jane' });

    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Cookie', ['session=valid-token']);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ secret: 'shh' });
  });
});

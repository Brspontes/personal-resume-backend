import {
  Body,
  Controller,
  INestApplication,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { IsInt, IsString } from 'class-validator';
import request from 'supertest';

class SampleDto {
  @IsString()
  name!: string;

  @IsInt()
  age!: number;
}

@Controller('sample')
class SampleController {
  @Post()
  create(@Body() dto: SampleDto) {
    return dto;
  }
}

describe('Global ValidationPipe (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SampleController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a payload with a missing required field', () => {
    return request(app.getHttpServer())
      .post('/sample')
      .send({ name: 'test' })
      .expect(400);
  });

  it('rejects a payload with an unexpected extra property', () => {
    return request(app.getHttpServer())
      .post('/sample')
      .send({ name: 'test', age: 30, extra: 'not-allowed' })
      .expect(400);
  });

  it('accepts a payload matching the DTO', () => {
    return request(app.getHttpServer())
      .post('/sample')
      .send({ name: 'test', age: 30 })
      .expect(201);
  });
});

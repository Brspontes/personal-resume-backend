import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function createHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { url: '/api/v1/example' };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('uses the status and message from an HttpException', () => {
    const { host, status, json } = createHost();

    filter.catch(new BadRequestException('invalid payload'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'invalid payload' }),
    );
  });

  it('surfaces the status of an Express-level client error (e.g. body-parser)', () => {
    const { host, status, json } = createHost();
    const payloadTooLarge = Object.assign(
      new Error('request entity too large'),
      {
        status: 413,
      },
    );

    filter.catch(payloadTooLarge, host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 413,
        message: 'request entity too large',
      }),
    );
  });

  it('falls back to a generic 500 for an unrecognized error', () => {
    const { host, status, json } = createHost();

    filter.catch(new Error('connection lost'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
  });
});

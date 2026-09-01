import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ANALYTICS_MAX_DURATION_SECONDS,
  ANALYTICS_SESSION_ID_MAX_LENGTH,
  RecordAnalyticsEventDto,
} from './record-analytics-event.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(RecordAnalyticsEventDto, payload);
  return validate(dto);
}

describe('RecordAnalyticsEventDto', () => {
  it('accepts a valid ARTICLE_VIEW payload', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_VIEW',
      articleId: 'article-1',
      sessionId: 'session-1',
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a valid ARTICLE_PROGRESS payload', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_PROGRESS',
      articleId: 'article-1',
      sessionId: 'session-1',
      progress: 50,
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts a valid ARTICLE_READ payload', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_READ',
      articleId: 'article-1',
      sessionId: 'session-1',
      duration: 248,
      maxProgress: 87,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects an unsupported event type', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_DELETE',
      articleId: 'article-1',
      sessionId: 'session-1',
    });

    expect(errors.some((e) => e.property === 'event')).toBe(true);
  });

  it('rejects a missing articleId', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_VIEW',
      sessionId: 'session-1',
    });

    expect(errors.some((e) => e.property === 'articleId')).toBe(true);
  });

  it('rejects a missing sessionId', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_VIEW',
      articleId: 'article-1',
    });

    expect(errors.some((e) => e.property === 'sessionId')).toBe(true);
  });

  it('rejects a sessionId beyond the maximum length', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_VIEW',
      articleId: 'article-1',
      sessionId: 'x'.repeat(ANALYTICS_SESSION_ID_MAX_LENGTH + 1),
    });

    expect(errors.some((e) => e.property === 'sessionId')).toBe(true);
  });

  it('rejects a progress value outside the supported milestone set', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_PROGRESS',
      articleId: 'article-1',
      sessionId: 'session-1',
      progress: 42,
    });

    expect(errors.some((e) => e.property === 'progress')).toBe(true);
  });

  it('rejects a missing progress value for ARTICLE_PROGRESS', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_PROGRESS',
      articleId: 'article-1',
      sessionId: 'session-1',
    });

    expect(errors.some((e) => e.property === 'progress')).toBe(true);
  });

  it('rejects a negative duration for ARTICLE_READ', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_READ',
      articleId: 'article-1',
      sessionId: 'session-1',
      duration: -1,
      maxProgress: 50,
    });

    expect(errors.some((e) => e.property === 'duration')).toBe(true);
  });

  it('rejects a duration exceeding the upper bound', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_READ',
      articleId: 'article-1',
      sessionId: 'session-1',
      duration: ANALYTICS_MAX_DURATION_SECONDS + 1,
      maxProgress: 50,
    });

    expect(errors.some((e) => e.property === 'duration')).toBe(true);
  });

  it('rejects a maxProgress outside the 0-100 range', async () => {
    const errors = await validateDto({
      event: 'ARTICLE_READ',
      articleId: 'article-1',
      sessionId: 'session-1',
      duration: 100,
      maxProgress: 150,
    });

    expect(errors.some((e) => e.property === 'maxProgress')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { userIdSchema, type UserId } from './auth';

const USER_ID = '01920000-0000-7000-8000-000000000001' as UserId;

describe('userIdSchema', () => {
  it('accepts a uuid v7', () => {
    expect(userIdSchema.parse(USER_ID)).toBe(USER_ID);
  });

  it('rejects a uuid v4, which does not sort by creation time', () => {
    expect(userIdSchema.safeParse('9b2f6d1e-3c4a-4f5b-8a6d-7e8f9a0b1c2d').success).toBe(false);
  });
});

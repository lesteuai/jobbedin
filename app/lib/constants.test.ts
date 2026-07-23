import { STATUS_REASON, STATUS_REASON_MESSAGE } from './constants';

describe('STATUS_REASON', () => {
  test('OUT_OF_CREDIT is exactly "out_of_credit"', () => {
    expect(STATUS_REASON.OUT_OF_CREDIT).toBe('out_of_credit');
  });

  test('INVALID_API_KEY is exactly "invalid_api_key"', () => {
    expect(STATUS_REASON.INVALID_API_KEY).toBe('invalid_api_key');
  });
});

describe('STATUS_REASON_MESSAGE', () => {
  test('has a non-empty message for every status reason', () => {
    Object.values(STATUS_REASON).forEach((reason) => {
      expect(STATUS_REASON_MESSAGE[reason]).toBeDefined();
      expect(typeof STATUS_REASON_MESSAGE[reason]).toBe('string');
      expect(STATUS_REASON_MESSAGE[reason].length).toBeGreaterThan(0);
    });
  });

  test('messages mention Settings for user guidance', () => {
    Object.values(STATUS_REASON).forEach((reason) => {
      const message = STATUS_REASON_MESSAGE[reason];
      expect(message.toLowerCase()).toContain('settings');
    });
  });

  test('unknown keys return undefined', () => {
    expect(STATUS_REASON_MESSAGE['nope']).toBeUndefined();
    expect(STATUS_REASON_MESSAGE['']).toBeUndefined();
  });
});

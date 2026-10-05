import { describe, expect, it } from 'vitest';
import { InitDataError, signInitData, validateInitData } from '../../src/lib/telegram';

const BOT_TOKEN = '123456:TEST-BOT-TOKEN';
const user = JSON.stringify({
  id: 42,
  first_name: 'Анна',
  username: 'Anna_S',
  language_code: 'ru',
});

function sample(authDate = Math.floor(Date.now() / 1000), extra: Record<string, string> = {}) {
  return signInitData(
    { auth_date: String(authDate), query_id: 'AAE', user, start_param: 'm_maria-nails', ...extra },
    BOT_TOKEN,
  );
}

describe('validateInitData', () => {
  it('accepts correctly signed data and parses the user', () => {
    const result = validateInitData(sample(), BOT_TOKEN, 3600);
    expect(result.user.id).toBe(42);
    expect(result.user.username).toBe('Anna_S');
    expect(result.startParam).toBe('m_maria-nails');
  });

  it('rejects tampered payloads', () => {
    const tampered = sample().replace('Anna_S', 'Admin');
    expect(() => validateInitData(tampered, BOT_TOKEN, 3600)).toThrow(InitDataError);
  });

  it('rejects data signed with another bot token', () => {
    const foreign = signInitData(
      { auth_date: String(Math.floor(Date.now() / 1000)), user },
      '999:OTHER',
    );
    expect(() => validateInitData(foreign, BOT_TOKEN, 3600)).toThrow('Invalid signature');
  });

  it('rejects expired data', () => {
    const old = sample(Math.floor(Date.now() / 1000) - 7200);
    expect(() => validateInitData(old, BOT_TOKEN, 3600)).toThrow('initData expired');
  });

  it('rejects data without hash', () => {
    expect(() =>
      validateInitData(`auth_date=1&user=${encodeURIComponent(user)}`, BOT_TOKEN, 3600),
    ).toThrow('Missing hash');
  });
});

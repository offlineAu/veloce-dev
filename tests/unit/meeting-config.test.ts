import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/config/env', () => ({ env: vi.fn() }));
import { env } from '@/config/env';
import { bookingSettings, publicMeetingConfig } from '@/server/booking/config';
const configure = (values: object) => vi.mocked(env).mockReturnValue(values as ReturnType<typeof env>);
describe('booking configuration', () => {
  afterEach(() => vi.restoreAllMocks());
  it('disabled scheduling does not require account credentials', () => {
    configure({ BOOKING_ENABLED: 'false' });
    expect(publicMeetingConfig()).toEqual({ enabled: false });
  });
  it('incomplete enabled configuration offers requests while booking APIs reject it', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    configure({ BOOKING_ENABLED: 'true' });
    expect(publicMeetingConfig()).toEqual({ enabled: false });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('CAL_HOST_ID'));
    expect(() => bookingSettings()).toThrow('CAL_WEBHOOK_SECRET');
  });
  it('reports the one invalid setting without leaking credentials', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    configure({ BOOKING_ENABLED: 'true', CAL_BOOKING_URL: 'https://cal.com/veloce/intro', CAL_EVENT_TYPE_ID: '42', CAL_HOST_ID: '3437505', CAL_API_KEY: 'private-api-key', CAL_WEBHOOK_SECRET: 'private-webhook-secret', BOOKING_DURATION_MINUTES: '30', BOOKING_FORMAT: 'Video call', BOOKING_COST_LABEL: 'Approved meeting terms', BOOKING_CRON_SECRET: 'short-private-secret' });
    expect(publicMeetingConfig()).toEqual({ enabled: false });
    expect(log).toHaveBeenCalledExactlyOnceWith('Booking settings missing or invalid: BOOKING_CRON_SECRET (minimum 32 characters)');
    expect(JSON.stringify(log.mock.calls)).not.toContain('private');
  });
  it('does not expose secrets in public meeting details', () => {
    configure({ BOOKING_ENABLED: 'true', CAL_BOOKING_URL: 'https://cal.com/veloce/intro', CAL_EVENT_TYPE_ID: '42', CAL_HOST_ID: '7', CAL_API_KEY: 'test-api-secret', CAL_WEBHOOK_SECRET: 'test-webhook-secret', BOOKING_DURATION_MINUTES: '30', BOOKING_FORMAT: 'Video call', BOOKING_COST_LABEL: 'Approved meeting terms', BOOKING_CRON_SECRET: 'x'.repeat(32) });
    const dto = publicMeetingConfig();
    expect(dto).toEqual({ enabled: true, duration: 30, format: 'Video call', costLabel: 'Approved meeting terms' });
    expect(JSON.stringify(dto)).not.toContain('secret');
  });
  it('rejects a substituted provider domain or extra URL parameters', () => {
    for (const url of ['https://evil.example/veloce/intro', 'https://cal.com/veloce/intro?redirect=evil']) {
      configure({ BOOKING_ENABLED: 'false', CAL_BOOKING_URL: url });
      expect(() => publicMeetingConfig()).toThrow('CAL_BOOKING_URL');
    }
  });
});

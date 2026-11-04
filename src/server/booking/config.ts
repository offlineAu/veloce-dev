import 'server-only';
import { env } from '@/config/env';
import type { MeetingConfig } from '@/lib/meeting';
import { calEndpoints } from '@/lib/cal-endpoints';

class BookingConfigurationError extends Error {}

export function bookingSettings() {
  const e = env();
  const url = e.CAL_BOOKING_URL ? new URL(e.CAL_BOOKING_URL) : undefined;
  const endpoints = calEndpoints(e.CAL_LOCAL_MODE === 'true', e.CAL_BOOKING_URL, e.CAL_API_BASE_URL);
  const configured = Boolean(url && e.CAL_EVENT_TYPE_ID && e.CAL_HOST_ID && e.CAL_API_KEY && e.CAL_WEBHOOK_SECRET);
  const enabled = e.BOOKING_ENABLED === 'true';
  const eventTypeId = Number(e.CAL_EVENT_TYPE_ID);
  const hostId = Number(e.CAL_HOST_ID);
  const duration = Number(e.BOOKING_DURATION_MINUTES);
  if (url && (!/^\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(url.pathname) || url.search || url.hash || url.username || url.password)) {
    throw new Error('CAL_BOOKING_URL must be a single-host https://cal.com/username/event link');
  }
  if (enabled) {
    const invalid = [
      ...(!url ? ['CAL_BOOKING_URL'] : []),
      ...(!Number.isSafeInteger(eventTypeId) || eventTypeId < 1 ? ['CAL_EVENT_TYPE_ID'] : []),
      ...(!Number.isSafeInteger(hostId) || hostId < 1 ? ['CAL_HOST_ID'] : []),
      ...(!e.CAL_API_KEY ? ['CAL_API_KEY'] : []),
      ...(!e.CAL_WEBHOOK_SECRET ? ['CAL_WEBHOOK_SECRET'] : []),
      ...(!Number.isSafeInteger(duration) || duration < 1 ? ['BOOKING_DURATION_MINUTES'] : []),
      ...(!e.BOOKING_FORMAT ? ['BOOKING_FORMAT'] : []),
      ...(!e.BOOKING_COST_LABEL ? ['BOOKING_COST_LABEL'] : []),
      ...(!e.BOOKING_CRON_SECRET || e.BOOKING_CRON_SECRET.length < 32 ? ['BOOKING_CRON_SECRET (minimum 32 characters)'] : []),
    ];
    if (invalid.length) throw new BookingConfigurationError(`Booking settings missing or invalid: ${invalid.join(', ')}`);
  }
  return { enabled, configured, url, eventTypeId, hostId, duration, apiKey: e.CAL_API_KEY, webhookSecret: e.CAL_WEBHOOK_SECRET, format: e.BOOKING_FORMAT, costLabel: e.BOOKING_COST_LABEL, ...endpoints };
}
export function publicMeetingConfig(): MeetingConfig {
  try {
    const c = bookingSettings();
    return c.enabled ? { enabled: true, duration: c.duration, format: c.format, costLabel: c.costLabel } : { enabled: false };
  } catch (error) {
    // A partial account migration must not take down the public homepage.
    // Keep booking APIs strict and report only variable names in server logs.
    if (!(error instanceof BookingConfigurationError)) throw error;
    console.error(error.message);
    return { enabled: false };
  }
}

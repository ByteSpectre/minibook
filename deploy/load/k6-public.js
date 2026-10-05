/* global __ENV */
/**
 * k6 load test of the hot read paths: search, public master page and slot computation.
 *
 *   k6 run -e BASE_URL=http://localhost:4420 -e TOKEN=<client JWT> -e SLUG=maria-nails deploy/load/k6-public.js
 *
 * Get a dev token with:
 *   curl -s -XPOST localhost:4420/api/auth/dev-login -H 'content-type: application/json' -d '{"telegramId":"100001"}' | jq -r .token
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:4420';
const SLUG = __ENV.SLUG || 'maria-nails';
const headers = { Authorization: `Bearer ${__ENV.TOKEN || ''}` };

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:search}': ['p(95)<300'],
    'http_req_duration{name:page}': ['p(95)<250'],
    'http_req_duration{name:slots}': ['p(95)<400'],
  },
};

export function setup() {
  const page = http.get(`${BASE}/api/public/${SLUG}`, { headers }).json();
  const date = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  return { serviceId: page?.master?.serviceGroups?.[0]?.services?.[0]?.id, date };
}

export default function (data) {
  const search = http.get(`${BASE}/api/search/masters?page=1`, {
    headers,
    tags: { name: 'search' },
  });
  check(search, { 'search 200': (r) => r.status === 200 });

  const page = http.get(`${BASE}/api/public/${SLUG}`, { headers, tags: { name: 'page' } });
  check(page, { 'page 200': (r) => r.status === 200 });

  if (data.serviceId) {
    const slots = http.get(
      `${BASE}/api/public/${SLUG}/slots?serviceIds=${data.serviceId}&date=${data.date}`,
      { headers, tags: { name: 'slots' } },
    );
    check(slots, { 'slots 200': (r) => r.status === 200 });
  }
  sleep(1);
}

import { z } from 'zod';
import { config } from '../config';
import { badRequest } from '../lib/errors';
import { defineRouter, handle } from '../lib/http';
import { authenticate } from '../middleware/auth';

export const geoRoutes = defineRouter('/api/geo');
geoRoutes.use(authenticate);

type SuggestItem = {
  title?: { text?: string };
  subtitle?: { text?: string };
  address?: {
    formatted_address?: string;
    component?: { name?: string; kind?: string[] }[];
  };
};

function cityFromComponents(components?: { name?: string; kind?: string[] }[]): string {
  if (!components?.length) return '';
  const locality =
    components.find((c) => c.kind?.includes('locality')) ??
    components.find((c) => c.kind?.includes('area')) ??
    components.find((c) => c.kind?.includes('province'));
  return locality?.name?.trim() ?? '';
}

geoRoutes.get(
  '/suggest',
  handle(
    {
      query: z.object({
        q: z.string().trim().min(2).max(200),
        lang: z.string().trim().max(10).optional(),
      }),
    },
    async ({ query }) => {
      const key = config.yandexSuggestKey;
      if (!key) return { items: [] as const, configured: false };

      const url = new URL('https://suggest-maps.yandex.ru/v1/suggest');
      url.searchParams.set('apikey', key);
      url.searchParams.set('text', query.q);
      url.searchParams.set('lang', query.lang?.startsWith('en') ? 'en' : 'ru');
      url.searchParams.set('results', '7');
      url.searchParams.set('print_address', '1');
      url.searchParams.set('types', 'street,house,geo,locality');

      const res = (await fetch(url.toString(), {
        headers: { Referer: config.webAppUrl || 'http://localhost:5420' },
      })) as unknown as {
        ok: boolean;
        status: number;
        text: () => Promise<string>;
        json: () => Promise<unknown>;
      };
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw badRequest(
          'yandex_suggest_failed',
          `Yandex Suggest error ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
        );
      }
      const data = (await res.json()) as { results?: SuggestItem[] };
      const items = (data.results ?? [])
        .map((item) => {
          const title = item.title?.text?.trim() ?? '';
          const subtitle =
            item.subtitle?.text?.trim() || cityFromComponents(item.address?.component) || '';
          const address =
            item.address?.formatted_address?.trim() || [title, subtitle].filter(Boolean).join(', ');
          return { title, subtitle, address };
        })
        .filter((s) => s.title || s.address);
      return { items, configured: true };
    },
  ),
);

geoRoutes.get(
  '/geocode',
  handle(
    {
      query: z.object({
        q: z.string().trim().min(2).max(300),
        lang: z.string().trim().max(10).optional(),
      }),
    },
    async ({ query }) => {
      const key = config.yandexMapsKey;
      if (!key) return { lat: null, lng: null, configured: false };

      const url = new URL('https://geocode-maps.yandex.ru/1.x/');
      url.searchParams.set('apikey', key);
      url.searchParams.set('geocode', query.q);
      url.searchParams.set('format', 'json');
      url.searchParams.set('lang', query.lang?.startsWith('en') ? 'en_US' : 'ru_RU');
      url.searchParams.set('results', '1');

      const res = (await fetch(url.toString(), {
        headers: { Referer: config.webAppUrl || 'http://localhost:5420' },
      })) as unknown as {
        ok: boolean;
        status: number;
        text: () => Promise<string>;
        json: () => Promise<unknown>;
      };
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw badRequest(
          'yandex_geocode_failed',
          `Yandex Geocoder error ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
        );
      }
      const data = (await res.json()) as {
        response?: {
          GeoObjectCollection?: {
            featureMember?: { GeoObject?: { Point?: { pos?: string } } }[];
          };
        };
      };
      const pos =
        data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos?.trim();
      if (!pos) return { lat: null, lng: null, configured: true };
      const [lng, lat] = pos.split(/\s+/).map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng))
        return { lat: null, lng: null, configured: true };
      return { lat, lng, configured: true };
    },
  ),
);

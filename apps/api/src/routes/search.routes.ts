import { z } from 'zod';
import { idSchema, mapQuerySchema, searchQuerySchema } from '@nail-crm/shared';
import { defineRouter, handle } from '../lib/http';
import { authenticate } from '../middleware/auth';
import {
  listCategories,
  listCities,
  listCountries,
  searchMap,
  searchTenants,
} from '../services/search.service';

export const searchRoutes = defineRouter('/api/search');
searchRoutes.use(authenticate);

searchRoutes.get(
  '/categories',
  handle({}, () => listCategories()),
);
searchRoutes.get(
  '/countries',
  handle({}, () => listCountries()),
);
searchRoutes.get(
  '/cities',
  handle({ query: z.object({ countryId: idSchema.optional() }) }, ({ query }) =>
    listCities(query.countryId),
  ),
);
searchRoutes.get(
  '/masters',
  handle({ query: searchQuerySchema }, ({ query }) => searchTenants(query)),
);
searchRoutes.get(
  '/map',
  handle({ query: mapQuerySchema }, ({ query }) => searchMap(query)),
);

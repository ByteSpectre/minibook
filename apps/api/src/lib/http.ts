import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { idSchema } from '@nail-crm/shared';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RegisteredRoute {
  method: HttpMethod;
  path: string;
}

/**
 * Every route is registered here. The isolation test suite compares this registry with its
 * list of covered endpoints and fails when a `/api/master/*` or `/api/salon/*` route has
 * no isolation test (spec rule №6).
 */
export const routeRegistry: RegisteredRoute[] = [];

export interface DefinedRouter {
  router: Router;
  basePath: string;
  get: (path: string, ...handlers: RequestHandler[]) => DefinedRouter;
  post: (path: string, ...handlers: RequestHandler[]) => DefinedRouter;
  patch: (path: string, ...handlers: RequestHandler[]) => DefinedRouter;
  put: (path: string, ...handlers: RequestHandler[]) => DefinedRouter;
  delete: (path: string, ...handlers: RequestHandler[]) => DefinedRouter;
  use: (...handlers: RequestHandler[]) => DefinedRouter;
}

export function defineRouter(basePath: string): DefinedRouter {
  const router = Router();
  const add =
    (method: HttpMethod) =>
    (path: string, ...handlers: RequestHandler[]): DefinedRouter => {
      const fullPath = `${basePath}${path}`;
      if (!routeRegistry.some((r) => r.method === method && r.path === fullPath)) {
        routeRegistry.push({ method, path: fullPath });
      }
      const lower = method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete';
      router[lower](path, ...handlers);
      return api;
    };
  const api: DefinedRouter = {
    router,
    basePath,
    get: add('GET'),
    post: add('POST'),
    patch: add('PATCH'),
    put: add('PUT'),
    delete: add('DELETE'),
    use: (...handlers) => {
      router.use(...handlers);
      return api;
    },
  };
  return api;
}

type Infer<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface HandlerContext<B, Q, P> {
  body: B;
  query: Q;
  params: P;
  req: Request;
  res: Response;
}

export interface HandlerSpec<B, Q, P> {
  body?: B;
  query?: Q;
  params?: P;
  status?: number;
}

/**
 * Validates body/query/params with Zod and serializes the returned value as JSON.
 * Handlers that stream a response themselves should return `undefined`.
 */
export function handle<
  B extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
  P extends z.ZodType | undefined = undefined,
>(
  spec: HandlerSpec<B, Q, P>,
  fn: (ctx: HandlerContext<Infer<B>, Infer<Q>, Infer<P>>) => Promise<unknown> | unknown,
): RequestHandler {
  return async (req, res) => {
    const body = (spec.body ? spec.body.parse(req.body ?? {}) : undefined) as Infer<B>;
    const query = (spec.query ? spec.query.parse(req.query ?? {}) : undefined) as Infer<Q>;
    const params = (spec.params ? spec.params.parse(req.params ?? {}) : undefined) as Infer<P>;
    const result = await fn({ body, query, params, req, res });
    if (res.headersSent) return;
    if (result === undefined) {
      res.status(204).end();
      return;
    }
    res.status(spec.status ?? 200).json(result);
  };
}

export const idParams = z.object({ id: idSchema });
export const masterIdParams = z.object({ masterId: idSchema });
export const slugParams = z.object({ slug: z.string().trim().toLowerCase().min(1).max(64) });

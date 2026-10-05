import type { AuthContext } from '../lib/jwt';
import type { MasterTenant, SalonTenant } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      masterTenant?: MasterTenant;
      salonTenant?: SalonTenant;
    }
  }
}

export {};

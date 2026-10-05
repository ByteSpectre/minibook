import type { SeedCity } from './types';
import { AE_CITIES } from './ae';
import { AM_CITIES } from './am';
import { BY_CITIES } from './by';
import { CY_CITIES } from './cy';
import { GE_CITIES } from './ge';
import { KG_CITIES } from './kg';
import { KZ_CITIES } from './kz';
import { RS_CITIES } from './rs';
import { RU_CITIES } from './ru';
import { TR_CITIES } from './tr';
import { UZ_CITIES } from './uz';

export type { SeedCity };

export const CITIES_BY_COUNTRY: Record<string, SeedCity[]> = {
  RU: RU_CITIES,
  KZ: KZ_CITIES,
  BY: BY_CITIES,
  UZ: UZ_CITIES,
  KG: KG_CITIES,
  AM: AM_CITIES,
  GE: GE_CITIES,
  RS: RS_CITIES,
  TR: TR_CITIES,
  AE: AE_CITIES,
  CY: CY_CITIES,
};

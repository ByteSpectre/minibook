import type { DeepDict } from '../types';
import type { Dictionary } from '../ru';
import { bot } from './bot';
import { common, errors, nav, validation } from './core';
import { enums } from './enums';

export const en: DeepDict<Dictionary> = {
  common,
  nav,
  validation,
  errors,
  enums,
  bot,
};

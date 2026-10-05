import { bot } from './bot';
import { common, errors, nav, validation } from './core';
import { enums } from './enums';

export const ru = {
  common,
  nav,
  validation,
  errors,
  enums,
  bot,
};

export type Dictionary = typeof ru;

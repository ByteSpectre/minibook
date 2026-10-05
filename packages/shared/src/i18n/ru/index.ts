import { client, components, dev, publicPage, start } from './app';
import { bot } from './bot';
import { admin, checkout, master, salon } from './cabinet';
import { common, errors, nav, validation } from './core';
import { enums } from './enums';

export const ru = {
  common,
  nav,
  validation,
  errors,
  enums,
  bot,
  start,
  dev,
  components,
  client,
  public: publicPage,
  master,
  salon,
  admin,
  checkout,
};

export type Dictionary = typeof ru;

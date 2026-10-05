/** Same keys as the source dictionary, every leaf is a string. */
export type DeepDict<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepDict<T[K]>;
};

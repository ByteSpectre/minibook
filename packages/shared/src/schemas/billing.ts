import { z } from 'zod';

export const createPaymentSchema = z.object({
  autoRenew: z.boolean().default(true),
});
export type CreatePaymentInput = z.input<typeof createPaymentSchema>;

export const applyPromoSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .transform((v) => v.toUpperCase()),
});

export const autoRenewSchema = z.object({ enabled: z.boolean() });

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config';
import { logger } from '../../logger';

const API_URL = 'https://api.yookassa.ru/v3';

export const yooPaymentSchema = z
  .object({
    id: z.string(),
    status: z.enum(['pending', 'waiting_for_capture', 'succeeded', 'canceled']),
    paid: z.boolean().optional(),
    amount: z.object({ value: z.string(), currency: z.string() }),
    confirmation: z
      .object({ type: z.string(), confirmation_url: z.string().optional() })
      .passthrough()
      .optional(),
    payment_method: z
      .object({
        id: z.string(),
        saved: z.boolean().optional(),
        type: z.string().optional(),
        title: z.string().optional(),
      })
      .passthrough()
      .optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    cancellation_details: z.object({ party: z.string(), reason: z.string() }).optional(),
  })
  .passthrough();
export type YooPayment = z.infer<typeof yooPaymentSchema>;

export const yooRefundSchema = z
  .object({
    id: z.string(),
    payment_id: z.string(),
    status: z.string(),
    amount: z.object({ value: z.string(), currency: z.string() }),
  })
  .passthrough();

export const yooNotificationSchema = z.object({
  type: z.literal('notification'),
  event: z.string(),
  object: z.record(z.string(), z.unknown()),
});
export type YooNotification = z.infer<typeof yooNotificationSchema>;

export interface CreateYooPaymentInput {
  amountRub: number;
  description: string;
  returnUrl: string | null;
  savePaymentMethod: boolean;
  paymentMethodId?: string;
  metadata: Record<string, string>;
  receiptCustomer?: { email?: string; phone?: string };
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${env.YOOKASSA_SHOP_ID}:${env.YOOKASSA_SECRET_KEY}`).toString('base64')}`;
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(method === 'POST' ? { 'Idempotence-Key': randomUUID() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    logger.error({ status: res.status, body: json, path }, 'YooKassa API error');
    throw new Error(`YooKassa API error ${res.status}`);
  }
  return schema.parse(json);
}

export async function createYooPayment(input: CreateYooPaymentInput): Promise<YooPayment> {
  const value = input.amountRub.toFixed(2);
  const body: Record<string, unknown> = {
    amount: { value, currency: 'RUB' },
    capture: true,
    description: input.description.slice(0, 128),
    metadata: input.metadata,
  };
  if (input.paymentMethodId) {
    body.payment_method_id = input.paymentMethodId;
  } else {
    body.confirmation = { type: 'redirect', return_url: input.returnUrl };
    if (input.savePaymentMethod) body.save_payment_method = true;
  }
  if (env.YOOKASSA_ENABLE_RECEIPTS) {
    const customer =
      input.receiptCustomer?.email || input.receiptCustomer?.phone
        ? input.receiptCustomer
        : { email: env.YOOKASSA_DEFAULT_RECEIPT_EMAIL };
    body.receipt = {
      customer: { ...customer, ...(env.YOOKASSA_INN ? { inn: env.YOOKASSA_INN } : {}) },
      items: [
        {
          description: input.description.slice(0, 128),
          quantity: '1.00',
          amount: { value, currency: 'RUB' },
          vat_code: env.YOOKASSA_VAT_CODE,
          payment_mode: 'full_payment',
          payment_subject: 'service',
        },
      ],
    };
  }
  return request('POST', '/payments', yooPaymentSchema, body);
}

export async function getYooPayment(id: string): Promise<YooPayment> {
  return request('GET', `/payments/${encodeURIComponent(id)}`, yooPaymentSchema);
}

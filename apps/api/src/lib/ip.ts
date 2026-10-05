import { BlockList, isIP } from 'node:net';
import { YOOKASSA_IP_RANGES } from '@nail-crm/shared';

function buildList(ranges: readonly string[]): BlockList {
  const list = new BlockList();
  for (const range of ranges) {
    const [address, prefix] = range.split('/');
    if (!address || !prefix) continue;
    list.addSubnet(address, Number(prefix), isIP(address) === 6 ? 'ipv6' : 'ipv4');
  }
  return list;
}

const yookassaList = buildList(YOOKASSA_IP_RANGES);

export function normalizeIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  return trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
}

export function isYooKassaIp(ip: string | undefined | null): boolean {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;
  const family = isIP(normalized);
  if (family === 0) return false;
  return yookassaList.check(normalized, family === 6 ? 'ipv6' : 'ipv4');
}

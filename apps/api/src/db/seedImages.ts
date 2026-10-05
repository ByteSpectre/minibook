import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PALETTES: [string, string][] = [
  ['#ff9a9e', '#fecfef'],
  ['#a18cd1', '#fbc2eb'],
  ['#fbc2eb', '#a6c1ee'],
  ['#84fab0', '#8fd3f4'],
  ['#f6d365', '#fda085'],
  ['#ffecd2', '#fcb69f'],
  ['#c2e9fb', '#a1c4fd'],
  ['#d4fc79', '#96e6a1'],
  ['#e0c3fc', '#8ec5fc'],
  ['#fddb92', '#d1fdff'],
];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

function palette(seed: string): [string, string] {
  return PALETTES[hash(seed) % PALETTES.length]!;
}

async function save(uploadDir: string, key: string, svg: string, size: number): Promise<string> {
  const file = path.resolve(uploadDir, key);
  await mkdir(path.dirname(file), { recursive: true });
  const data = await sharp(Buffer.from(svg)).resize(size, size).webp({ quality: 86 }).toBuffer();
  await writeFile(file, data);
  return `/uploads/${key}`;
}

/** Initials on a soft gradient — used for seeded avatars. */
export async function avatarImage(
  uploadDir: string,
  key: string,
  initials: string,
): Promise<string> {
  const [a, b] = palette(key);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="512" height="512" fill="url(#g)"/>
    <circle cx="420" cy="90" r="120" fill="#ffffff" opacity="0.18"/>
    <circle cx="80" cy="460" r="150" fill="#ffffff" opacity="0.12"/>
    <text x="256" y="300" font-family="DejaVu Sans, Arial, sans-serif" font-size="190" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.95">${initials}</text>
  </svg>`;
  return save(uploadDir, `seed/avatars/${key}.webp`, svg, 512);
}

/** Abstract glossy "nail art" — service previews and work photos. */
export async function artImage(
  uploadDir: string,
  key: string,
  variant: 'service' | 'before' | 'after' | 'review',
): Promise<string> {
  const [a, b] = palette(`${key}-${variant}`);
  const h = hash(key);
  const circles = Array.from({ length: 7 }, (_, i) => {
    const x = (h >> (i * 3)) % 800;
    const y = (h >> (i * 2 + 5)) % 800;
    const r = 60 + ((h >> i) % 140);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="${variant === 'before' ? 0.08 : 0.22}"/>`;
  }).join('');
  const shine =
    variant === 'before'
      ? ''
      : `<ellipse cx="300" cy="260" rx="220" ry="90" fill="#ffffff" opacity="0.35" transform="rotate(-25 300 260)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${variant === 'before' ? '#d7d2cc' : a}"/><stop offset="1" stop-color="${variant === 'before' ? '#a4a09b' : b}"/></linearGradient></defs>
    <rect width="800" height="800" fill="url(#g)"/>${circles}${shine}
  </svg>`;
  return save(uploadDir, `seed/${variant}/${key}.webp`, svg, variant === 'service' ? 400 : 900);
}

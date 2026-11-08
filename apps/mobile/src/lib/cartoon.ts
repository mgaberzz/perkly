/**
 * Perkly cartoon avatar (Bitmoji-style), drawn as SVG from a small set of choices.
 * Every value is picked from the fixed lists below (unknown values fall back to the default),
 * so the SVG text is always safe to render. Keep this file identical in apps/mobile and apps/web.
 */

export const SKIN = ['#FFE0C7', '#F9D3B4', '#EEBB94', '#E0A77F', '#C98B62', '#A86E4A', '#8A5435', '#5E3A24'];
export const HAIR_COLORS = ['#1F1A17', '#3B2A20', '#6B4226', '#A0662B', '#D8A657', '#E9D3A0', '#B5462E', '#8E8E93', '#7B2FF7', '#FF3EA5'];
export const OUTFIT_COLORS = ['#7B2FF7', '#FF3EA5', '#2F80FF', '#10B981', '#F59E0B', '#EF4444', '#16131F', '#FFFFFF', '#94A3B8', '#0EA5E9'];
export const HIJAB_COLORS = ['#16131F', '#F5F0E8', '#C9A27E', '#7B2FF7', '#FF3EA5', '#2F80FF', '#0F766E', '#9F1239'];
export const BG_COLORS = ['#EDE4FF', '#FFE1F0', '#DCEBFF', '#D7F5E8', '#FFF1D6', '#FFE0DC', '#E9E9EF', '#7B2FF7'];

export const OPTIONS = {
  face: ['oval', 'round', 'long'],
  hair: ['short', 'side', 'buzz', 'curly', 'quiff', 'long', 'bob', 'bun', 'afro', 'ponytail', 'bald'],
  eyes: ['normal', 'happy', 'wink', 'big', 'sleepy', 'lashes'],
  brows: ['natural', 'raised', 'thick', 'none'],
  mouth: ['smile', 'grin', 'laugh', 'neutral', 'smirk', 'tongue'],
  facial: ['none', 'stubble', 'beard', 'mustache', 'goatee'],
  glasses: ['none', 'round', 'square', 'sunnies', 'cateye'],
  headwear: ['none', 'hijab', 'cap', 'beanie'],
  outfit: ['tee', 'hoodie', 'shirt', 'sweater', 'jacket'],
  blush: ['on', 'off'],
} as const;

export type CartoonConfig = {
  skin: number; face: string; hair: string; hairColor: number; eyes: string; brows: string; mouth: string;
  facial: string; glasses: string; headwear: string; hijabColor: number; outfit: string; outfitColor: number; bg: number; blush: string;
};

export const DEFAULT_CARTOON: CartoonConfig = {
  skin: 2, face: 'oval', hair: 'short', hairColor: 1, eyes: 'normal', brows: 'natural', mouth: 'smile', facial: 'none',
  glasses: 'none', headwear: 'none', hijabColor: 0, outfit: 'hoodie', outfitColor: 0, bg: 0, blush: 'on',
};

const pick = <T extends readonly string[]>(list: T, v: unknown, d: string) => (typeof v === 'string' && (list as readonly string[]).includes(v) ? v : d);
const idx = (len: number, v: unknown, d: number) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < len ? (v as number) : d);

/** Turn anything (e.g. JSON from the database) into a valid config */
export function cleanCartoon(raw: unknown): CartoonConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const D = DEFAULT_CARTOON;
  return {
    skin: idx(SKIN.length, r.skin, D.skin), face: pick(OPTIONS.face, r.face, D.face), hair: pick(OPTIONS.hair, r.hair, D.hair),
    hairColor: idx(HAIR_COLORS.length, r.hairColor, D.hairColor), eyes: pick(OPTIONS.eyes, r.eyes, D.eyes), brows: pick(OPTIONS.brows, r.brows, D.brows),
    mouth: pick(OPTIONS.mouth, r.mouth, D.mouth), facial: pick(OPTIONS.facial, r.facial, D.facial), glasses: pick(OPTIONS.glasses, r.glasses, D.glasses),
    headwear: pick(OPTIONS.headwear, r.headwear, D.headwear), hijabColor: idx(HIJAB_COLORS.length, r.hijabColor, D.hijabColor),
    outfit: pick(OPTIONS.outfit, r.outfit, D.outfit), outfitColor: idx(OUTFIT_COLORS.length, r.outfitColor, D.outfitColor),
    bg: idx(BG_COLORS.length, r.bg, D.bg), blush: pick(OPTIONS.blush, r.blush, D.blush),
  };
}

export function randomCartoon(): CartoonConfig {
  const any = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
  const head = Math.random() < 0.18 ? 'hijab' : Math.random() < 0.15 ? any(['cap', 'beanie']) : 'none';
  return cleanCartoon({
    skin: Math.floor(Math.random() * SKIN.length), face: any(OPTIONS.face), hair: any(OPTIONS.hair.filter((h) => h !== 'bald' || Math.random() < 0.3)),
    hairColor: Math.floor(Math.random() * 7), eyes: any(OPTIONS.eyes), brows: any(['natural', 'raised', 'thick']), mouth: any(OPTIONS.mouth),
    facial: Math.random() < 0.35 ? any(OPTIONS.facial) : 'none', glasses: Math.random() < 0.3 ? any(OPTIONS.glasses) : 'none', headwear: head,
    hijabColor: Math.floor(Math.random() * HIJAB_COLORS.length), outfit: any(OPTIONS.outfit), outfitColor: Math.floor(Math.random() * OUTFIT_COLORS.length),
    bg: Math.floor(Math.random() * BG_COLORS.length), blush: 'on',
  });
}

/** Darken/lighten a hex colour */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * (amt < 0 ? c : 255 - c))));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** The SVG (viewBox 0 0 200 200). `bust` = with shoulders; false = face only, for small icons. */
export function cartoonSvg(input: unknown, opts: { background?: boolean } = {}): string {
  const c = cleanCartoon(input);
  const skin = SKIN[c.skin], skinD = shade(skin, -0.18), skinL = shade(skin, 0.25);
  const hair = HAIR_COLORS[c.hairColor], hairD = shade(hair, -0.3), hairL = shade(hair, 0.18);
  const cloth = OUTFIT_COLORS[c.outfitColor], clothD = shade(cloth, -0.22);
  const hijab = HIJAB_COLORS[c.hijabColor], hijabD = shade(hijab, -0.2);
  const ink = '#2A1E1A';
  const hijabOn = c.headwear === 'hijab';
  const rx = c.face === 'round' ? 47 : c.face === 'long' ? 41 : 44, ry = c.face === 'round' ? 47 : c.face === 'long' ? 53 : 50;
  const cy = 88;
  const s: string[] = [];

  if (opts.background !== false) s.push(`<rect width="200" height="200" fill="${BG_COLORS[c.bg]}"/>`);

  // ── behind the head
  if (hijabOn) s.push(`<path d="M40 104 Q34 22 100 20 Q166 22 160 104 L170 200 L30 200 Z" fill="${hijab}"/>`);
  else if (c.hair === 'long') s.push(`<path d="M50 84 Q46 26 100 28 Q154 26 150 84 L156 156 Q132 166 118 146 L82 146 Q68 166 44 156 Z" fill="${hairD}"/>`);
  else if (c.hair === 'bob') s.push(`<path d="M48 88 Q44 28 100 28 Q156 28 152 88 L154 128 Q140 138 128 126 L72 126 Q60 138 46 128 Z" fill="${hairD}"/>`);
  else if (c.hair === 'afro') s.push(`<circle cx="100" cy="74" r="66" fill="${hair}"/><circle cx="100" cy="74" r="66" fill="none" stroke="${hairD}" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>`);
  else if (c.hair === 'ponytail') s.push(`<path d="M138 56 Q178 70 162 140 Q156 110 140 92 Z" fill="${hairD}"/>`);
  if (c.hair === 'bun' && !hijabOn && c.headwear !== 'cap' && c.headwear !== 'beanie') s.push(`<circle cx="100" cy="30" r="19" fill="${hair}"/><path d="M86 26 Q100 18 114 26" stroke="${hairD}" stroke-width="3" fill="none"/>`);

  // ── body
  s.push(`<path d="M24 200 Q24 156 66 146 Q100 138 134 146 Q176 156 176 200 Z" fill="${cloth}"/>`);
  if (c.outfit === 'hoodie') s.push(`<path d="M62 150 Q100 182 138 150 Q130 140 100 142 Q70 140 62 150 Z" fill="${clothD}"/><path d="M90 160 L88 186 M110 160 L112 186" stroke="${cloth === '#FFFFFF' ? '#94A3B8' : '#fff'}" stroke-width="3" stroke-linecap="round"/>`);
  if (c.outfit === 'shirt') s.push(`<path d="M80 146 L100 170 L120 146 L112 140 L100 152 L88 140 Z" fill="#fff"/><path d="M100 170 L100 200" stroke="${clothD}" stroke-width="2"/><circle cx="100" cy="180" r="2" fill="${clothD}"/><circle cx="100" cy="192" r="2" fill="${clothD}"/>`);
  if (c.outfit === 'sweater') s.push(`<path d="M76 146 Q100 166 124 146" stroke="${clothD}" stroke-width="7" fill="none" stroke-linecap="round"/>`);
  if (c.outfit === 'jacket') s.push(`<path d="M84 146 L100 200 L116 146 Q100 154 84 146 Z" fill="#fff"/><path d="M84 146 L76 176 L94 172 Z M116 146 L124 176 L106 172 Z" fill="${clothD}"/>`);

  // ── neck + head
  s.push(`<path d="M84 120 L84 146 Q100 158 116 146 L116 120 Z" fill="${skinD}"/>`);
  if (!hijabOn) s.push(`<ellipse cx="${100 - rx - 1}" cy="96" rx="9" ry="11" fill="${skin}"/><ellipse cx="${100 + rx + 1}" cy="96" rx="9" ry="11" fill="${skin}"/><ellipse cx="${100 - rx - 1}" cy="96" rx="4" ry="6" fill="${skinD}"/><ellipse cx="${100 + rx + 1}" cy="96" rx="4" ry="6" fill="${skinD}"/>`);
  s.push(`<ellipse cx="100" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}"/>`);
  s.push(`<ellipse cx="86" cy="${cy - 26}" rx="16" ry="8" fill="${skinL}" opacity="0.35"/>`);

  // ── facial hair
  if (c.facial === 'stubble') s.push(`<path d="M${100 - rx + 4} 100 Q${100 - rx + 8} ${cy + ry - 2} 100 ${cy + ry} Q${100 + rx - 8} ${cy + ry - 2} ${100 + rx - 4} 100 Q${100 + rx - 10} 128 100 130 Q${100 - rx + 10} 128 ${100 - rx + 4} 100 Z" fill="${hair}" opacity="0.28"/>`);
  if (c.facial === 'beard') s.push(`<path d="M${100 - rx + 2} 96 Q${100 - rx + 4} ${cy + ry + 6} 100 ${cy + ry + 10} Q${100 + rx - 4} ${cy + ry + 6} ${100 + rx - 2} 96 Q${100 + rx - 8} 126 112 124 Q100 120 88 124 Q${100 - rx + 8} 126 ${100 - rx + 2} 96 Z" fill="${hair}"/>`);
  if (c.facial === 'goatee') s.push(`<path d="M90 126 Q100 ${cy + ry + 8} 110 126 Q100 130 90 126 Z" fill="${hair}"/>`);
  if (c.facial === 'mustache' || c.facial === 'beard' || c.facial === 'goatee') s.push(`<path d="M84 113 Q92 106 100 111 Q108 106 116 113 Q108 116 100 114 Q92 116 84 113 Z" fill="${hairD}"/>`);

  // ── eyes
  const eye = (x: number, kind: string) => {
    const y = 93;
    if (kind === 'happy') return `<path d="M${x - 7} ${y + 2} Q${x} ${y - 7} ${x + 7} ${y + 2}" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    if (kind === 'sleepy') return `<path d="M${x - 7} ${y} Q${x} ${y + 6} ${x + 7} ${y}" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M${x - 8} ${y - 1} L${x + 8} ${y - 1}" stroke="${skinD}" stroke-width="2" stroke-linecap="round"/>`;
    if (kind === 'big') return `<ellipse cx="${x}" cy="${y}" rx="8" ry="9" fill="#fff"/><circle cx="${x}" cy="${y + 1}" r="5.5" fill="${ink}"/><circle cx="${x + 2}" cy="${y - 1.5}" r="2" fill="#fff"/>`;
    const lash = kind === 'lashes' ? `<path d="M${x - 6} ${y - 5} L${x - 9} ${y - 9} M${x} ${y - 7} L${x} ${y - 11} M${x + 6} ${y - 5} L${x + 9} ${y - 9}" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>` : '';
    return `<ellipse cx="${x}" cy="${y}" rx="5" ry="6.2" fill="${ink}"/><circle cx="${x + 1.6}" cy="${y - 2}" r="1.8" fill="#fff"/>${lash}`;
  };
  s.push(eye(82, c.eyes));
  s.push(c.eyes === 'wink' ? `<path d="M111 95 Q118 89 125 95" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>` : eye(118, c.eyes === 'wink' ? 'normal' : c.eyes));

  // ── brows
  if (c.brows !== 'none') {
    const w = c.brows === 'thick' ? 5.5 : 3.6, lift = c.brows === 'raised' ? -5 : 0, col = hijabOn ? HAIR_COLORS[Math.min(c.hairColor, 2)] : hairD;
    s.push(`<path d="M73 ${79 + lift} Q82 ${74 + lift} 91 ${78 + lift}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`);
    s.push(`<path d="M109 ${78 + lift} Q118 ${74 + lift} 127 ${79 + lift}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`);
  }

  // ── nose, blush, mouth
  s.push(`<path d="M100 98 Q95 107 101 109" stroke="${skinD}" stroke-width="3" fill="none" stroke-linecap="round"/>`);
  if (c.blush === 'on') s.push(`<ellipse cx="74" cy="108" rx="8" ry="5" fill="#FF6B8B" opacity="0.28"/><ellipse cx="126" cy="108" rx="8" ry="5" fill="#FF6B8B" opacity="0.28"/>`);
  const m = c.mouth;
  if (m === 'smile') s.push(`<path d="M88 117 Q100 127 112 117" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`);
  if (m === 'grin') s.push(`<path d="M86 115 Q100 131 114 115 Z" fill="#fff" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`);
  if (m === 'laugh') s.push(`<path d="M85 114 Q100 138 115 114 Z" fill="#6E1F2B" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M92 126 Q100 121 108 126 Q104 132 100 132 Q96 132 92 126 Z" fill="#FF7A8A"/><path d="M87 115 L113 115 L111 119 L89 119 Z" fill="#fff"/>`);
  if (m === 'neutral') s.push(`<path d="M91 120 L109 120" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`);
  if (m === 'smirk') s.push(`<path d="M90 120 Q104 123 113 114" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`);
  if (m === 'tongue') s.push(`<path d="M88 117 Q100 127 112 117" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M95 122 Q95 132 101 132 Q107 132 106 122 Z" fill="#FF7A8A" stroke="${ink}" stroke-width="2"/>`);

  // ── hair on top (hidden under a hijab)
  if (!hijabOn) {
    const H = (d: string, extra = '') => s.push(`<path d="${d}" fill="${hair}"/>${extra}`);
    const shine = (d: string) => `<path d="${d}" stroke="${hairL}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6"/>`;
    if (c.hair === 'short' || c.hair === 'bun' || c.hair === 'ponytail') H('M55 86 Q50 34 100 33 Q150 34 145 86 Q140 62 118 56 Q96 66 72 60 Q60 68 55 86 Z', shine('M76 44 Q92 38 108 40'));
    if (c.hair === 'side') H('M54 90 Q48 32 104 32 Q152 36 146 88 Q141 60 124 52 Q100 72 60 62 Q56 74 54 90 Z', shine('M84 42 Q104 36 124 44'));
    if (c.hair === 'buzz') s.push(`<path d="M58 78 Q60 40 100 38 Q140 40 142 78 Q130 56 100 54 Q70 56 58 78 Z" fill="${hair}" opacity="0.85"/>`);
    if (c.hair === 'quiff') H('M56 84 Q52 40 84 30 Q96 14 124 24 Q150 34 144 84 Q138 60 120 54 Q96 60 72 58 Q60 66 56 84 Z', shine('M92 28 Q110 20 126 30'));
    if (c.hair === 'curly' || c.hair === 'afro') {
      const r = c.hair === 'afro' ? 15 : 11;
      const pts = [[56, 80], [60, 62], [70, 48], [84, 39], [100, 36], [116, 39], [130, 48], [140, 62], [144, 80]];
      s.push(`<path d="M56 84 Q52 38 100 36 Q148 38 144 84 Q136 62 100 58 Q64 62 56 84 Z" fill="${hair}"/>`);
      pts.forEach(([x, y]) => s.push(`<circle cx="${x}" cy="${y - (c.hair === 'afro' ? 4 : 0)}" r="${r}" fill="${hair}"/>`));
      [[76, 50], [100, 44], [124, 50]].forEach(([x, y]) => s.push(`<path d="M${x - 5} ${y} q5 -6 10 0" stroke="${hairL}" stroke-width="2.5" fill="none" opacity="0.6"/>`));
    }
    if (c.hair === 'long' || c.hair === 'bob') H('M52 92 Q46 30 100 30 Q154 30 148 92 Q144 64 128 54 Q112 70 88 60 Q70 70 60 64 Q54 76 52 92 Z', shine('M80 42 Q100 34 120 42'));
  }

  // ── headwear
  if (hijabOn) {
    s.push(`<path d="M${100 - rx - 4} 92 Q${100 - rx - 6} 34 100 32 Q${100 + rx + 6} 34 ${100 + rx + 4} 92 Q${100 + rx - 4} 58 100 54 Q${100 - rx + 4} 58 ${100 - rx - 4} 92 Z" fill="${hijab}"/>`);
    s.push(`<path d="M${100 - rx - 4} 90 Q${100 - rx - 2} 128 76 146 L70 150 Q${100 - rx - 12} 126 ${100 - rx - 4} 90 Z" fill="${hijab}"/><path d="M${100 + rx + 4} 90 Q${100 + rx + 2} 128 124 146 L130 150 Q${100 + rx + 12} 126 ${100 + rx + 4} 90 Z" fill="${hijab}"/>`);
    s.push(`<path d="M70 150 Q100 168 130 150 L134 162 Q100 180 66 162 Z" fill="${hijabD}"/>`);
    s.push(`<path d="M64 60 Q100 40 136 60" stroke="${hijabD}" stroke-width="2" fill="none" opacity="0.5"/>`);
  }
  if (c.headwear === 'cap') s.push(`<path d="M53 76 Q52 30 100 30 Q148 30 147 76 Z" fill="${cloth}"/><path d="M52 74 Q100 62 166 78 Q150 88 52 80 Z" fill="${clothD}"/><circle cx="100" cy="31" r="4" fill="${clothD}"/>`);
  if (c.headwear === 'beanie') s.push(`<path d="M52 78 Q50 26 100 26 Q150 26 148 78 Z" fill="${cloth}"/><rect x="48" y="66" width="104" height="18" rx="9" fill="${clothD}"/><circle cx="100" cy="24" r="10" fill="${clothD}"/>`);

  // ── glasses
  const g = c.glasses;
  if (g === 'round') s.push(`<circle cx="82" cy="93" r="12" fill="none" stroke="${ink}" stroke-width="3"/><circle cx="118" cy="93" r="12" fill="none" stroke="${ink}" stroke-width="3"/><path d="M94 92 Q100 88 106 92" stroke="${ink}" stroke-width="3" fill="none"/>`);
  if (g === 'square') s.push(`<rect x="69" y="83" width="26" height="20" rx="5" fill="none" stroke="${ink}" stroke-width="3"/><rect x="105" y="83" width="26" height="20" rx="5" fill="none" stroke="${ink}" stroke-width="3"/><path d="M95 91 L105 91" stroke="${ink}" stroke-width="3"/>`);
  if (g === 'sunnies') s.push(`<path d="M67 84 L97 84 Q97 104 82 104 Q67 104 67 84 Z" fill="#16131F"/><path d="M103 84 L133 84 Q133 104 118 104 Q103 104 103 84 Z" fill="#16131F"/><path d="M97 87 L103 87" stroke="#16131F" stroke-width="3"/><path d="M72 88 L78 88" stroke="#ffffff" stroke-width="2" opacity="0.6" stroke-linecap="round"/>`);
  if (g === 'cateye') s.push(`<path d="M66 82 Q82 80 96 86 Q96 102 82 102 Q68 102 66 82 Z" fill="none" stroke="#FF3EA5" stroke-width="3"/><path d="M134 82 Q118 80 104 86 Q104 102 118 102 Q132 102 134 82 Z" fill="none" stroke="#FF3EA5" stroke-width="3"/><path d="M96 89 L104 89" stroke="#FF3EA5" stroke-width="3"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${s.join('')}</svg>`;
}

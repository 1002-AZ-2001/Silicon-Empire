/** Brand of the company: a colour and an emblem, shown in the header and on the shipping docks. */
export const BRAND_COLORS = ['lime', 'amber', 'sky', 'rose', 'violet', 'slate'] as const;
export type BrandColor = (typeof BRAND_COLORS)[number];
export const BRAND_EMBLEMS = ['chip', 'bolt', 'gear', 'wave', 'star', 'cube'] as const;
export type BrandEmblem = (typeof BRAND_EMBLEMS)[number];

export const BRAND_HEX: Readonly<Record<BrandColor, string>> = {
  lime: '#bde778', amber: '#f0b24a', sky: '#8cc8ff', rose: '#ff8fa8', violet: '#b9a2ff', slate: '#a9b8b2',
};

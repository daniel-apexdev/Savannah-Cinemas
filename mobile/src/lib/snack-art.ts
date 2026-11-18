/**
 * Drawn illustrations for the snack menu, used whenever an item has no
 * photo yet (or its photo fails to load). Picked by keywords in the
 * item's name, then by category. Original artwork, 100 × 100.
 */
const tile = (bg: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="6" fill="${bg}"/>${body}</svg>`;

const popcorn = (stripe: string) => `
  <g fill="#FFF4D6"><circle cx="34" cy="36" r="9"/><circle cx="50" cy="29" r="10"/><circle cx="66" cy="36" r="9"/><circle cx="42" cy="26" r="7"/><circle cx="58" cy="25" r="7"/></g>
  <g fill="#F2C14E"><circle cx="39" cy="31" r="3"/><circle cx="60" cy="29" r="3"/><circle cx="51" cy="36" r="2.5"/></g>
  <path d="M28 40 h44 l-6 44 h-32 z" fill="#F1E8D6"/>
  <path d="M36 40 l3 44 h7 l-1 -44 z M55 40 l-1 44 h7 l3 -44 z" fill="${stripe}"/>`;

const bottle = (liquid: string, label: string) => `
  <path d="M44 14 h12 v10 q0 4 4 9 q4 5 4 12 v38 q0 5 -5 5 h-18 q-5 0 -5 -5 v-38 q0 -7 4 -12 q4 -5 4 -9 z" fill="${liquid}"/>
  <rect x="43" y="10" width="14" height="6" rx="1.5" fill="#A89F8E"/>
  <rect x="36" y="50" width="28" height="18" rx="2" fill="${label}"/>
  <path d="M42 22 v14" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.35"/>`;

const cup = (liquid: string, rim: string) => `
  <path d="M30 30 h40 l-5 56 h-30 z" fill="${rim}"/>
  <path d="M33 40 h34 l-3.5 40 h-27 z" fill="${liquid}"/>
  <rect x="27" y="25" width="46" height="7" rx="3" fill="#F1E8D6"/>
  <path d="M56 25 l8 -16" stroke="#E0562B" stroke-width="4" stroke-linecap="round"/>`;

const ART: { match: RegExp; svg: string }[] = [
  { match: /caramel/i, svg: tile('#3B2A1E', popcorn('#C9772B')) },
  { match: /combo|feast/i, svg: tile('#2E5E4E', `<g transform="translate(-14 4) scale(0.9)">${popcorn('#E0562B')}</g><g transform="translate(30 14) scale(0.7)">${cup('#3A1A10', '#E0562B')}</g>`) },
  { match: /popcorn/i, svg: tile('#7A2E2E', popcorn('#E0562B')) },
  { match: /red bull|energy/i, svg: tile('#1E3A6B', `<rect x="36" y="16" width="28" height="70" rx="5" fill="#C9CED6"/><rect x="36" y="30" width="28" height="40" fill="#2B4C8C"/><circle cx="50" cy="50" r="8" fill="#F2C14E"/><rect x="38" y="14" width="24" height="5" rx="2" fill="#A0A6AE"/>`) },
  { match: /water/i, svg: tile('#4F7CA8', bottle('#CFE6F2', '#4F7CA8')) },
  { match: /sobolo|hibiscus/i, svg: tile('#3B2F4A', cup('#8E1B3A', '#F1E8D6')) },
  { match: /juice|pineapple/i, svg: tile('#2E5E4E', cup('#F2C14E', '#F1E8D6')) },
  { match: /malt/i, svg: tile('#3B2A1E', bottle('#2A1A10', '#F2C14E')) },
  { match: /fanta|orange/i, svg: tile('#E07A2B', bottle('#F59A2B', '#2B6CB0')) },
  { match: /sprite|lemon/i, svg: tile('#2E6B4E', bottle('#BFE3C8', '#2E8B57')) },
  { match: /\bcola\b|\bcoke\b/i, svg: tile('#8E1B1B', bottle('#3A1A10', '#E0413A')) },
  {
    match: /nacho/i,
    svg: tile(
      '#E0562B',
      `<ellipse cx="50" cy="70" rx="36" ry="12" fill="#12100D" opacity="0.25"/>
       <g fill="#F2C14E"><path d="M20 66 l18 -30 l10 32 z"/><path d="M40 68 l14 -36 l14 34 z"/><path d="M60 66 l14 -26 l8 28 z"/><path d="M30 72 l26 -18 l6 20 z"/></g>
       <path d="M30 52 q10 8 20 0 q10 -8 20 2 q-4 12 -20 12 q-16 0 -20 -14 z" fill="#FFD25A"/>
       <circle cx="42" cy="56" r="3" fill="#3E8A3E"/><circle cx="60" cy="54" r="3" fill="#3E8A3E"/>`,
    ),
  },
  {
    match: /hot ?dog|sausage/i,
    svg: tile(
      '#4F7CA8',
      `<path d="M16 54 q34 -22 68 0 q-4 18 -34 18 q-30 0 -34 -18 z" fill="#E8B04A"/>
       <rect x="14" y="44" width="72" height="14" rx="7" fill="#A8402A"/>
       <path d="M22 50 q6 -5 12 0 q6 5 12 0 q6 -5 12 0 q6 5 12 0 q6 -5 8 0" stroke="#F2C14E" stroke-width="3" fill="none" stroke-linecap="round"/>
       <path d="M18 48 q32 -14 64 0" stroke="#F7D99A" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.6"/>`,
    ),
  },
  {
    match: /kelewele|plantain/i,
    svg: tile(
      '#2E5E4E',
      `<path d="M22 46 h56 l-6 34 q-1 6 -7 6 h-30 q-6 0 -7 -6 z" fill="#F1E8D6"/>
       <g fill="#D9772B"><rect x="28" y="30" width="14" height="14" rx="3" transform="rotate(-12 35 37)"/><rect x="44" y="26" width="14" height="14" rx="3" transform="rotate(8 51 33)"/><rect x="58" y="31" width="14" height="14" rx="3" transform="rotate(-6 65 38)"/><rect x="36" y="38" width="14" height="12" rx="3" transform="rotate(14 43 44)"/><rect x="52" y="38" width="14" height="12" rx="3"/></g>
       <g fill="#7A3B1E"><circle cx="34" cy="35" r="1.4"/><circle cx="52" cy="31" r="1.4"/><circle cx="66" cy="37" r="1.4"/><circle cx="46" cy="44" r="1.4"/></g>`,
    ),
  },
  {
    match: /wing|chicken/i,
    svg: tile(
      '#7A4E6B',
      `<ellipse cx="50" cy="70" rx="34" ry="11" fill="#F1E8D6"/>
       <g fill="#B8541F"><ellipse cx="38" cy="56" rx="13" ry="9" transform="rotate(-25 38 56)"/><ellipse cx="60" cy="54" rx="13" ry="9" transform="rotate(20 60 54)"/><ellipse cx="50" cy="64" rx="13" ry="8"/></g>
       <g fill="#8E3A12"><circle cx="34" cy="53" r="1.8"/><circle cx="62" cy="51" r="1.8"/><circle cx="48" cy="63" r="1.8"/><circle cx="55" cy="66" r="1.5"/></g>`,
    ),
  },
  {
    match: /pie|roll|pastry/i,
    svg: tile(
      '#5B6472',
      `<path d="M18 62 q32 -40 64 0 q-2 10 -32 10 q-30 0 -32 -10 z" fill="#E8B04A"/>
       <path d="M22 62 q28 8 56 0" stroke="#C98A2B" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="1 7"/>
       <path d="M40 42 l4 8 M50 38 v9 M60 42 l-4 8" stroke="#B8742F" stroke-width="2.5" stroke-linecap="round"/>`,
    ),
  },
  {
    match: /chin ?chin/i,
    svg: tile(
      '#C9A46A',
      `<path d="M26 44 h48 l-5 40 h-38 z" fill="#E0562B"/>
       <g fill="#F2C14E"><rect x="30" y="32" width="9" height="9" rx="2" transform="rotate(15 34 36)"/><rect x="42" y="28" width="9" height="9" rx="2"/><rect x="54" y="31" width="9" height="9" rx="2" transform="rotate(-12 58 35)"/><rect x="36" y="38" width="9" height="9" rx="2" transform="rotate(-20 40 42)"/><rect x="50" y="38" width="9" height="9" rx="2" transform="rotate(25 54 42)"/><rect x="62" y="40" width="8" height="8" rx="2"/></g>
       <rect x="34" y="58" width="32" height="10" rx="2" fill="#F1E8D6"/>`,
    ),
  },
  {
    match: /chocolate/i,
    svg: tile(
      '#B33A3A',
      `<g transform="rotate(-18 50 50)"><rect x="26" y="30" width="48" height="40" rx="3" fill="#4A2A18"/>
       <g stroke="#2E180C" stroke-width="2.5"><path d="M42 30 v40 M58 30 v40 M26 50 h48"/></g>
       <path d="M26 54 h48 v16 h-48 z" fill="#F2C14E"/><rect x="26" y="57" width="48" height="4" fill="#E0562B"/></g>`,
    ),
  },
  {
    match: /ice ?cream/i,
    svg: tile(
      '#3E8A83',
      `<path d="M30 52 h40 l-5 32 h-30 z" fill="#F1E8D6"/>
       <path d="M33 52 l2 32 M67 52 l-2 32" stroke="#E0562B" stroke-width="3"/>
       <circle cx="42" cy="46" r="12" fill="#F7E2B3"/><circle cx="58" cy="46" r="12" fill="#E9A3B4"/><circle cx="50" cy="36" r="12" fill="#7A4A2A"/>
       <path d="M40 30 q4 -6 10 -2" stroke="#fff" stroke-width="2.5" fill="none" opacity="0.5" stroke-linecap="round"/>`,
    ),
  },
];

const BY_CATEGORY: Record<string, string> = {
  POPCORN: tile('#7A2E2E', popcorn('#E0562B')),
  DRINKS: tile('#4F7CA8', cup('#3A1A10', '#E0562B')),
  COMBOS: ART[1].svg,
  SNACKS: tile('#5B6472', `<circle cx="50" cy="52" r="26" fill="#F2C14E"/><circle cx="50" cy="52" r="18" fill="#E8B04A"/>`),
};

export function snackArt(name: string, category?: string | null): string {
  return ART.find((a) => a.match.test(name))?.svg ?? BY_CATEGORY[String(category ?? '').toUpperCase()] ?? BY_CATEGORY.SNACKS;
}

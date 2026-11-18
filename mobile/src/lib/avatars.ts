/**
 * The preset profile avatars (original artwork, drawn here as SVG).
 * Keys must match AVATARS in backend/services/profileLook.js.
 */
export interface AvatarArt {
  key: string;
  label: string;
  svg: string;
}

const wrap = (bg: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${bg}"/>${body}</svg>`;

function burst(cx: number, cy: number, outer: number, inner: number, points: number) {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    out.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return out.join(' ');
}

const eye = (x: number, y: number, r = 3.2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#12100D"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.32}" fill="#fff"/>`;

export const AVATARS: AvatarArt[] = [
  {
    key: 'lion',
    label: 'Lion',
    svg: wrap(
      '#2E5E4E',
      `<polygon points="${burst(50, 52, 37, 28, 14)}" fill="#C9772B"/>
       <circle cx="50" cy="52" r="29" fill="#D98E32"/>
       <circle cx="33" cy="33" r="7" fill="#F2C14E"/><circle cx="67" cy="33" r="7" fill="#F2C14E"/>
       <circle cx="33" cy="33" r="3.5" fill="#B5652A"/><circle cx="67" cy="33" r="3.5" fill="#B5652A"/>
       <circle cx="50" cy="54" r="22" fill="#F2C14E"/>
       ${eye(41, 48)}${eye(59, 48)}
       <ellipse cx="44.5" cy="62" rx="7" ry="5.5" fill="#FBE3A8"/><ellipse cx="55.5" cy="62" rx="7" ry="5.5" fill="#FBE3A8"/>
       <path d="M45 55 h10 l-5 6 z" fill="#7A3B1E"/>
       <path d="M50 61 v4 M46 68 q4 3 8 0" stroke="#7A3B1E" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    ),
  },
  {
    key: 'elephant',
    label: 'Elephant',
    svg: wrap(
      '#C9A46A',
      `<ellipse cx="25" cy="48" rx="17" ry="21" fill="#7E8A96"/><ellipse cx="75" cy="48" rx="17" ry="21" fill="#7E8A96"/>
       <ellipse cx="27" cy="49" rx="10" ry="14" fill="#D9A3A0"/><ellipse cx="73" cy="49" rx="10" ry="14" fill="#D9A3A0"/>
       <circle cx="50" cy="45" r="22" fill="#97A3AF"/>
       <path d="M43 56 q-1 14 4 22 q3 5 8 3 q-2 -3 -3 -6 q-3 -8 -2 -19 z" fill="#97A3AF"/>
       <path d="M41 58 q-6 6 -10 4" stroke="#F1E8D6" stroke-width="3.5" fill="none" stroke-linecap="round"/>
       <path d="M59 58 q6 6 10 4" stroke="#F1E8D6" stroke-width="3.5" fill="none" stroke-linecap="round"/>
       ${eye(41, 44)}${eye(59, 44)}
       <path d="M47 76 h6 M47 72 h5" stroke="#7E8A96" stroke-width="1.5" stroke-linecap="round"/>`,
    ),
  },
  {
    key: 'giraffe',
    label: 'Giraffe',
    svg: wrap(
      '#4F7CA8',
      `<path d="M40 100 L42 64 h16 L60 100 z" fill="#E8B04A"/>
       <path d="M44 80 l5 -3 4 4 -4 4 z M51 92 l5 -3 3 5 -5 3 z" fill="#A8642A"/>
       <path d="M41 25 v-11 M59 25 v-11" stroke="#A8642A" stroke-width="3.5" stroke-linecap="round"/>
       <circle cx="41" cy="13" r="4" fill="#7A4521"/><circle cx="59" cy="13" r="4" fill="#7A4521"/>
       <ellipse cx="28" cy="33" rx="9" ry="4.5" fill="#E8B04A" transform="rotate(-20 28 33)"/>
       <ellipse cx="72" cy="33" rx="9" ry="4.5" fill="#E8B04A" transform="rotate(20 72 33)"/>
       <ellipse cx="50" cy="44" rx="18" ry="22" fill="#F0BE5A"/>
       <path d="M37 31 l6 -2 2 6 -6 2 z M58 30 l6 2 -2 6 -5 -2 z M48 25 l5 0 1 4 -5 1 z" fill="#B8742F"/>
       <ellipse cx="50" cy="58" rx="13" ry="9" fill="#F7D99A"/>
       ${eye(42, 44)}${eye(58, 44)}
       <circle cx="45.5" cy="57" r="1.8" fill="#7A4521"/><circle cx="54.5" cy="57" r="1.8" fill="#7A4521"/>
       <path d="M45 63 q5 3 10 0" stroke="#7A4521" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    ),
  },
  {
    key: 'zebra',
    label: 'Zebra',
    svg: wrap(
      '#E0562B',
      `<path d="M38 18 q12 -10 24 0 l-4 14 h-16 z" fill="#12100D"/>
       <ellipse cx="33" cy="26" rx="5" ry="10" fill="#F1E8D6" transform="rotate(-25 33 26)"/>
       <ellipse cx="67" cy="26" rx="5" ry="10" fill="#F1E8D6" transform="rotate(25 67 26)"/>
       <path d="M33 40 q0 -18 17 -18 q17 0 17 18 l-3 30 q-14 8 -28 0 z" fill="#F1E8D6"/>
       <path d="M35 34 q8 3 12 -2 M65 34 q-8 3 -12 -2 M34 44 q7 2 10 -1 M66 44 q-7 2 -10 -1 M50 24 v8 M44 26 l3 6 M56 26 l-3 6" stroke="#12100D" stroke-width="3" fill="none" stroke-linecap="round"/>
       <ellipse cx="50" cy="68" rx="15" ry="11" fill="#4A443B"/>
       <circle cx="44" cy="68" r="2.2" fill="#12100D"/><circle cx="56" cy="68" r="2.2" fill="#12100D"/>
       ${eye(41, 50)}${eye(59, 50)}`,
    ),
  },
  {
    key: 'owl',
    label: 'Owl',
    svg: wrap(
      '#3B2F4A',
      `<path d="M26 26 l10 10 M74 26 l-10 10" stroke="#8A6A4A" stroke-width="7" stroke-linecap="round"/>
       <ellipse cx="50" cy="58" rx="27" ry="30" fill="#8A6A4A"/>
       <ellipse cx="50" cy="72" rx="15" ry="13" fill="#D9C2A0"/>
       <path d="M42 68 q2 3 4 0 M48 72 q2 3 4 0 M54 68 q2 3 4 0 M45 77 q2 3 4 0 M51 77 q2 3 4 0" stroke="#8A6A4A" stroke-width="1.5" fill="none"/>
       <circle cx="38" cy="47" r="12" fill="#D9C2A0"/><circle cx="62" cy="47" r="12" fill="#D9C2A0"/>
       <circle cx="38" cy="47" r="8" fill="#F2C14E"/><circle cx="62" cy="47" r="8" fill="#F2C14E"/>
       ${eye(38, 47, 4.6)}${eye(62, 47, 4.6)}
       <path d="M46 55 h8 l-4 7 z" fill="#E0562B"/>`,
    ),
  },
  {
    key: 'cheetah',
    label: 'Cheetah',
    svg: wrap(
      '#6E8B5B',
      `<circle cx="31" cy="31" r="8" fill="#E9B54F"/><circle cx="69" cy="31" r="8" fill="#E9B54F"/>
       <circle cx="31" cy="31" r="4" fill="#12100D"/><circle cx="69" cy="31" r="4" fill="#12100D"/>
       <circle cx="50" cy="52" r="27" fill="#E9B54F"/>
       <ellipse cx="50" cy="64" rx="13" ry="10" fill="#F7E2B3"/>
       <g fill="#5A3A1A"><circle cx="38" cy="33" r="2"/><circle cx="50" cy="29" r="2.2"/><circle cx="62" cy="33" r="2"/><circle cx="30" cy="48" r="2"/><circle cx="70" cy="48" r="2"/><circle cx="44" cy="38" r="1.6"/><circle cx="56" cy="38" r="1.6"/><circle cx="31" cy="58" r="1.8"/><circle cx="69" cy="58" r="1.8"/></g>
       ${eye(41, 48)}${eye(59, 48)}
       <path d="M41 52 q-2 8 3 13 M59 52 q2 8 -3 13" stroke="#12100D" stroke-width="2.2" fill="none" stroke-linecap="round"/>
       <path d="M46 59 h8 l-4 4 z" fill="#3A2412"/>
       <path d="M50 63 v3 M46 68 q4 3 8 0" stroke="#3A2412" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    ),
  },
  {
    key: 'hippo',
    label: 'Hippo',
    svg: wrap(
      '#F2C14E',
      `<circle cx="31" cy="27" r="6" fill="#86708F"/><circle cx="69" cy="27" r="6" fill="#86708F"/>
       <circle cx="31" cy="27" r="3" fill="#D99AA6"/><circle cx="69" cy="27" r="3" fill="#D99AA6"/>
       <ellipse cx="50" cy="44" rx="23" ry="19" fill="#9A84A3"/>
       <ellipse cx="50" cy="66" rx="30" ry="19" fill="#AE99B6"/>
       ${eye(40, 41)}${eye(60, 41)}
       <ellipse cx="40" cy="61" rx="3" ry="4" fill="#6E5A75"/><ellipse cx="60" cy="61" rx="3" ry="4" fill="#6E5A75"/>
       <path d="M36 73 q14 8 28 0" stroke="#6E5A75" stroke-width="2.2" fill="none" stroke-linecap="round"/>
       <rect x="42" y="74" width="5" height="5" rx="1" fill="#F1E8D6"/><rect x="53" y="74" width="5" height="5" rx="1" fill="#F1E8D6"/>`,
    ),
  },
  {
    key: 'monkey',
    label: 'Monkey',
    svg: wrap(
      '#3E8A83',
      `<circle cx="24" cy="50" r="11" fill="#7A4A2A"/><circle cx="76" cy="50" r="11" fill="#7A4A2A"/>
       <circle cx="24" cy="50" r="6" fill="#E9B98F"/><circle cx="76" cy="50" r="6" fill="#E9B98F"/>
       <circle cx="50" cy="50" r="27" fill="#7A4A2A"/>
       <path d="M50 38 q-6 -6 -13 -3 q-8 4 -5 14 q-4 6 -2 13 q4 12 20 12 q16 0 20 -12 q2 -7 -2 -13 q3 -10 -5 -14 q-7 -3 -13 3 z" fill="#E9B98F"/>
       ${eye(42, 47)}${eye(58, 47)}
       <circle cx="47" cy="58" r="1.5" fill="#5A3420"/><circle cx="53" cy="58" r="1.5" fill="#5A3420"/>
       <path d="M42 64 q8 7 16 0" stroke="#5A3420" stroke-width="2" fill="none" stroke-linecap="round"/>
       <path d="M44 27 q6 -6 12 0" stroke="#7A4A2A" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    ),
  },
  {
    key: 'popcorn',
    label: 'Popcorn',
    svg: wrap(
      '#7A2E2E',
      `<g fill="#FFF4D6"><circle cx="36" cy="38" r="9"/><circle cx="50" cy="32" r="10"/><circle cx="64" cy="38" r="9"/><circle cx="43" cy="28" r="7"/><circle cx="58" cy="27" r="7"/></g>
       <g fill="#F2C14E"><circle cx="40" cy="34" r="3"/><circle cx="60" cy="31" r="3"/><circle cx="52" cy="38" r="2.5"/></g>
       <path d="M30 42 h40 l-6 40 h-28 z" fill="#F1E8D6"/>
       <path d="M37 42 l3 40 h7 l-1 -40 z M54 42 l-1 40 h7 l3 -40 z" fill="#E0562B"/>
       ${eye(43, 58, 2.8)}${eye(57, 58, 2.8)}
       <path d="M45 65 q5 4 10 0" stroke="#12100D" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    ),
  },
  {
    key: 'clapper',
    label: 'Clapperboard',
    svg: wrap(
      '#5B6472',
      `<rect x="25" y="44" width="50" height="34" rx="3" fill="#12100D"/>
       <path d="M25 44 l3 -14 l48 9 l-1 5 z" fill="#12100D"/>
       <path d="M34 32 l-4 11 M46 34 l-4 10 M58 36 l-4 8 M70 38 l-3 6" stroke="#F1E8D6" stroke-width="4"/>
       <path d="M25 52 h50" stroke="#F1E8D6" stroke-width="2"/>
       <path d="M31 60 h22 M31 67 h14 M31 73 h18" stroke="#A89F8E" stroke-width="2.5" stroke-linecap="round"/>
       <circle cx="64" cy="66" r="6" fill="#E0562B"/>`,
    ),
  },
  {
    key: 'specs',
    label: '3D glasses',
    svg: wrap(
      '#7A4E6B',
      `<path d="M18 46 h64 l-3 18 q-1 6 -7 6 h-12 q-5 0 -7 -5 l-3 -7 l-3 7 q-2 5 -7 5 h-12 q-6 0 -7 -6 z" fill="#F1E8D6"/>
       <path d="M24 50 h19 l-2 13 q-1 3 -4 3 h-9 q-3 0 -4 -3 z" fill="#E0413A"/>
       <path d="M57 50 h19 l-2 13 q-1 3 -4 3 h-9 q-3 0 -4 -3 z" fill="#3FB6C6"/>
       <path d="M18 46 l-4 -8 M82 46 l4 -8" stroke="#F1E8D6" stroke-width="3.5" stroke-linecap="round"/>
       <path d="M28 54 l6 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
       <path d="M61 54 l6 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/>`,
    ),
  },
  {
    key: 'reel',
    label: 'Film reel',
    svg: wrap(
      '#C76B5B',
      `<path d="M66 64 q14 10 24 4" stroke="#12100D" stroke-width="9" fill="none"/>
       <path d="M70 67 l2 -1 M77 69 l2 0 M84 68 l2 -1" stroke="#F1E8D6" stroke-width="2"/>
       <circle cx="46" cy="48" r="26" fill="#F1E8D6"/>
       <circle cx="46" cy="48" r="5" fill="#12100D"/>
       <g fill="#C76B5B"><circle cx="46" cy="33" r="7"/><circle cx="60.3" cy="43.4" r="7"/><circle cx="54.8" cy="60.1" r="7"/><circle cx="37.2" cy="60.1" r="7"/><circle cx="31.7" cy="43.4" r="7"/></g>`,
    ),
  },
];

export const avatarByKey = new Map(AVATARS.map((a) => [a.key, a]));

import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

/**
 * One small pictogram per trophy, drawn in the middle of the medal
 * (100 × 100 box, artwork kept inside roughly 28–72). Every icon takes the
 * ink colour so it reads on gold, laterite and bone discs and greys out
 * when locked. The Ghana flag is the one exception: it keeps its colours.
 *
 * Franchise trophies use original pictograms (a comic "POW" burst for the
 * Marvel run, a hero mask for the DC run) rather than the studios' logos,
 * which are trademarks we can't put in the app without a licence.
 */

type Draw = (c: string, bg: string) => ReactElement;

const sw = {
  strokeWidth: 4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
};

function star(cx: number, cy: number, outer: number, inner: number, points = 5) {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    out.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return out.join(' ');
}

const person = (c: string, x: number, y: number, s = 1) => (
  <G key={`${x}-${y}`}>
    <Circle cx={x} cy={y - 9 * s} r={6 * s} fill={c} />
    <Path d={`M${x - 10 * s},${y + 14 * s} Q${x - 10 * s},${y} ${x},${y} Q${x + 10 * s},${y} ${x + 10 * s},${y + 14 * s} Z`} fill={c} />
  </G>
);

const calendar = (c: string, extra: ReactElement) => (
  <G>
    <Rect x={29} y={33} width={42} height={36} rx={3} stroke={c} {...sw} />
    <Line x1={29} y1={44} x2={71} y2={44} stroke={c} strokeWidth={4} />
    <Line x1={38} y1={28} x2={38} y2={36} stroke={c} {...sw} />
    <Line x1={62} y1={28} x2={62} y2={36} stroke={c} {...sw} />
    {extra}
  </G>
);

const ICONS: Record<string, Draw> = {
  // Milestones
  FIRST_SCREENING: (c) => (
    <G>
      <Path d="M28,38 h44 v7 a5,5 0 0 0 0,10 v7 h-44 v-7 a5,5 0 0 0 0,-10 Z" stroke={c} {...sw} />
      <Path d="M47,45 l4,-3 v17" stroke={c} {...sw} />
    </G>
  ),
  MOVIE_BUFF: (c) => (
    <G>
      <Circle cx={50} cy={50} r={21} stroke={c} {...sw} />
      <Circle cx={50} cy={50} r={3.5} fill={c} />
      {[0, 72, 144, 216, 288].map((a) => (
        <Circle key={a} cx={50 + 11 * Math.cos(((a - 90) * Math.PI) / 180)} cy={50 + 11 * Math.sin(((a - 90) * Math.PI) / 180)} r={4.5} fill={c} />
      ))}
    </G>
  ),
  FILM_ENTHUSIAST: (c) => (
    <G>
      <Rect x={29} y={45} width={42} height={24} rx={2} stroke={c} {...sw} />
      <Path d="M29,45 L31,33 L72,38 L71,45" stroke={c} {...sw} />
      <Line x1={41} y1={35} x2={38} y2={44} stroke={c} {...sw} />
      <Line x1={54} y1={36.5} x2={51} y2={44} stroke={c} {...sw} />
    </G>
  ),
  CINEMA_REGULAR: (c) => (
    <G>
      <Circle cx={40} cy={37} r={6} fill={c} />
      <Circle cx={50} cy={33} r={6.5} fill={c} />
      <Circle cx={60} cy={37} r={6} fill={c} />
      <Path d="M32,42 h36 l-4,28 h-28 Z" stroke={c} {...sw} />
      <Line x1={44} y1={46} x2={45} y2={66} stroke={c} strokeWidth={3} />
      <Line x1={56} y1={46} x2={55} y2={66} stroke={c} strokeWidth={3} />
    </G>
  ),
  SILVER_SCREEN_VETERAN: (c) => (
    <G>
      <Rect x={27} y={32} width={46} height={28} rx={2} stroke={c} {...sw} />
      <Polygon points={star(50, 46, 9, 4)} fill={c} />
      <Line x1={38} y1={68} x2={62} y2={68} stroke={c} {...sw} />
      <Line x1={50} y1={60} x2={50} y2={68} stroke={c} {...sw} />
    </G>
  ),
  SAVANNAH_LEGEND: (c) => (
    <G>
      <Path d="M29,64 L27,38 L39,49 L50,32 L61,49 L73,38 L71,64 Z" fill={c} />
      <Rect x={29} y={66} width={42} height={5} rx={1.5} fill={c} />
    </G>
  ),

  // Genres
  ACTION_HERO: (c) => <Path d="M55,27 L35,53 H49 L44,73 L66,44 H52 Z" fill={c} />,
  COMEDY_KING: (c) => (
    <G>
      <Path d="M30,34 Q50,28 70,34 Q72,58 50,70 Q28,58 30,34 Z" stroke={c} {...sw} />
      <Path d="M38,44 q4,-4 8,0 M54,44 q4,-4 8,0" stroke={c} {...sw} />
      <Path d="M39,53 Q50,64 61,53 Z" fill={c} />
    </G>
  ),
  FEARLESS: (c, bg) => (
    <G>
      <Path d="M33,70 V47 a17,17 0 0 1 34,0 V70 l-6,-5 -5,5 -6,-5 -5,5 -6,-5 Z" fill={c} />
      <Circle cx={44} cy={47} r={3.2} fill={bg} />
      <Circle cx={56} cy={47} r={3.2} fill={bg} />
    </G>
  ),
  ROMANTIC: (c) => <Path d="M50,69 C26,53 28,33 41,33 C46,33 49,37 50,40 C51,37 54,33 59,33 C72,33 74,53 50,69 Z" fill={c} />,
  BEYOND_EARTH: (c) => (
    <G>
      <Circle cx={50} cy={50} r={13} fill={c} />
      <Ellipse cx={50} cy={50} rx={24} ry={8} stroke={c} {...sw} transform="rotate(-20 50 50)" />
    </G>
  ),
  DETECTIVE: (c) => (
    <G>
      <Circle cx={45} cy={45} r={13} stroke={c} {...sw} />
      <Line x1={54.5} y1={54.5} x2={68} y2={68} stroke={c} strokeWidth={6} strokeLinecap="round" />
    </G>
  ),
  GENRE_COLLECTOR: (c) => (
    <G>
      <Rect x={30} y={30} width={17} height={17} rx={2} fill={c} />
      <Rect x={53} y={30} width={17} height={17} rx={2} stroke={c} {...sw} />
      <Rect x={30} y={53} width={17} height={17} rx={2} stroke={c} {...sw} />
      <Rect x={53} y={53} width={17} height={17} rx={2} fill={c} />
    </G>
  ),
  HORROR_HUNTER: (c, bg) => (
    <G>
      <Path d="M50,36 C34,34 27,44 28,53 C29,64 40,69 50,67 C60,69 71,64 72,53 C73,44 66,34 50,36 Z" fill={c} />
      <Path d="M50,36 Q50,30 55,27" stroke={c} {...sw} />
      <Path d="M39,49 l4,-4 4,4 Z M53,49 l4,-4 4,4 Z" fill={bg} />
      <Path d="M40,57 l3,3 3,-3 4,3 4,-3 3,3 3,-3" stroke={bg} strokeWidth={2.5} fill="none" />
    </G>
  ),

  // Collections (original pictograms, not studio logos)
  MARVEL_COLLECTOR: (c, bg) => (
    <G>
      <Polygon points={star(50, 50, 23, 13, 9)} fill={c} />
      <Rect x={47.5} y={39} width={5} height={13} rx={2} fill={bg} />
      <Circle cx={50} cy={58} r={3} fill={bg} />
    </G>
  ),
  DC_COLLECTOR: (c, bg) => (
    <G>
      <Path d="M26,46 Q30,38 40,40 Q46,41 50,45 Q54,41 60,40 Q70,38 74,46 Q72,58 61,58 Q54,58 50,52 Q46,58 39,58 Q28,58 26,46 Z" fill={c} />
      <Ellipse cx={39} cy={49} rx={5} ry={3.2} fill={bg} />
      <Ellipse cx={61} cy={49} rx={5} ry={3.2} fill={bg} />
    </G>
  ),
  FRANCHISE_FAN: (c) => (
    <G>
      <Rect x={26} y={36} width={20} height={28} rx={2} stroke={c} {...sw} />
      <Rect x={40} y={32} width={20} height={28} rx={2} fill={c} />
      <Rect x={54} y={36} width={20} height={28} rx={2} stroke={c} {...sw} />
    </G>
  ),

  // Habits
  WEEKEND_WARRIOR: (c) =>
    calendar(
      c,
      <G>
        <Rect x={35} y={50} width={12} height={12} rx={1.5} fill={c} />
        <Rect x={53} y={50} width={12} height={12} rx={1.5} fill={c} />
      </G>,
    ),
  MONTHLY_REGULAR: (c) =>
    calendar(
      c,
      <G>
        {[36, 46, 56].map((x) => (
          <Circle key={`a${x}`} cx={x + 4} cy={52} r={2.5} fill={c} />
        ))}
        {[36, 46, 56].map((x) => (
          <Circle key={`b${x}`} cx={x + 4} cy={61} r={2.5} fill={c} />
        ))}
      </G>,
    ),
  NIGHT_OWL: (c, bg) => (
    <G>
      <Path d="M33,36 L38,42 Q50,38 62,42 L67,36 L68,56 Q68,71 50,71 Q32,71 32,56 Z" fill={c} />
      <Circle cx={42} cy={51} r={7} fill={bg} />
      <Circle cx={58} cy={51} r={7} fill={bg} />
      <Circle cx={42} cy={51} r={3} fill={c} />
      <Circle cx={58} cy={51} r={3} fill={c} />
      <Path d="M47,58 L50,63 L53,58 Z" fill={bg} />
    </G>
  ),
  EARLY_BIRD: (c) => (
    <G>
      <Path d="M31,62 a19,19 0 0 1 38,0 Z" fill={c} />
      <Line x1={26} y1={67} x2={74} y2={67} stroke={c} {...sw} />
      <Line x1={50} y1={28} x2={50} y2={36} stroke={c} {...sw} />
      <Line x1={31} y1={36} x2={36} y2={41} stroke={c} {...sw} />
      <Line x1={69} y1={36} x2={64} y2={41} stroke={c} {...sw} />
    </G>
  ),
  CINEMA_STREAK: (c) => (
    <Path d="M50,27 C52,38 66,43 66,56 C66,66 58,72 50,72 C42,72 34,66 34,57 C34,49 40,45 42,40 C44,46 46,48 48,49 C48,41 47,34 50,27 Z" fill={c} />
  ),
  AFTER_HOURS: (c) => (
    <G>
      <Circle cx={50} cy={50} r={21} stroke={c} {...sw} />
      <Line x1={50} y1={50} x2={50} y2={35} stroke={c} {...sw} />
      <Line x1={50} y1={50} x2={50} y2={37} stroke={c} {...sw} transform="rotate(-8 50 50)" />
      <Circle cx={50} cy={50} r={3} fill={c} />
    </G>
  ),

  // Social
  MOVIE_BUDDY: (c) => (
    <G>
      {person(c, 40, 52)}
      {person(c, 60, 52)}
    </G>
  ),
  DYNAMIC_DUO: (c) => (
    <G>
      <Circle cx={42} cy={50} r={15} stroke={c} {...sw} />
      <Circle cx={58} cy={50} r={15} fill={c} opacity={0.9} />
    </G>
  ),
  GROUP_SCREENING: (c) => (
    <G>
      {person(c, 33, 56, 0.8)}
      {person(c, 67, 56, 0.8)}
      {person(c, 50, 52)}
    </G>
  ),
  THE_CONNECTOR: (c) => (
    <G>
      <Line x1={50} y1={36} x2={34} y2={62} stroke={c} {...sw} />
      <Line x1={50} y1={36} x2={66} y2={62} stroke={c} {...sw} />
      <Line x1={34} y1={62} x2={66} y2={62} stroke={c} {...sw} />
      <Circle cx={50} cy={36} r={7} fill={c} />
      <Circle cx={34} cy={62} r={7} fill={c} />
      <Circle cx={66} cy={62} r={7} fill={c} />
    </G>
  ),

  // Seasonal challenges
  CINEMA_CUPID: (c) => (
    <G>
      <Path d="M48,68 C28,55 30,38 41,38 C45,38 47,41 48,43 C49,41 51,38 55,38 C66,38 68,55 48,68 Z" fill={c} />
      <Line x1={27} y1={67} x2={71} y2={33} stroke={c} {...sw} />
      <Path d="M71,33 l-9,1 M71,33 l-1,9" stroke={c} {...sw} />
    </G>
  ),
  SANTAS_LITTLE_HELPER: (c, bg) => (
    <G>
      <Rect x={30} y={44} width={40} height={26} rx={2} fill={c} />
      <Rect x={28} y={38} width={44} height={8} rx={2} fill={c} />
      <Rect x={47} y={38} width={6} height={32} fill={bg} />
      <Path d="M50,38 C44,28 36,32 42,37 Z M50,38 C56,28 64,32 58,37 Z" stroke={c} {...sw} />
    </G>
  ),
  EASTER_EGG_HUNTER: (c, bg) => (
    <G>
      <Path d="M50,28 C62,28 70,46 70,56 C70,66 61,72 50,72 C39,72 30,66 30,56 C30,46 38,28 50,28 Z" fill={c} />
      <Path d="M31,52 l6,-5 6,5 7,-5 7,5 6,-5 6,5" stroke={bg} strokeWidth={3} fill="none" strokeLinejoin="round" />
      <Circle cx={42} cy={62} r={2.5} fill={bg} />
      <Circle cx={58} cy={62} r={2.5} fill={bg} />
    </G>
  ),

  // Hidden
  LAST_MAN_STANDING: (c) => (
    <G>
      <Rect x={36} y={32} width={28} height={24} rx={5} fill={c} />
      <Rect x={30} y={50} width={6} height={16} rx={2} fill={c} />
      <Rect x={64} y={50} width={6} height={16} rx={2} fill={c} />
      <Rect x={36} y={56} width={28} height={8} rx={2} fill={c} />
      <Line x1={38} y1={70} x2={62} y2={70} stroke={c} {...sw} />
    </G>
  ),
  MARATHONER: (c) => (
    <G>
      <Path d="M35,29 h30 M35,71 h30" stroke={c} {...sw} />
      <Path d="M37,29 C37,42 50,46 50,50 C50,54 37,58 37,71 M63,29 C63,42 50,46 50,50 C50,54 63,58 63,71" stroke={c} {...sw} />
      <Path d="M42,67 Q50,58 58,67 Z" fill={c} />
    </G>
  ),
  FIRST_IN_LINE: (c) => (
    <G>
      <Line x1={36} y1={28} x2={36} y2={72} stroke={c} {...sw} />
      <Path d="M36,30 H66 L60,40 L66,50 H36 Z" fill={c} />
    </G>
  ),
  EXPLORER: (c, bg) => (
    <G>
      <Circle cx={50} cy={50} r={21} stroke={c} {...sw} />
      <Polygon points="50,32 56,50 50,68 44,50" fill={c} />
      <Circle cx={50} cy={50} r={3} fill={bg} />
    </G>
  ),
};

/** Ghana flag in a circle: red, gold, green with the black star. */
function GhanaFlag({ muted }: { muted: boolean }) {
  // circle r=30 at (50,50); stripe edges at y=40 and y=60 meet it at x = 50 ± 28.28
  const L = 21.72;
  const R = 78.28;
  return (
    <G opacity={muted ? 0.45 : 1}>
      <Path d={`M${L},40 A30,30 0 0 1 ${R},40 Z`} fill="#CE1126" />
      <Path d={`M${L},40 L${R},40 A30,30 0 0 1 ${R},60 L${L},60 A30,30 0 0 1 ${L},40 Z`} fill="#FCD116" />
      <Path d={`M${R},60 A30,30 0 0 1 ${L},60 Z`} fill="#006B3F" />
      <Polygon points={star(50, 50.5, 9, 3.8)} fill="#000000" />
      <Circle cx={50} cy={50} r={30} stroke="#12100D" strokeWidth={2} fill="none" />
    </G>
  );
}

export function hasTrophyIcon(code: string) {
  return code === 'MADE_IN_GHANA' || code in ICONS;
}

/** The pictogram for a trophy, or null if it has none (falls back to the monogram). */
export function TrophyIcon({ code, color, bg, muted }: { code: string; color: string; bg: string; muted: boolean }) {
  if (code === 'MADE_IN_GHANA') return <GhanaFlag muted={muted} />;
  const draw = ICONS[code];
  return draw ? draw(color, bg) : null;
}

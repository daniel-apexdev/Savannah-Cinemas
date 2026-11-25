import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme';

type P = { size?: number; color?: string; filled?: boolean };

export const BackIcon = ({ size = 20, color = colors.bone }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}>
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const CloseIcon = ({ size = 20, color = colors.bone }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}>
    <Path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const BookmarkIcon = ({ size = 20, color = colors.bone, filled }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2}>
    <Path d="M6 3h12v18l-6-4-6 4z" />
  </Svg>
);

export const PlayIcon = ({ size = 14, color = colors.ink }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M7 4l13 8-13 8z" />
  </Svg>
);

export const SearchIcon = ({ size = 18, color = colors.dust }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Circle cx={11} cy={11} r={7} />
    <Path d="M20 20l-4-4" />
  </Svg>
);

export const BellIcon = ({ size = 20, color = colors.bone, filled }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinejoin="round">
    <Path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" />
    <Path d="M10 20.5a2 2 0 004 0" fill="none" />
  </Svg>
);

export const NextIcon = ({ size = 20, color = colors.bone }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2}>
    <Path d="M9 5l7 7-7 7" />
  </Svg>
);

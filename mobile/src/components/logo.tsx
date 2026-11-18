import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

/**
 * The Savannah Cinemas mark: a laterite sun setting behind an acacia,
 * on a bone horizon. Split into two layers so the launch screen can
 * raise the sun first and then reveal the tree.
 * (Same artwork as assets/images/icon.png and splash-icon.png.)
 */
const head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">';

export const SUN_SVG = `${head}<defs><clipPath id="sv-sun"><circle cx="100" cy="96" r="72"/></clipPath></defs>
<circle cx="100" cy="96" r="72" fill="#E0562B"/>
<g clip-path="url(#sv-sun)" fill="#12100D"><rect x="20" y="128" width="160" height="5"/><rect x="20" y="140" width="160" height="7"/><rect x="20" y="154" width="160" height="10"/><rect x="20" y="168" width="160" height="40"/></g></svg>`;

export const TREE_SVG = `${head}<g fill="#12100D">
<path d="M97 170 L99 120 Q94 108 80 100 L83 97 Q95 103 100 112 Q104 100 118 93 L121 96 Q108 104 104 118 L106 170 Z"/>
<path d="M44 96 Q52 84 70 85 Q78 76 96 79 Q104 72 120 77 Q138 74 148 84 Q164 84 162 95 Q150 99 130 97 Q118 102 100 99 Q82 103 66 99 Q50 101 44 96 Z"/></g>
<rect x="24" y="168" width="152" height="4" rx="2" fill="#F1E8D6"/></svg>`;

export function LogoMark({ size = 96 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Savannah Cinemas">
      <View style={StyleSheet.absoluteFill}>
        <SvgXml xml={SUN_SVG} width={size} height={size} />
      </View>
      <View style={StyleSheet.absoluteFill}>
        <SvgXml xml={TREE_SVG} width={size} height={size} />
      </View>
    </View>
  );
}

import { Pressable, StyleSheet, View } from 'react-native';

import { tick } from '@/lib/feel';
import { useFilmReminder } from '@/lib/notify';
import { colors, radius } from '@/theme';

import { BellIcon } from './icons';
import { Mono } from './type';

/**
 * "Remind me" for a coming-soon film. We notify on the day it opens
 * (and when tickets go on sale before that).
 *   overlay: small round button on a poster corner
 *   icon:    bare 44 pt bell (lists)
 *   button:  bell + words (film page)
 */
export function RemindBell({ movieId, title, variant = 'icon' }: { movieId: number; title: string; variant?: 'overlay' | 'icon' | 'button' }) {
  const [on, toggle] = useFilmReminder(movieId);
  const press = () => {
    tick();
    toggle();
  };
  const a11y = on ? `Reminder set for ${title}. Tap to turn it off` : `Remind me when ${title} opens`;

  if (variant === 'button') {
    return (
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel={a11y}
        onPress={press}
        style={({ pressed }) => [styles.button, on && styles.buttonOn, pressed && { opacity: 0.85 }]}>
        <BellIcon size={18} color={on ? colors.ink : colors.bone} filled={on} />
        <Mono size={12.5} color={on ? colors.ink : colors.bone}>
          {on ? 'REMINDER SET' : 'REMIND ME'}
        </Mono>
      </Pressable>
    );
  }

  if (variant === 'overlay') {
    return (
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        accessibilityLabel={a11y}
        onPress={press}
        hitSlop={8}
        style={({ pressed }) => [
          styles.overlay,
          on && {
            backgroundColor: colors.laterite,
            borderColor: colors.laterite,
          },
          pressed && { opacity: 0.8 },
        ]}>
        <BellIcon size={15} color={on ? colors.ink : colors.bone} filled={on} />
      </Pressable>
    );
  }

  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={a11y} onPress={press} style={styles.icon}>
      <View>
        <BellIcon size={20} color={on ? colors.laterite : colors.dust} filled={on} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,16,13,0.82)',
    borderWidth: 1.5,
    borderColor: colors.rule,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: colors.bone,
    borderRadius: radius.action,
  },
  buttonOn: { backgroundColor: colors.bone },
});

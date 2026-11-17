import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { Fonts, Palette, Radius } from '@/constants/theme';

type Props = {
  /** Texto corto con la antigüedad de la última lectura, por ejemplo "hace 2 min". */
  label: string;
  /** true si la última lectura es reciente. */
  active: boolean;
};

/** Indicador de estado del medidor: punto que pulsa + última lectura. */
export function LiveBadge({ label, active }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const color = active ? Palette.good : Palette.amber;
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={styles.badge}>
      <View style={styles.dotWrap}>
        {active && (
          <Animated.View
            style={[
              styles.ring,
              { backgroundColor: color, opacity: ringOpacity, transform: [{ scale: ringScale }] },
            ]}
          />
        )}
        <View style={[styles.dot, { backgroundColor: color }]} />
      </View>
      <View>
        <Text style={[styles.title, { color }]}>{active ? 'EN VIVO' : 'SIN SEÑAL'}</Text>
        <Text style={styles.sub}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  dotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  ring: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  title: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  sub: { fontFamily: Fonts.sans, fontSize: 11, color: Palette.textMuted, marginTop: 1 },
});

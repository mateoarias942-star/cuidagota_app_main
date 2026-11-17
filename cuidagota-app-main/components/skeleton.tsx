import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { Palette, Radius } from '@/constants/theme';

type Props = {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Bloque gris azulado que "respira" mientras cargan los datos. */
export function Skeleton({ width = '100%', height, radius = Radius.md, style }: Props) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: Palette.surface, opacity }, style]}
    />
  );
}

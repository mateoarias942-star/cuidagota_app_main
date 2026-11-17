import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { Fonts, Palette } from '@/constants/theme';

export type ChartPoint = { label: string; liters: number; cost: number };

type Props = {
  data: ChartPoint[];
  filter: 'diario' | 'semanal' | 'mensual';
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** Cambia cuando cambia el período mostrado, para reiniciar la animación de entrada. */
  animationKey: string;
};

const PLOT_H = 170;
const LABEL_H = 36;
const Y_AXIS_W = 40;
const TOP_PAD = 8;
const GRID_STEPS = 4;

/** Gráfica de barras con degradado, líneas guía y selección por toque. */
export function WaterChart({ data, filter, selectedIndex, onSelect, animationKey }: Props) {
  const { width: screenW } = useWindowDimensions();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [animationKey, enter]);

  const maxLiters = useMemo(() => data.reduce((max, item) => (item.liters > max ? item.liters : max), 0), [data]);
  const peakIndex = useMemo(() => {
    if (maxLiters <= 0) return -1;
    return data.findIndex((d) => d.liters === maxLiters);
  }, [data, maxLiters]);

  // Ancho disponible dentro de la tarjeta (padding de pantalla 16*2 + padding de tarjeta 16*2)
  const available = Math.max(220, screenW - 64 - Y_AXIS_W);
  const step = filter === 'semanal' ? Math.max(48, available / Math.max(1, data.length)) : filter === 'diario' ? 40 : 34;
  const barW = Math.min(22, step * 0.55);
  const svgW = Math.max(available, data.length * step);
  const svgH = TOP_PAD + PLOT_H + LABEL_H;
  const baseY = TOP_PAD + PLOT_H;

  const yLabel = (frac: number) => {
    const v = maxLiters * frac;
    return maxLiters < 10 ? v.toFixed(1) : v.toFixed(0);
  };

  return (
    <View style={styles.row}>
      {/* Eje Y fijo */}
      <View style={{ width: Y_AXIS_W, height: svgH }}>
        {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
          const frac = 1 - i / GRID_STEPS;
          const y = TOP_PAD + (i / GRID_STEPS) * PLOT_H;
          return (
            <Text key={i} style={[styles.yLabel, { top: y - 7 }]}>
              {yLabel(frac)}
            </Text>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <Animated.View
          style={{
            width: svgW,
            opacity: enter,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}>
          <Svg width={svgW} height={svgH}>
            <Defs>
              <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={Palette.water} />
                <Stop offset="1" stopColor={Palette.waterDeep} />
              </LinearGradient>
              <LinearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFC27F" />
                <Stop offset="1" stopColor={Palette.amber} />
              </LinearGradient>
            </Defs>

            {/* Líneas guía */}
            {Array.from({ length: GRID_STEPS + 1 }).map((_, i) => {
              const y = TOP_PAD + (i / GRID_STEPS) * PLOT_H;
              return (
                <Line
                  key={i}
                  x1={0}
                  x2={svgW}
                  y1={y}
                  y2={y}
                  stroke={Palette.border}
                  strokeWidth={1}
                  strokeDasharray={i === GRID_STEPS ? undefined : '3,5'}
                  opacity={i === GRID_STEPS ? 1 : 0.7}
                />
              );
            })}

            {data.map((item, index) => {
              // Altura mínima de 4px si hay consumo, para que siempre sea visible
              const barHeight = item.liters === 0 || maxLiters === 0 ? 0 : Math.max(4, (item.liters / maxLiters) * PLOT_H);
              const x = index * step + (step - barW) / 2;
              const isPeak = index === peakIndex;
              const isSelected = index === selectedIndex;
              const dimmed = selectedIndex !== null && !isSelected;
              const parts = item.label.split(' ');

              return (
                <G key={index} opacity={dimmed ? 0.4 : 1}>
                  {barHeight > 0 ? (
                    <Rect
                      x={x}
                      y={baseY - barHeight}
                      width={barW}
                      height={barHeight}
                      rx={Math.min(6, barW / 2)}
                      fill={isPeak ? 'url(#peakGrad)' : 'url(#barGrad)'}
                    />
                  ) : (
                    <Rect x={x} y={baseY - 2} width={barW} height={2} rx={1} fill={Palette.border} />
                  )}

                  {parts.map((p, i) => (
                    <SvgText
                      key={i}
                      x={index * step + step / 2}
                      y={baseY + 16 + i * 13}
                      fontSize={10}
                      fontFamily={Fonts.sans}
                      fontWeight={isSelected ? '700' : '500'}
                      fill={isSelected ? Palette.text : Palette.textMuted}
                      textAnchor="middle">
                      {p}
                    </SvgText>
                  ))}

                  {/* Zona táctil de toda la columna */}
                  <Rect
                    x={index * step}
                    y={TOP_PAD}
                    width={step}
                    height={PLOT_H + LABEL_H}
                    fill="transparent"
                    onPress={() => onSelect(isSelected ? null : index)}
                  />
                </G>
              );
            })}
          </Svg>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  yLabel: {
    position: 'absolute',
    right: 8,
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Palette.textFaint,
    fontVariant: ['tabular-nums'],
  },
});

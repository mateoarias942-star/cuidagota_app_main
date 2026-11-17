import Feather from '@expo/vector-icons/Feather';
import Constants from 'expo-constants';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PRECIO_POR_LITRO } from '@/constants/app-config';
import { Fonts, Palette, Radius, Spacing, tabularNums } from '@/constants/theme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const STEPS: { icon: FeatherName; title: string; text: string }[] = [
  {
    icon: 'activity',
    title: 'Lectura',
    text: 'El caudalímetro mide el agua que pasa y envía el volumen acumulado a la nube.',
  },
  {
    icon: 'droplet',
    title: 'Consumo',
    text: 'La app calcula los litros usados como la diferencia entre una lectura y la anterior.',
  },
  {
    icon: 'dollar-sign',
    title: 'Costo',
    text: 'Los litros se multiplican por la tarifa para estimar cuánto cuesta ese consumo.',
  },
];

const VIEWS: { icon: FeatherName; title: string; text: string }[] = [
  { icon: 'clock', title: 'Diario', text: 'Consumo hora por hora de un día.' },
  { icon: 'calendar', title: 'Semanal', text: 'Consumo por día, de lunes a domingo.' },
  { icon: 'bar-chart-2', title: 'Mensual', text: 'Consumo por día de todo el mes.' },
];

function Row({ icon, title, text, tint = Palette.water }: { icon: FeatherName; title: string; text: string; tint?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowText}>{text}</Text>
      </View>
    </View>
  );
}

export default function InfoScreen() {
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl }}
      showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Información</Text>
      <Text style={styles.subtitle}>Cómo funciona CuidaGota y cómo leer tus datos.</Text>

      {/* Tarifa */}
      <View style={styles.tariff}>
        <View>
          <Text style={styles.tariffLabel}>TARIFA APLICADA</Text>
          <Text style={styles.tariffValue}>${PRECIO_POR_LITRO.toFixed(2)}</Text>
        </View>
        <Text style={styles.tariffUnit}>por litro</Text>
      </View>

      <Text style={styles.section}>Cómo se calcula</Text>
      <View style={styles.card}>
        {STEPS.map((s, i) => (
          <View key={s.title}>
            {i > 0 && <View style={styles.divider} />}
            <Row icon={s.icon} title={s.title} text={s.text} tint={s.icon === 'dollar-sign' ? Palette.amber : Palette.water} />
          </View>
        ))}
      </View>

      <Text style={styles.section}>Vistas disponibles</Text>
      <View style={styles.card}>
        {VIEWS.map((v, i) => (
          <View key={v.title}>
            {i > 0 && <View style={styles.divider} />}
            <Row icon={v.icon} title={v.title} text={v.text} />
          </View>
        ))}
      </View>

      <Text style={styles.footer}>CuidaGota · versión {version}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bg },
  title: { fontFamily: Fonts.rounded, fontSize: 28, fontWeight: '800', color: Palette.text },
  subtitle: { fontFamily: Fonts.sans, fontSize: 14, color: Palette.textMuted, marginTop: 4 },

  tariff: {
    marginTop: Spacing.xl,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  tariffLabel: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: Palette.textMuted },
  tariffValue: { fontFamily: Fonts.rounded, fontSize: 40, fontWeight: '800', color: Palette.amber, marginTop: 6, ...tabularNums },
  tariffUnit: { fontFamily: Fonts.sans, fontSize: 14, color: Palette.textMuted, paddingBottom: 8 },

  section: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Palette.textMuted,
    textTransform: 'uppercase',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.lg,
  },
  divider: { height: 1, backgroundColor: Palette.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700', color: Palette.text },
  rowText: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 18, color: Palette.textMuted, marginTop: 2 },

  footer: { fontFamily: Fonts.sans, fontSize: 12, color: Palette.textFaint, textAlign: 'center', marginTop: Spacing.xxl },
});

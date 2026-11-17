import Feather from '@expo/vector-icons/Feather';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref } from 'firebase/database';

import { LiveBadge } from '@/components/live-badge';
import { Skeleton } from '@/components/skeleton';
import { WaterChart } from '@/components/water-chart';
import { PRECIO_POR_LITRO } from '@/constants/app-config';
import { Fonts, Palette, Radius, Spacing, tabularNums } from '@/constants/theme';

const firebaseConfig = {
  apiKey: "AIzaSyD3GB3InbcRxH5bt6IohVKy-ia0dtRd6c8",
  authDomain: "cuidagota.firebaseapp.com",
  databaseURL: "https://cuidagota-default-rtdb.firebaseio.com",
  projectId: "cuidagota",
  storageBucket: "cuidagota.firebasestorage.app",
  messagingSenderId: "130938190941",
  appId: "1:130938190941:web:468a79a5425e42fe1861b4"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const FILTERS = ['diario', 'semanal', 'mensual'] as const;
const LIVE_THRESHOLD_MS = 10 * 60 * 1000;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const timeAgo = (ms: number) => {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'hace instantes';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
};

// Suma el consumo de las lecturas con start <= timestamp < end.
// Requiere la lista ordenada por timestamp: usa búsqueda binaria en vez de recorrerla entera.
const sumDelta = (records: any[], start: number, end: number) => {
  let lo = 0;
  let hi = records.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (records[mid].timestamp < start) lo = mid + 1;
    else hi = mid;
  }
  let sum = 0;
  for (let i = lo; i < records.length && records[i].timestamp < end; i++) sum += records[i].delta;
  return sum;
};

const EMPTY_STATS = {
  chartData: [] as { label: string; liters: number; cost: number }[],
  totalLiters: 0,
  totalCost: 0,
  peakData: { label: '-', liters: 0, cost: 0 },
  previousTotal: 0,
};

export default function CuidaGotaApp() {
  const insets = useSafeAreaInsets();

  // 1. Inicia automáticamente en la fecha actual real
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [filter, setFilter] = useState<'diario' | 'semanal' | 'mensual'>('diario');
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<any>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Solo visual: barra seleccionada y reloj para "hace X min"
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Solo visual: tamaño real de la tarjeta principal (para que el fondo degradé la cubra completa)
  const [heroSize, setHeroSize] = useState({ w: 0, h: 0 });

  // Solo visual: indicador deslizante del selector Diario / Semanal / Mensual
  const [segmentW, setSegmentW] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  // Cambia de vista: el indicador arranca YA (en el hilo nativo) y se hace un único render
  const selectFilter = (f: (typeof FILTERS)[number]) => {
    if (f === filter) return;
    Animated.timing(indicatorX, {
      toValue: FILTERS.indexOf(f),
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    setSelectedIndex(null);
    setFilter(f);
  };
  const segmentBtnW = Math.max(0, (segmentW - 10) / FILTERS.length); // 10 = borde (2) + padding (8)

  // 1. Escuchar la ruta correcta de Firebase (/lecturas)
  useEffect(() => {
    const historyRef = ref(database, 'lecturas');
    
    const unsubscribe = onValue(historyRef, (snapshot) => {
      if (snapshot.exists()) {
        setRawData(snapshot.val());
      } else {
        setRawData({});
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Ordena las lecturas y calcula el consumo de cada una solo cuando llegan datos nuevos
  const recordsWithDelta = useMemo(() => {
    // Convertir el objeto de Firebase en un Array ordenado por timestamp
    let sortedRecords = Object.values(rawData || {})
      .filter((r: any) => r && typeof r.timestamp === 'number')
      .sort((a: any, b: any) => a.timestamp - b.timestamp);

    // Calcular el consumo real (diferencia entre el volumen acumulado actual y el anterior)
    let previousVol = sortedRecords.length > 0 ? (sortedRecords[0] as any).volumenTotal : 0;
    return sortedRecords.map((r: any, index: number) => {
      if (index === 0) return { ...r, delta: 0 };
      let delta = r.volumenTotal - previousVol;
      if (delta < 0) delta = r.volumenTotal; // Por si la ESP32 se reseteó y el contador volvió a 0
      previousVol = r.volumenTotal;
      return { ...r, delta };
    });
  }, [rawData]);

  // 2. Procesar datos procesando la lista plana de Firebase
  const { chartData, totalLiters, totalCost, peakData, previousTotal } = useMemo(() => {
    if (loading) return EMPTY_STATS;

    let processedData: { label: string, liters: number, cost: number }[] = [];
    let sumLiters = 0;

    if (filter === 'diario') {
      const startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();

      for (let h = 0; h <= 23; h++) {
        const hourStart = startOfDay + h * 3600000;
        const hourEnd = hourStart + 3600000;
        const litersInHour = sumDelta(recordsWithDelta, hourStart, hourEnd);

        processedData.push({
          label: `${h.toString().padStart(2, '0')}:00`,
          liters: litersInHour,
          cost: litersInHour * PRECIO_POR_LITRO
        });
        sumLiters += litersInHour;
      }

    } else if (filter === 'semanal') {
      const tempDate = new Date(currentDate);
      const dayOfWeek = tempDate.getDay() === 0 ? 7 : tempDate.getDay();
      tempDate.setDate(tempDate.getDate() - dayOfWeek + 1);
      tempDate.setHours(0, 0, 0, 0);

      const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

      for (let i = 0; i < 7; i++) {
        const dayStart = tempDate.getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        const litersInDay = sumDelta(recordsWithDelta, dayStart, dayEnd);
        
        const d = tempDate.getDate().toString().padStart(2, '0');
        const m = (tempDate.getMonth() + 1).toString().padStart(2, '0');

        processedData.push({
          label: `${diasSemana[i]} ${d}/${m}`,
          liters: litersInDay,
          cost: litersInDay * PRECIO_POR_LITRO
        });
        sumLiters += litersInDay;
        tempDate.setDate(tempDate.getDate() + 1);
      }

    } else if (filter === 'mensual') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStart = new Date(year, month, d).getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;
        const litersInDay = sumDelta(recordsWithDelta, dayStart, dayEnd);

        const dStr = d.toString().padStart(2, '0');
        const mStr = (month + 1).toString().padStart(2, '0');

        processedData.push({
          label: `${dStr}/${mStr}`,
          liters: litersInDay,
          cost: litersInDay * PRECIO_POR_LITRO
        });
        sumLiters += litersInDay;
      }
    }

    let peak = { label: '-', liters: 0, cost: 0 };
    if (processedData.length > 0) {
      peak = processedData.reduce((prev, current) => (prev.liters > current.liters) ? prev : current);
    }

    // Solo visual: litros del período anterior, para mostrar la variación en la tarjeta principal
    let prevStart: number;
    let prevEnd: number;
    if (filter === 'diario') {
      prevStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1).getTime();
      prevEnd = prevStart + 24 * 60 * 60 * 1000;
    } else if (filter === 'semanal') {
      const prevDate = new Date(currentDate);
      const dow = prevDate.getDay() === 0 ? 7 : prevDate.getDay();
      prevDate.setDate(prevDate.getDate() - dow + 1 - 7);
      prevDate.setHours(0, 0, 0, 0);
      prevStart = prevDate.getTime();
      prevEnd = prevStart + 7 * 24 * 60 * 60 * 1000;
    } else {
      prevStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).getTime();
      prevEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime();
    }
    return {
      chartData: processedData,
      totalLiters: sumLiters,
      totalCost: sumLiters * PRECIO_POR_LITRO,
      peakData: peak,
      previousTotal: sumDelta(recordsWithDelta, prevStart, prevEnd),
    };
  }, [loading, recordsWithDelta, filter, currentDate]);

  // Solo visual: reloj para refrescar el "hace X min" de la última lectura
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // --- NAVEGACIÓN INTELIGENTE ---
  const navigateDate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (filter === 'diario') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (filter === 'semanal') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (filter === 'mensual') {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setSelectedIndex(null);
    setCurrentDate(newDate);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setSelectedIndex(null);
      setCurrentDate(selectedDate);
    }
  };

  // Texto según vista (Corregido formato de 2 dígitos)
  const getDateTitle = () => {
    if (filter === 'diario') {
      return currentDate.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    } else if (filter === 'semanal') {
      const temp = new Date(currentDate);
      const dayOfWeek = temp.getDay() === 0 ? 7 : temp.getDay();
      const monday = new Date(temp);
      monday.setDate(temp.getDate() - dayOfWeek + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const mMon = (monday.getMonth() + 1).toString().padStart(2, '0');
      const mSun = (sunday.getMonth() + 1).toString().padStart(2, '0');
      const dMon = monday.getDate().toString().padStart(2, '0');
      const dSun = sunday.getDate().toString().padStart(2, '0');
      
      return `Sem. ${dMon}/${mMon} - ${dSun}/${mSun}/${sunday.getFullYear()}`;
    } else {
      return currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    }
  };

  // --- Solo visual: datos derivados para la interfaz ---
  const lastReading = useMemo(() => {
    let last = 0;
    Object.values(rawData || {}).forEach((r: any) => {
      if (r && typeof r.timestamp === 'number' && r.timestamp > last) last = r.timestamp;
    });
    return last;
  }, [rawData]);

  const sinceLast = lastReading > 0 ? Math.max(0, now - lastReading) : null;
  const liveLabel = sinceLast === null ? 'Sin lecturas' : timeAgo(sinceLast);
  const liveActive = sinceLast !== null && sinceLast <= LIVE_THRESHOLD_MS;

  const prevLabel = filter === 'diario' ? 'día anterior' : filter === 'semanal' ? 'semana anterior' : 'mes anterior';
  const variationPct = previousTotal > 0 ? ((totalLiters - previousTotal) / previousTotal) * 100 : null;
  const selectedPoint = selectedIndex !== null ? chartData[selectedIndex] : undefined;

  const renderVariation = () => {
    if (variationPct === null) {
      if (totalLiters === 0) return null;
      return <Text style={styles.variationMuted}>Sin datos del {prevLabel}</Text>;
    }
    if (Math.abs(variationPct) < 0.5) {
      return (
        <View style={[styles.variationPill, { backgroundColor: Palette.waterSoft }]}>
          <Feather name="minus" size={13} color={Palette.water} />
          <Text style={[styles.variationText, { color: Palette.water }]}>Sin cambios vs. {prevLabel}</Text>
        </View>
      );
    }
    const up = variationPct > 0;
    const color = up ? Palette.warn : Palette.good;
    return (
      <View style={[styles.variationPill, { backgroundColor: up ? Palette.warnSoft : Palette.goodSoft }]}>
        <Feather name={up ? 'arrow-up-right' : 'arrow-down-right'} size={14} color={color} />
        <Text style={[styles.variationText, { color }]}>
          {Math.abs(variationPct).toFixed(0)}% vs. {prevLabel}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl }}
      showsVerticalScrollIndicator={false}>
      {/* ENCABEZADO */}
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Feather name="droplet" size={20} color={Palette.bg} />
          </View>
          <View>
            <Text style={styles.brandTitle}>CuidaGota</Text>
            <Text style={styles.brandSub}>Control de consumo de agua</Text>
          </View>
        </View>
        <LiveBadge label={liveLabel} active={liveActive} />
      </View>

      {/* FILTROS */}
      <View style={styles.segment} onLayout={(e) => setSegmentW(e.nativeEvent.layout.width)}>
        {segmentW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.segmentIndicator,
              {
                width: segmentBtnW,
                transform: [
                  {
                    translateX: indicatorX.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [0, segmentBtnW, segmentBtnW * 2],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={styles.segmentBtn}
            onPress={() => selectFilter(f)}>
            <Text style={[styles.segmentText, filter === f && styles.segmentTextActive]}>{capitalize(f)}</Text>
          </Pressable>
        ))}
      </View>

      {/* NAVEGACIÓN DE FECHA */}
      <View style={styles.dateSelector}>
        <Pressable onPress={() => navigateDate(-1)} style={({ pressed }) => [styles.dateBtn, pressed && styles.pressed]}>
          <Feather name="chevron-left" size={20} color={Palette.water} />
        </Pressable>

        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={({ pressed }) => [styles.calendarTrigger, pressed && styles.pressed]}>
          <Feather name="calendar" size={15} color={Palette.water} />
          <Text style={styles.dateText} numberOfLines={1}>{capitalize(getDateTitle())}</Text>
        </Pressable>

        <Pressable onPress={() => navigateDate(1)} style={({ pressed }) => [styles.dateBtn, pressed && styles.pressed]}>
          <Feather name="chevron-right" size={20} color={Palette.water} />
        </Pressable>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="default"
          themeVariant="dark"
          onChange={onDateChange}
        />
      )}

      {loading ? (
        <View style={{ gap: Spacing.md, marginTop: Spacing.lg }}>
          <Skeleton height={170} radius={Radius.lg} />
          <Skeleton height={84} radius={Radius.lg} />
          <Skeleton height={300} radius={Radius.lg} />
        </View>
      ) : (
        <>
          {/* TARJETA PRINCIPAL: CONSUMO + COSTO */}
          <View
            style={styles.hero}
            onLayout={(e) => setHeroSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
            {heroSize.w > 0 && (
              <Svg style={StyleSheet.absoluteFill} width={heroSize.w} height={heroSize.h}>
                <Defs>
                  <LinearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#1B4B73" />
                    <Stop offset="1" stopColor="#0F2A44" />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={heroSize.w} height={heroSize.h} fill="url(#heroGrad)" />
              </Svg>
            )}

            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Feather name="droplet" size={16} color={Palette.water} />
              </View>
              <Text style={styles.heroLabel}>CONSUMO TOTAL</Text>
            </View>

            <View style={styles.heroValueRow}>
              <Text style={styles.heroValue}>{totalLiters.toFixed(1)}</Text>
              <Text style={styles.heroUnit}>L</Text>
            </View>

            <View style={styles.variationRow}>{renderVariation()}</View>

            <View style={styles.heroDivider} />

            <View style={styles.costRow}>
              <View style={styles.costLeft}>
                <View style={[styles.heroIcon, { backgroundColor: Palette.amberSoft }]}>
                  <Feather name="dollar-sign" size={16} color={Palette.amber} />
                </View>
                <Text style={styles.costLabel}>Costo est.</Text>
              </View>
              <Text style={styles.costValue}>${totalCost.toFixed(2)}</Text>
            </View>
          </View>

          {/* PICO MÁXIMO */}
          <View style={styles.peakCard}>
            <View style={styles.peakAccent} />
            <View style={styles.peakBody}>
              <View style={styles.peakTitleRow}>
                <Feather name={filter === 'diario' ? 'clock' : 'calendar'} size={14} color={Palette.amber} />
                <Text style={styles.peakTitle}>
                  {filter === 'diario' ? 'Hora pico del día' : 'Día de mayor consumo'}
                </Text>
              </View>
              <View style={styles.peakDataRow}>
                <Text style={styles.peakLabel}>{peakData.label}</Text>
                <View style={styles.peakRight}>
                  <Text style={styles.peakValue}>{peakData.liters.toFixed(1)} L</Text>
                  <Text style={styles.peakCost}>${peakData.cost.toFixed(2)} USD</Text>
                </View>
              </View>
            </View>
          </View>

          {/* GRÁFICA */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Detalle {filter}</Text>
              <View style={styles.legend}>
                <View style={[styles.legendDot, { backgroundColor: Palette.water }]} />
                <Text style={styles.legendText}>Consumo</Text>
                <View style={[styles.legendDot, { backgroundColor: Palette.amber, marginLeft: 10 }]} />
                <Text style={styles.legendText}>Pico</Text>
              </View>
            </View>

            <View style={styles.selectedStrip}>
              {selectedPoint ? (
                <>
                  <Text style={styles.selectedLabel}>{selectedPoint.label}</Text>
                  <View style={styles.selectedValues}>
                    <Text style={styles.selectedLiters}>{selectedPoint.liters.toFixed(1)} L</Text>
                    <Text style={styles.selectedCost}>${selectedPoint.cost.toFixed(2)}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.selectedHint}>Tocá una barra para ver el detalle</Text>
              )}
            </View>

            <WaterChart
              data={chartData}
              filter={filter}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              animationKey={`${filter}-${currentDate.toDateString()}`}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Palette.bg },
  pressed: { opacity: 0.7 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Palette.water,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: { fontFamily: Fonts.rounded, fontSize: 20, fontWeight: '800', color: Palette.text, letterSpacing: 0.2 },
  brandSub: { fontFamily: Fonts.sans, fontSize: 11, color: Palette.textMuted, marginTop: 1 },

  segment: {
    flexDirection: 'row',
    backgroundColor: Palette.surface,
    borderRadius: Radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.md,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: Radius.pill, alignItems: 'center' },
  segmentIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: Radius.pill,
    backgroundColor: Palette.water,
  },
  segmentText: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '600', color: Palette.textMuted },
  segmentTextActive: { color: Palette.bg, fontWeight: '800' },

  dateSelector: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dateBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarTrigger: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  dateText: { fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700', color: Palette.text, flexShrink: 1 },

  hero: {
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#15395A',
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Palette.waterSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, color: Palette.textMuted },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: Spacing.md },
  heroValue: { fontFamily: Fonts.rounded, fontSize: 52, fontWeight: '800', color: Palette.text, ...tabularNums },
  heroUnit: { fontFamily: Fonts.rounded, fontSize: 24, fontWeight: '700', color: Palette.water, marginLeft: 6 },
  variationRow: { marginTop: Spacing.sm, minHeight: 28, flexDirection: 'row' },
  variationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  variationText: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700' },
  variationMuted: { fontFamily: Fonts.sans, fontSize: 12, color: Palette.textFaint, paddingVertical: 5 },
  heroDivider: { height: 1, backgroundColor: Palette.border, marginVertical: Spacing.lg },
  costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  costLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  costLabel: { fontFamily: Fonts.sans, fontSize: 14, fontWeight: '600', color: Palette.textMuted },
  costValue: { fontFamily: Fonts.rounded, fontSize: 28, fontWeight: '800', color: Palette.amber, ...tabularNums },

  peakCard: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  peakAccent: { width: 4, backgroundColor: Palette.amber },
  peakBody: { flex: 1, padding: Spacing.lg },
  peakTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  peakTitle: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: Palette.amber },
  peakDataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.md },
  peakLabel: { fontFamily: Fonts.rounded, fontSize: 20, fontWeight: '800', color: Palette.text, flexShrink: 1, ...tabularNums },
  peakRight: { alignItems: 'flex-end' },
  peakValue: { fontFamily: Fonts.rounded, fontSize: 18, fontWeight: '800', color: Palette.water, ...tabularNums },
  peakCost: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '600', color: Palette.amber, marginTop: 2, ...tabularNums },

  chartCard: {
    marginTop: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: { fontFamily: Fonts.rounded, fontSize: 16, fontWeight: '800', color: Palette.text },
  legend: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendText: { fontFamily: Fonts.sans, fontSize: 11, color: Palette.textMuted },
  selectedStrip: {
    height: 40,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    backgroundColor: Palette.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedLabel: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700', color: Palette.text, ...tabularNums },
  selectedValues: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  selectedLiters: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '800', color: Palette.water, ...tabularNums },
  selectedCost: { fontFamily: Fonts.sans, fontSize: 13, fontWeight: '800', color: Palette.amber, ...tabularNums },
  selectedHint: { fontFamily: Fonts.sans, fontSize: 12, color: Palette.textFaint },
});

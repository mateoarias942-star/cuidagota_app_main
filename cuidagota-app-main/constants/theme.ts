import { Platform } from 'react-native';

/**
 * Sistema de diseño de CuidaGota.
 * Idea: agua profunda (azul noche) + acentos cálidos (ámbar) para lo que importa (costo y pico).
 */
export const Palette = {
  // Fondos y superficies
  bg: '#0B1F33',
  surface: '#12304A',
  surfaceAlt: '#163A57',
  border: '#1F4666',

  // Agua
  water: '#38BDF8',
  waterDeep: '#1D6FA5',
  waterSoft: 'rgba(56, 189, 248, 0.14)',

  // Cálidos
  amber: '#F2A65A',
  amberSoft: 'rgba(242, 166, 90, 0.14)',

  // Texto
  text: '#EAF2F8',
  textMuted: '#8FA7BC',
  textFaint: '#5F7A92',

  // Estados (en agua, consumir menos es lo bueno)
  good: '#4ADE80',
  goodSoft: 'rgba(74, 222, 128, 0.14)',
  warn: '#F87171',
  warnSoft: 'rgba(248, 113, 113, 0.14)',
} as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const Radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    rounded: "'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
})!;

/** Cifras de ancho fijo para que los números no "bailen" al cambiar. */
export const tabularNums = { fontVariant: ['tabular-nums'] as ['tabular-nums'] };

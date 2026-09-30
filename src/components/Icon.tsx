import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home' | 'calendar' | 'chart' | 'sliders' | 'food' | 'chevron-left' | 'chevron-right'
  | 'chevron-down' | 'arrow-right' | 'arrow-left' | 'x' | 'check' | 'plus' | 'minus' | 'upload' | 'download'
  | 'lock' | 'bell' | 'droplet' | 'heart' | 'shield' | 'sun' | 'moon' | 'edit' | 'info'
  | 'activity' | 'thermometer' | 'smartphone' | 'file' | 'trash' | 'circle-dot' | 'sparkle' | 'refresh' | 'external';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <Path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z" />,
  calendar: <><Rect x="3" y="5" width="18" height="16" rx="2" /><Path d="M16 3v4M8 3v4M3 10h18" /></>,
  chart: <Path d="M4 20v-8M10 20V5M16 20v-5M22 20H2" />,
  sliders: <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  food: <Path d="M3 2v7a3 3 0 0 0 6 0V2M6 2v20M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zM21 15v7" />,
  'chevron-left': <Path d="M15 18l-6-6 6-6" />,
  'chevron-right': <Path d="M9 18l6-6-6-6" />,
  'chevron-down': <Path d="M6 9l6 6 6-6" />,
  'arrow-right': <Path d="M5 12h14M12 5l7 7-7 7" />,
  'arrow-left': <Path d="M19 12H5M12 19l-7-7 7-7" />,
  x: <Path d="M18 6L6 18M6 6l12 12" />,
  check: <Path d="M20 6L9 17l-5-5" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  upload: <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />,
  download: <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  lock: <><Rect x="3" y="11" width="18" height="11" rx="2" /><Path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  bell: <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />,
  droplet: <Path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  heart: <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  shield: <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  sun: <><Circle cx="12" cy="12" r="5" /><Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></>,
  moon: <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  edit: <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
  info: <><Circle cx="12" cy="12" r="10" /><Path d="M12 16v-4M12 8h.01" /></>,
  activity: <Path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  thermometer: <Path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />,
  smartphone: <><Rect x="5" y="2" width="14" height="20" rx="2" /><Path d="M12 18h.01" /></>,
  file: <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />,
  trash: <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />,
  'circle-dot': <><Circle cx="12" cy="12" r="9" /><Circle cx="12" cy="12" r="3" fill="currentColor" /></>,
  sparkle: <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z" />,
  refresh: <Path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />,
  external: <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />,
};

/** Consistent 24-unit line icons, drawn with react-native-svg so no icon font is needed. */
export function Icon({ name, size = 22, color = '#000', strokeWidth = 1.8, fill }: { name: IconName; size?: number; color?: string; strokeWidth?: number; fill?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? color : 'none'} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" color={color}>
      {PATHS[name]}
    </Svg>
  );
}

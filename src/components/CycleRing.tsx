import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import type { CycleModel } from '../logic/cycles';
import { diffDays, type ISODate } from '../logic/dates';
import type { Palette } from '../theme';
import { Txt } from './ui';

function arcPath(cx: number, cy: number, r: number, startFrac: number, endFrac: number): string {
  const s = Math.max(0, Math.min(1, startFrac));
  const e = Math.max(0, Math.min(1, endFrac));
  if (e - s <= 0) return '';
  const a0 = s * Math.PI * 2 - Math.PI / 2;
  const a1 = e * Math.PI * 2 - Math.PI / 2;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = e - s > 0.5 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

export function CycleRing({
  model, today, palette, size = 280, children,
}: {
  model: CycleModel;
  today: ISODate;
  palette: Palette;
  size?: number;
  children?: React.ReactNode;
}) {
  const cur = model.predictions[0];
  const stroke = 12;
  const r = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2;
  const total = cur ? diffDays(cur.start, cur.end) + 1 : 28;
  const frac = (d: ISODate) => diffDays(cur?.start ?? today, d) / total;
  const dayFrac = cur ? (diffDays(cur.start, today) + 0.5) / total : 0;
  const periodDays = cur ? model.lastPeriod?.days.filter((d) => d >= cur.start) ?? [] : [];
  const loggedEnd = periodDays.length ? periodDays[periodDays.length - 1] : undefined;
  const periodEnd = loggedEnd ?? cur?.periodEnd;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={cx} cy={cy} r={r} stroke={palette.surfaceAlt} strokeWidth={stroke} fill="none" />
        {cur ? (
          <G>
            {periodEnd ? (
              <Path d={arcPath(cx, cy, r, 0, frac(periodEnd) + 1 / total)} stroke={palette.period} strokeWidth={stroke} fill="none" strokeLinecap="round" />
            ) : null}
            {cur.fertileStart && cur.fertileEnd ? (
              <Path d={arcPath(cx, cy, r, frac(cur.fertileStart), frac(cur.fertileEnd) + 1 / total)} stroke={palette.fertileSoft} strokeWidth={stroke} fill="none" />
            ) : null}
            {cur.ovulation ? (
              <Path d={arcPath(cx, cy, r, frac(cur.ovulation), frac(cur.ovulation) + 1 / total)} stroke={palette.fertile} strokeWidth={stroke} fill="none" />
            ) : null}
            <Path d={arcPath(cx, cy, r, Math.max(0, 1 - 5 / total), 1)} stroke={palette.pmsSoft} strokeWidth={stroke - 6} fill="none" />
            {Array.from({ length: total }, (_, i) => {
              const angle = (i + 0.5) / total * Math.PI * 2 - Math.PI / 2;
              return <Circle key={i} cx={cx + (r - 15) * Math.cos(angle)} cy={cy + (r - 15) * Math.sin(angle)} r={3} fill={palette.luteal} opacity={0.32} />;
            })}
            <Circle
              cx={cx + r * Math.cos(dayFrac * Math.PI * 2 - Math.PI / 2)}
              cy={cy + r * Math.sin(dayFrac * Math.PI * 2 - Math.PI / 2)}
              r={stroke / 2 + 3}
              fill={palette.accent}
              stroke={palette.bg}
              strokeWidth={3}
            />
          </G>
        ) : null}
      </Svg>
      <View style={{ alignItems: 'center', paddingHorizontal: 30 }}>{children ?? <Txt muted>No data</Txt>}</View>
    </View>
  );
}

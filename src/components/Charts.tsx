import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { font, space, type Palette } from '../theme';
import { Txt } from './ui';

export function BarChart({
  values, labels, palette, highlight, width = 320, height = 140, reference, unit = '',
}: {
  values: number[];
  labels: string[];
  palette: Palette;
  highlight?: (i: number) => boolean;
  width?: number;
  height?: number;
  reference?: number;
  unit?: string;
}) {
  if (values.length === 0) return <Txt muted>Not enough data yet.</Txt>;
  const padL = 28;
  const padB = 22;
  const padT = 14;
  const max = Math.max(...values, reference ?? 0) * 1.15;
  const min = 0;
  const w = width - padL - 8;
  const h = height - padB - padT;
  const bw = Math.min(28, (w / values.length) * 0.6);
  const gap = w / values.length;
  const y = (v: number) => padT + h - ((v - min) / (max - min)) * h;
  return (
    <Svg width={width} height={height}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <Line key={f} x1={padL} x2={width - 8} y1={y(max * f)} y2={y(max * f)} stroke={palette.border} strokeWidth={1} />
      ))}
      {reference !== undefined ? (
        <Line x1={padL} x2={width - 8} y1={y(reference)} y2={y(reference)} stroke={palette.accent} strokeDasharray="4 4" strokeWidth={1.5} />
      ) : null}
      {values.map((v, i) => (
        <React.Fragment key={i}>
          <Rect
            x={padL + i * gap + (gap - bw) / 2}
            y={y(v)}
            width={bw}
            height={h + padT - y(v)}
            rx={5}
            fill={highlight?.(i) ? palette.textFaint : palette.accent}
          />
          <SvgText x={padL + i * gap + gap / 2} y={y(v) - 4} fontSize={font.tiny} fill={palette.textMuted} textAnchor="middle">
            {`${Math.round(v)}${unit}`}
          </SvgText>
          <SvgText x={padL + i * gap + gap / 2} y={height - 6} fontSize={font.tiny} fill={palette.textFaint} textAnchor="middle">
            {labels[i] ?? ''}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

export function LineChart({
  points, palette, width = 320, height = 160, markers = [], yFormat, coverLine,
}: {
  points: { x: number; y: number; faded?: boolean }[];
  palette: Palette;
  width?: number;
  height?: number;
  /** Vertical markers at x positions with a colour. */
  markers?: { x: number; color: string; label?: string }[];
  yFormat?: (v: number) => string;
  /** Horizontal reference line. */
  coverLine?: number;
}) {
  if (points.length < 2) return <Txt muted>Log a few temperatures to see the curve.</Txt>;
  const padL = 40;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs, ...markers.map((m) => m.x));
  const maxX = Math.max(...xs, ...markers.map((m) => m.x));
  const minY = Math.floor((Math.min(...ys) - 0.1) * 10) / 10;
  const maxY = Math.ceil((Math.max(...ys) + 0.1) * 10) / 10;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const sx = (x: number) => padL + ((x - minX) / Math.max(1, maxX - minX)) * w;
  const sy = (y: number) => padT + h - ((y - minY) / Math.max(0.1, maxY - minY)) * h;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x)} ${sy(p.y)}`).join(' ');
  const ticks = [minY, (minY + maxY) / 2, maxY];
  return (
    <Svg width={width} height={height}>
      {ticks.map((t) => (
        <React.Fragment key={t}>
          <Line x1={padL} x2={width - padR} y1={sy(t)} y2={sy(t)} stroke={palette.border} strokeWidth={1} />
          <SvgText x={padL - 6} y={sy(t) + 4} fontSize={font.tiny} fill={palette.textFaint} textAnchor="end">
            {yFormat ? yFormat(t) : t.toFixed(1)}
          </SvgText>
        </React.Fragment>
      ))}
      {coverLine !== undefined ? (
        <Line x1={padL} x2={width - padR} y1={sy(coverLine)} y2={sy(coverLine)} stroke={palette.pms} strokeDasharray="4 3" strokeWidth={1.5} />
      ) : null}
      {markers.map((m, i) => (
        <React.Fragment key={i}>
          <Line x1={sx(m.x)} x2={sx(m.x)} y1={padT} y2={padT + h} stroke={m.color} strokeWidth={2} strokeDasharray="3 3" />
          {m.label ? (
            <SvgText x={sx(m.x)} y={height - 6} fontSize={font.tiny} fill={m.color} textAnchor="middle">{m.label}</SvgText>
          ) : null}
        </React.Fragment>
      ))}
      <Path d={d} stroke={palette.accent} strokeWidth={2} fill="none" />
      {points.map((p, i) => (
        <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill={p.faded ? palette.surface : palette.accent} stroke={palette.accent} strokeWidth={1.5} />
      ))}
      <SvgText x={padL} y={height - 6} fontSize={font.tiny} fill={palette.textFaint}>{`day ${minX}`}</SvgText>
      <SvgText x={width - padR} y={height - 6} fontSize={font.tiny} fill={palette.textFaint} textAnchor="end">{`day ${maxX}`}</SvgText>
    </Svg>
  );
}

export function PhaseBars({
  rows, palette,
}: {
  rows: { label: string; values: { phase: string; value: number; color: string }[] }[];
  palette: Palette;
}) {
  return (
    <View style={{ gap: space.md }}>
      {rows.map((r) => (
        <View key={r.label}>
          <Txt size={font.small} weight="500">{r.label}</Txt>
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, height: 10 }}>
            {r.values.map((v) => (
              <View key={v.phase} style={{ flex: 1, backgroundColor: palette.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(Math.min(1, v.value) * 100)}%`, height: '100%', backgroundColor: v.color }} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

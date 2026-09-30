import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { dayStatus, type CycleModel } from '../logic/cycles';
import {
  addDays, daysInMonth, fromISO, pad2, toISO, WEEKDAYS_MIN, type ISODate,
} from '../logic/dates';
import type { DayLog } from '../logic/types';
import { font, radius, space, type Palette } from '../theme';
import { Txt, usePal } from './ui';
import { Icon } from './Icon';

export interface MonthGridProps {
  year: number;
  month0: number;
  model: CycleModel;
  logs: Record<ISODate, DayLog>;
  today: ISODate;
  firstDayOfWeek: 0 | 1;
  selected?: ISODate;
  onSelectDay: (d: ISODate) => void;
  /** In edit mode, days are toggled instead of selected. */
  editing?: boolean;
  editSet?: Set<ISODate>;
}

function hasEntries(log: DayLog | undefined): boolean {
  if (!log) return false;
  const { date: _d, flow: _f, ...rest } = log;
  return Object.values(rest).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '' && v !== false));
}

export function MonthGrid(props: MonthGridProps) {
  const { year, month0, model, logs, today, firstDayOfWeek, selected, onSelectDay, editing, editSet } = props;
  const p = usePal();
  const cells = useMemo(() => {
    const dim = daysInMonth(year, month0);
    const first = new Date(year, month0, 1).getDay();
    const lead = (first - firstDayOfWeek + 7) % 7;
    const out: (ISODate | null)[] = [];
    for (let i = 0; i < lead; i += 1) out.push(null);
    for (let d = 1; d <= dim; d += 1) out.push(`${year}-${pad2(month0 + 1)}-${pad2(d)}`);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month0, firstDayOfWeek]);

  const weekdays = useMemo(() => {
    const w = [...WEEKDAYS_MIN];
    return firstDayOfWeek === 1 ? [...w.slice(1), w[0] as string] : w;
  }, [firstDayOfWeek]);

  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {weekdays.map((w, i) => (
          <View key={`${w}${i}`} style={{ flex: 1, alignItems: 'center' }}>
            <Txt size={font.tiny} faint weight="600">{w}</Txt>
          </View>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {cells.slice(r * 7, r * 7 + 7).map((iso, c) => (
            <View key={c} style={{ flex: 1, alignItems: 'center', paddingVertical: 3 }}>
              {iso ? (
                <DayCell
                  iso={iso}
                  status={dayStatus(model, logs, iso, today)}
                  log={logs[iso]}
                  isToday={iso === today}
                  isSelected={iso === selected}
                  isFuture={iso > today}
                  editing={!!editing}
                  edited={editSet?.has(iso) ?? false}
                  onPress={() => onSelectDay(iso)}
                  p={p}
                />
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function DayCell({
  iso, status, log, isToday, isSelected, isFuture, editing, edited, onPress, p,
}: {
  iso: ISODate;
  status: ReturnType<typeof dayStatus>;
  log: DayLog | undefined;
  isToday: boolean;
  isSelected: boolean;
  isFuture: boolean;
  editing: boolean;
  edited: boolean;
  onPress: () => void;
  p: Palette;
}) {
  const bleeding = editing ? edited : status.logged;
  let bg = 'transparent';
  let fg = p.text;
  let border = 'transparent';
  let dashed = false;
  if (bleeding) {
    bg = p.period;
    fg = p.onAccent;
  } else if (status.spotting && !editing) {
    bg = p.periodSoft;
    border = p.period;
  } else if (status.predictedPeriod && !editing) {
    bg = p.periodSoft;
    border = p.period;
    dashed = true;
  } else if (status.ovulation && !editing) {
    bg = p.ovulation;
    fg = p.onAccent;
  } else if (status.fertile && !editing) {
    bg = p.fertileSoft;
    border = p.fertile;
  } else if (status.pms && !editing) {
    bg = p.pmsSoft;
  }
  if (isFuture && !bleeding) fg = status.predictedPeriod || status.fertile || status.pms ? p.text : p.textFaint;
  const day = fromISO(iso).getDate();
  return (
    <Pressable
      testID={`day-${iso}`}
      accessibilityRole="button"
      accessibilityLabel={`${iso}${bleeding ? ', period' : status.predictedPeriod ? ', predicted period' : status.ovulation ? ', ovulation' : status.fertile ? ', fertile' : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 40,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        backgroundColor: bg,
        borderWidth: 1.5,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: isSelected ? p.accent : border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt size={font.small} weight={isToday ? '700' : '500'} color={fg} style={isToday ? { textDecorationLine: 'underline' } : undefined}>
        {day}
      </Txt>
      <View style={{ height: 6, marginTop: 2, flexDirection: 'row', gap: 2 }}>
        {hasEntries(log) ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: bleeding || status.ovulation ? p.onAccent : p.accent }} /> : null}
        {status.ovulationEvidence && status.ovulation ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: p.onAccent }} /> : null}
      </View>
    </Pressable>
  );
}

export function MonthNav({
  label, onPrev, onNext, onToday,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday?: () => void;
}) {
  const p = usePal();
  const btn = (t: string, fn: () => void, id: string, label: string) => (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={fn}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
    >
      <Icon name={t === '‹' ? 'chevron-left' : 'chevron-right'} size={20} color={p.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
      {btn('‹', onPrev, 'month-prev', 'Previous month')}
      <Pressable onPress={onToday} accessibilityRole="button" testID="month-label">
        <Txt size={font.heading} weight="600">{label}</Txt>
      </Pressable>
      {btn('›', onNext, 'month-next', 'Next month')}
    </View>
  );
}

export { addDays, toISO };

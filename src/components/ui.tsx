import React from 'react';
import {
  Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../state';
import { font, radius, space, typeface, type Palette } from '../theme';
import { Icon, type IconName } from './Icon';

export function usePal(): Palette {
  return useStore().palette;
}

export function Txt({
  children, muted, faint, size = font.body, weight, style, color, center, testID, numberOfLines, serif,
}: {
  children: React.ReactNode;
  muted?: boolean;
  faint?: boolean;
  size?: number;
  weight?: '400' | '500' | '600' | '700';
  style?: StyleProp<TextStyle>;
  color?: string;
  center?: boolean;
  testID?: string;
  numberOfLines?: number;
  serif?: boolean;
}) {
  const p = usePal();
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={[
        { color: color ?? (faint ? p.textFaint : muted ? p.textMuted : p.text), fontSize: size, lineHeight: Math.round(size * 1.4) },
        { fontFamily: serif ? typeface.serif : weight === '700' ? typeface.bold : weight === '600' ? typeface.semibold : weight === '500' ? typeface.medium : typeface.regular },
        center ? { textAlign: 'center' } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Txt serif size={21} style={style}>{children}</Txt>;
}

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Txt serif size={30} style={[{ letterSpacing: -0.3 }, style]}>{children}</Txt>;
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const p = usePal();
  return (
    <View
      testID={testID}
      style={[
        { backgroundColor: p.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 0, borderColor: p.border, boxShadow: p.name === 'light' ? '0 1px 2px rgba(53,41,31,0.05), 0 6px 18px rgba(53,41,31,0.05)' : '0 1px 2px rgba(0,0,0,0.25)' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, style, gap = space.sm, align = 'center' }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number; align?: ViewStyle['alignItems'] }) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>{children}</View>;
}

export function Spacer({ h = space.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Button({
  label, onPress, variant = 'primary', disabled, style, testID, small, color, icon, iconLeft,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  small?: boolean;
  color?: string;
  /** Trailing icon. */
  icon?: IconName;
  /** Leading icon. */
  iconLeft?: IconName;
}) {
  const p = usePal();
  const bg = variant === 'primary' ? (color ?? p.accent) : variant === 'danger' ? p.danger : variant === 'secondary' ? p.surfaceAlt : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? p.onAccent : variant === 'ghost' ? (color ?? p.accent) : p.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: small ? 8 : 14,
          paddingHorizontal: small ? 14 : 20,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: p.border,
          flexDirection: 'row',
          gap: 8,
        },
        style,
      ]}
    >
      {iconLeft ? <Icon name={iconLeft} size={small ? 16 : 18} color={variant === 'danger' ? '#fff' : fg} strokeWidth={2} /> : null}
      <Txt color={variant === 'danger' ? '#fff' : fg} weight="600" size={small ? font.small : font.body}>{label}</Txt>
      {icon ? <Icon name={icon} size={small ? 16 : 18} color={variant === 'danger' ? '#fff' : fg} strokeWidth={2} /> : null}
    </Pressable>
  );
}

export function Chip({
  label, selected, onPress, color, testID, style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePal();
  const c = color ?? p.accent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? "checkbox" : undefined}
      accessibilityState={{ checked: !!selected }}
      aria-checked={!!selected}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          justifyContent: 'center',
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: selected ? c : p.border,
          backgroundColor: selected ? c : p.surface,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Txt size={font.small} weight={selected ? '600' : '500'} color={selected ? p.onAccent : p.text}>{label}</Txt>
    </Pressable>
  );
}

export function ChipGroup({
  options, selected, onToggle, color, multi = true, testPrefix,
}: {
  options: { id: string; label: string }[];
  selected: string[] | string | undefined;
  onToggle: (id: string) => void;
  color?: string;
  multi?: boolean;
  testPrefix?: string;
}) {
  const sel = Array.isArray(selected) ? selected : selected ? [selected] : [];
  void multi;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => (
        <Chip
          key={o.id}
          label={o.label}
          selected={sel.includes(o.id)}
          onPress={() => onToggle(o.id)}
          color={color}
          testID={testPrefix ? `${testPrefix}-${o.id}` : undefined}
        />
      ))}
    </View>
  );
}

export function Segmented<T extends string>({
  options, value, onChange, testPrefix,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testPrefix?: string;
}) {
  const p = usePal();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: p.surfaceAlt, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            testID={testPrefix ? `${testPrefix}-${o.id}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.id)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: radius.sm,
              backgroundColor: active ? p.surface : 'transparent',
              alignItems: 'center',
            }}
          >
            <Txt size={font.small} weight={active ? '600' : '500'} muted={!active}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  value, onChange, min, max, step = 1, format, testID,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  testID?: string;
}) {
  const p = usePal();
  const btn = (label: string, delta: number, id: string) => (
    <Pressable
      testID={testID ? `${testID}-${id}` : undefined}
      accessibilityRole="button"
      accessibilityLabel={label === '−' ? 'Decrease' : 'Increase'}
      onPress={() => onChange(Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100)))}
      style={({ pressed }) => ({
        width: 40, height: 40, borderRadius: 20, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt size={22} weight="500">{label}</Txt>
    </Pressable>
  );
  return (
    <Row gap={space.md}>
      {btn('−', -step, 'minus')}
      <Txt testID={testID ? `${testID}-value` : undefined} size={font.heading} weight="600" style={{ minWidth: 64, textAlign: 'center' }}>
        {format ? format(value) : String(value)}
      </Txt>
      {btn('+', step, 'plus')}
    </Row>
  );
}

export function ToggleRow({
  label, hint, value, onChange, testID,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  const p = usePal();
  return (
    <Row style={{ paddingVertical: 10, justifyContent: 'space-between' }}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Txt weight="500">{label}</Txt>
        {hint ? <Txt size={font.small} muted>{hint}</Txt> : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: p.accent, false: p.border }}
        thumbColor={Platform.OS === 'android' ? (value ? p.surface : p.surface) : undefined}
      />
    </Row>
  );
}

export function Field({
  label, editable = true, maxLength, value, onChangeText, placeholder, multiline, keyboardType, testID, style,
}: {
  label?: string;
  editable?: boolean;
  maxLength?: number;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'number-pad';
  testID?: string;
  style?: StyleProp<TextStyle>;
}) {
  const p = usePal();
  const input = (
    <TextInput
      testID={testID}
      accessibilityLabel={label ?? placeholder}
      editable={editable}
      maxLength={maxLength}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={p.textFaint}
      multiline={multiline}
      keyboardType={keyboardType}
      style={[
        {
          backgroundColor: p.surfaceAlt,
          color: p.text,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: font.body,
          fontFamily: typeface.regular,
          borderWidth: 1, borderColor: p.border,
          minHeight: multiline ? 90 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
    />
  );
  return label ? <View style={{ gap: 6 }}><Txt size={14} weight="600">{label}</Txt>{input}</View> : input;
}

export function Sheet({
  visible, onClose, title, children, testID, footer, closeLabel = 'Done',
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  testID?: string;
  footer?: React.ReactNode;
  closeLabel?: string;
}) {
  const p = usePal();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
      <View testID={testID} style={{ backgroundColor: p.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center', paddingBottom: insets.bottom }}>
        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
        </View>
        {title ? (
          <Row style={{ paddingHorizontal: space.lg, paddingTop: space.md, justifyContent: 'space-between' }}>
            <Heading>{title}</Heading>
            <IconButton name="x" label={closeLabel} onPress={onClose} testID={testID ? `${testID}-done` : undefined} />
          </Row>
        ) : null}
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer}
      </View>
    </Modal>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function Divider() {
  const p = usePal();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border, marginVertical: space.sm }} />;
}

export function PressableRow({ children, onPress, testID, style }: { children: React.ReactNode; onPress?: () => void; testID?: string; style?: StyleProp<ViewStyle> } & Pick<PressableProps, 'accessibilityLabel'>) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, style]}>
      {children}
    </Pressable>
  );
}

export function Chevron() {
  const p = usePal();
  return <Txt color={p.textFaint} size={18}>›</Txt>;
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {items.map((it) => (
        <Row key={it.label} gap={6}>
          <Dot color={it.color} />
          <Txt size={font.tiny} muted>{it.label}</Txt>
        </Row>
      ))}
    </View>
  );
}

/** Round tappable icon, used for header actions and sheet close buttons. */
export function IconButton({ name, label, onPress, testID, size = 40, tint, filled = true }: { name: IconName; label: string; onPress?: () => void; testID?: string; size?: number; tint?: string; filled?: boolean }) {
  const p = usePal();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: filled ? p.surfaceAlt : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
    >
      <Icon name={name} size={Math.round(size * 0.5)} color={tint ?? p.text} />
    </Pressable>
  );
}

/** Screen title block shared by the main tabs. */
export function ScreenHeader({ title, subtitle, right, wordmark }: { title: string; subtitle?: string; right?: React.ReactNode; wordmark?: boolean }) {
  const p = usePal();
  return (
    <View style={{ marginBottom: space.lg }}>
      {wordmark ? (
        <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
          <Txt serif size={34} style={{ letterSpacing: -1.5, lineHeight: 40 }} color={p.accent}>ebb</Txt>
          {right}
        </Row>
      ) : null}
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          {subtitle ? <Txt size={font.small} muted weight="500">{subtitle}</Txt> : null}
          <Txt serif size={30} style={{ letterSpacing: -0.3, lineHeight: 36 }}>{title}</Txt>
        </View>
        {!wordmark ? right : null}
      </Row>
    </View>
  );
}

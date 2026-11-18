import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { tick } from '@/lib/feel';
import { money, titleCase, toNumber } from '@/lib/format';
import { snackArt } from '@/lib/snack-art';
import type { Basket, ConcessionItem, ConcessionOption, OptionGroup, PaymentMethod } from '@/lib/types';
import { colors, radius, touch } from '@/theme';

import { Button } from './controls';
import { Body, Display, Label, Mono } from './type';

export const MAX_EACH = 20;

const GROUPS: { key: OptionGroup; label: string }[] = [
  { key: 'SIZE', label: 'Size' },
  { key: 'FLAVOUR', label: 'Flavour' },
  { key: 'DRINK', label: 'Drink' },
  { key: 'EXTRA', label: 'Extras' },
];
const SINGLE = new Set<OptionGroup>(['SIZE', 'FLAVOUR', 'DRINK']);

export const lineKey = (itemId: number, options: number[]) => `${itemId}|${[...options].sort((a, b) => a - b).join(',')}`;

export function basketCount(b: Basket) {
  return Object.values(b).reduce((a, l) => a + l.quantity, 0);
}

/** Unit price of an item with these options */
export function unitPrice(item: ConcessionItem, options: number[]) {
  const deltas = (item.options ?? []).filter((o) => options.includes(o.optionId)).reduce((a, o) => a + toNumber(o.priceDelta), 0);
  return toNumber(item.price) + deltas;
}

export function basketTotal(b: Basket, items: ConcessionItem[]) {
  const byId = new Map(items.map((i) => [i.itemId, i]));
  return Object.values(b).reduce((a, l) => {
    const it = byId.get(l.itemId);
    return it ? a + unitPrice(it, l.options) * l.quantity : a;
  }, 0);
}

/** Add (or change) the quantity of a line; 0 removes it. */
export function setLine(b: Basket, itemId: number, options: number[], q: number): Basket {
  const key = lineKey(itemId, options);
  const next = { ...b };
  if (q <= 0) delete next[key];
  else next[key] = { itemId, options: [...options].sort((x, y) => x - y), quantity: Math.min(MAX_EACH, q) };
  return next;
}

/** Restore a basket from saved order lines */
export function basketFromOrders(orders: { source: string; items: { itemId: number; quantity: number; options?: number[] }[] }[]): Basket {
  let b: Basket = {};
  orders
    .filter((o) => o.source === 'BOOKING')
    .forEach((o) =>
      o.items.forEach((i) => {
        const opts = i.options ?? [];
        b = setLine(b, i.itemId, opts, (b[lineKey(i.itemId, opts)]?.quantity ?? 0) + i.quantity);
      }),
    );
  return b;
}

/** "Large · Extra butter" for a line's options */
export function optionsText(item: ConcessionItem, options: number[]) {
  const order = GROUPS.map((g) => g.key);
  return (item.options ?? [])
    .filter((o) => options.includes(o.optionId))
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
    .map((o) => o.name)
    .join(' · ');
}

const CATEGORY_ORDER = ['COMBOS', 'POPCORN', 'DRINKS', 'SNACKS'];

export function categoriesOf(items: ConcessionItem[]) {
  const present = [...new Set(items.map((i) => i.category.toUpperCase()))];
  return present.sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
}

/** Product photo; if there isn't one (or it fails) we draw the snack instead. */
export function ItemImage({ uri, name, size, category }: { uri?: string | null; name: string; size: number; category?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[styles.img, { width: size, height: size, overflow: 'hidden' }]} accessibilityRole="image" accessibilityLabel={name}>
        <SvgXml xml={snackArt(name, category)} width={size} height={size} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.img, { width: size, height: size }]}
      contentFit="cover"
      transition={150}
      onError={() => setFailed(true)}
      accessibilityLabel={name}
    />
  );
}

/** − qty + with 44pt targets. */
export function Stepper({ name, value, onChange, addLabel = 'ADD' }: { name: string; value: number; onChange: (v: number) => void; addLabel?: string }) {
  const change = (v: number) => {
    tick();
    onChange(v);
  };
  if (value === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${name}`}
        onPress={() => change(1)}
        style={({ pressed }) => [styles.add, pressed && { opacity: 0.7 }]}>
        <Mono size={13} color={colors.bone}>
          {addLabel}
        </Mono>
      </Pressable>
    );
  }
  return (
    <View style={styles.stepper} accessibilityLabel={`${name}, ${value} in basket`}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove one ${name}`} onPress={() => change(value - 1)} style={styles.stepBtn}>
        <Mono size={18}>−</Mono>
      </Pressable>
      <Mono size={15} style={{ minWidth: 24, textAlign: 'center' }} accessibilityLiveRegion="polite">
        {value}
      </Mono>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add one ${name}`}
        accessibilityState={{ disabled: value >= MAX_EACH }}
        disabled={value >= MAX_EACH}
        onPress={() => change(value + 1)}
        style={[styles.stepBtn, value >= MAX_EACH && { opacity: 0.4 }]}>
        <Mono size={18}>+</Mono>
      </Pressable>
    </View>
  );
}

/**
 * The menu, grouped by category. Plain items get a stepper; items with
 * upgrades open a sheet to choose size, flavour, drink and extras, and
 * each combination they add shows as its own line under the item.
 */
export function Menu({
  items,
  basket,
  onChange,
  only,
}: {
  items: ConcessionItem[];
  basket: Basket;
  onChange: (b: Basket) => void;
  only?: string | null;
}) {
  const [custom, setCustom] = useState<ConcessionItem | null>(null);
  const cats = categoriesOf(items).filter((c) => !only || c === only);
  return (
    <View style={{ gap: 6 }}>
      {cats.map((cat) => (
        <View key={cat}>
          <View style={styles.catHead}>
            <Display size={22}>{titleCase(cat)}</Display>
          </View>
          {items
            .filter((i) => i.category.toUpperCase() === cat)
            .map((it) => {
              const hasOptions = (it.options ?? []).length > 0;
              const lines = Object.entries(basket).filter(([, l]) => l.itemId === it.itemId);
              const plainKey = lineKey(it.itemId, []);
              const q = hasOptions ? lines.reduce((a, [, l]) => a + l.quantity, 0) : (basket[plainKey]?.quantity ?? 0);
              const upgrades = (it.options ?? []).filter((o) => o.priceDelta > 0).length;
              return (
                <View key={it.itemId} style={styles.row}>
                  <View style={styles.rowTop}>
                    <Pressable
                      disabled={!hasOptions}
                      onPress={() => setCustom(it)}
                      accessibilityRole={hasOptions ? 'button' : undefined}
                      accessibilityLabel={hasOptions ? `Choose options for ${it.name}` : undefined}>
                      <ItemImage uri={it.imageUrl} name={it.name} size={64} category={it.category} />
                    </Pressable>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Body weight="semi" color={colors.bone} numberOfLines={1}>
                        {it.name}
                      </Body>
                      {it.description ? (
                        <Body size={12.5} color={colors.dust} numberOfLines={2}>
                          {it.description}
                        </Body>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                        <Mono size={13} color={q > 0 ? colors.lateriteSoft : colors.bone}>
                          {hasOptions && upgrades ? 'from ' : ''}
                          {money(it.price, it.currency)}
                        </Mono>
                        {upgrades ? (
                          <Label color={colors.vip} size={9.5}>
                            {upgrades} UPGRADE{upgrades === 1 ? '' : 'S'}
                          </Label>
                        ) : null}
                      </View>
                    </View>
                    {hasOptions ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Choose ${it.name}`}
                        onPress={() => {
                          tick();
                          setCustom(it);
                        }}
                        style={({ pressed }) => [styles.add, pressed && { opacity: 0.7 }]}>
                        <Mono size={13} color={colors.bone}>
                          {q > 0 ? '+ ANOTHER' : 'CHOOSE'}
                        </Mono>
                      </Pressable>
                    ) : (
                      <Stepper name={it.name} value={q} onChange={(v) => onChange(setLine(basket, it.itemId, [], v))} />
                    )}
                  </View>
                  {hasOptions && lines.length
                    ? lines.map(([key, l]) => (
                        <View key={key} style={styles.line}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Body size={13} color={colors.boneSoft} numberOfLines={2}>
                              {optionsText(it, l.options) || it.name}
                            </Body>
                            <Mono size={11.5} color={colors.dust}>
                              {money(unitPrice(it, l.options), it.currency)} each
                            </Mono>
                          </View>
                          <Stepper name={`${it.name}, ${optionsText(it, l.options)}`} value={l.quantity} onChange={(v) => onChange(setLine(basket, l.itemId, l.options, v))} />
                        </View>
                      ))
                    : null}
                </View>
              );
            })}
        </View>
      ))}

      <Modal visible={!!custom} transparent animationType="slide" onRequestClose={() => setCustom(null)} statusBarTranslucent>
        {custom ? (
          <Customise
            item={custom}
            onClose={() => setCustom(null)}
            onAdd={(options, quantity) => {
              const key = lineKey(custom.itemId, options);
              onChange(setLine(basket, custom.itemId, options, (basket[key]?.quantity ?? 0) + quantity));
              setCustom(null);
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

/** Choose size / flavour / drink (one each) and any extras, then add. */
function Customise({ item, onClose, onAdd }: { item: ConcessionItem; onClose: () => void; onAdd: (options: number[], quantity: number) => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const options = item.options ?? [];
  const [picked, setPicked] = useState<number[]>(() =>
    GROUPS.filter((g) => SINGLE.has(g.key))
      .map((g) => (options.find((o) => o.group === g.key && o.isDefault) ?? options.find((o) => o.group === g.key))?.optionId)
      .filter((x): x is number => x != null),
  );
  const [qty, setQty] = useState(1);
  const price = unitPrice(item, picked);

  const choose = (o: ConcessionOption) => {
    tick();
    setPicked((p) => {
      if (SINGLE.has(o.group)) {
        const sameGroup = new Set(options.filter((x) => x.group === o.group).map((x) => x.optionId));
        return [...p.filter((id) => !sameGroup.has(id)), o.optionId];
      }
      return p.includes(o.optionId) ? p.filter((id) => id !== o.optionId) : [...p, o.optionId];
    });
  };

  return (
    <View style={styles.scrim}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[styles.sheet, { maxHeight: height * 0.88, paddingBottom: Math.max(insets.bottom, 14) + 8 }]} accessibilityViewIsModal>
        <View style={styles.sheetHead}>
          <ItemImage uri={item.imageUrl} name={item.name} size={72} category={item.category} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Label>{item.category.toUpperCase()}</Label>
            <Display size={26} numberOfLines={2}>
              {item.name}
            </Display>
            {item.description ? (
              <Body size={13} color={colors.dust}>
                {item.description}
              </Body>
            ) : null}
          </View>
        </View>

        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 18, paddingBottom: 6 }}>
          {GROUPS.map((g) => {
            const list = options.filter((o) => o.group === g.key);
            if (!list.length) return null;
            const single = SINGLE.has(g.key);
            return (
              <View key={g.key} style={{ gap: 8 }} accessibilityRole={single ? 'radiogroup' : undefined}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Label color={colors.bone}>{g.label.toUpperCase()}</Label>
                  <Label>{single ? 'PICK ONE' : 'OPTIONAL'}</Label>
                </View>
                {list.map((o) => {
                  const on = picked.includes(o.optionId);
                  return (
                    <Pressable
                      key={o.optionId}
                      accessibilityRole={single ? 'radio' : 'checkbox'}
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${o.name}${o.priceDelta > 0 ? `, plus ${money(o.priceDelta, item.currency)}` : ''}`}
                      onPress={() => choose(o)}
                      style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && { opacity: 0.85 }]}>
                      <View style={[single ? styles.radio : styles.check, on && { borderColor: colors.laterite, backgroundColor: single ? 'transparent' : colors.laterite }]}>
                        {on ? single ? <View style={styles.radioDot} /> : <Mono size={12} color={colors.ink}>✓</Mono> : null}
                      </View>
                      <Body weight={on ? 'semi' : undefined} color={on ? colors.bone : colors.boneSoft} style={{ flex: 1 }}>
                        {o.name}
                      </Body>
                      <Mono size={12.5} color={o.priceDelta > 0 ? colors.vip : colors.dust}>
                        {o.priceDelta > 0 ? `+ ${money(o.priceDelta, item.currency)}` : single ? 'INCLUDED' : 'FREE'}
                      </Mono>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingTop: 12 }}>
          <Stepper name={item.name} value={qty} onChange={(v) => setQty(Math.max(1, v))} />
          <Button style={{ flex: 1 }} label={`Add · ${money(price * qty, item.currency)}`} onPress={() => onAdd(picked, qty)} />
        </View>
      </View>
    </View>
  );
}

export const PAYMENT_METHODS: { key: PaymentMethod; label: string; note: string }[] = [
  { key: 'MOBILE_MONEY', label: 'Mobile Money', note: 'MTN MoMo, Telecel Cash, AirtelTigo Money' },
  { key: 'CARD', label: 'Card', note: 'Visa or Mastercard' },
];

export function PaymentPicker({ value, onChange }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void }) {
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup">
      <Label>PAY WITH</Label>
      {PAYMENT_METHODS.map((m) => {
        const on = m.key === value;
        return (
          <Pressable
            key={m.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(m.key)}
            style={[styles.method, on && { borderColor: colors.bone }]}>
            <View style={[styles.radio, on && { borderColor: colors.laterite }]}>{on ? <View style={styles.radioDot} /> : null}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Body weight="semi" color={colors.bone}>
                {m.label}
              </Body>
              <Body size={12.5} color={colors.dust}>
                {m.note}
              </Body>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  img: { borderRadius: radius.poster, backgroundColor: colors.booth },
  catHead: { paddingTop: 18, paddingBottom: 8, borderBottomWidth: 1.5, borderBottomColor: colors.bone },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    gap: 10,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 78, paddingTop: 2 },
  scrim: { flex: 1, backgroundColor: 'rgba(6,5,4,0.78)' },
  sheet: { backgroundColor: colors.booth, paddingHorizontal: 20, paddingTop: 18, gap: 14, borderTopWidth: 1.5, borderTopColor: colors.bone },
  sheetHead: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: radius.action,
  },
  choiceOn: { borderColor: colors.bone, backgroundColor: colors.night },
  check: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.dust, alignItems: 'center', justifyContent: 'center' },
  add: {
    height: touch,
    minWidth: 64,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: colors.bone,
    borderRadius: radius.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.laterite,
    borderRadius: radius.action,
    height: touch,
  },
  stepBtn: { width: 40, height: touch, alignItems: 'center', justifyContent: 'center' },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: radius.action,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.dust, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.laterite },
});


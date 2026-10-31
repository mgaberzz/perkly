import { useState } from 'react';
import { View } from 'react-native';
import { Checkbox } from './form';
import { Sheet } from './sheet';
import { Button, Chip, T } from './ui';
import type { Filters, SortKey } from '@/lib/perks';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'nearest', label: '📍 Nearest' }, { key: 'discount', label: '🤑 Biggest discount' },
  { key: 'popular', label: '🔥 Most redeemed' }, { key: 'ending', label: '⏳ Ending soon' },
];

export function FilterSortSheet({ visible, onClose, sort, filters, onApply }: {
  visible: boolean; onClose: () => void; sort: SortKey; filters: Filters; onApply: (s: SortKey, f: Filters) => void;
}) {
  const [s, setS] = useState(sort);
  const [f, setF] = useState(filters);
  return (
    <Sheet visible={visible} onClose={onClose} title="Filter & sort" height="75%">
      <T v="label">Sort by</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SORTS.map((x) => <Chip key={x.key} label={x.label} active={s === x.key} onPress={() => setS(x.key)} />)}
      </View>
      <T v="label" style={{ marginTop: 8 }}>Show only</T>
      <Checkbox checked={f.flashOnly} onChange={(v) => setF({ ...f, flashOnly: v })} label="⚡ Flash perks" />
      <Checkbox checked={f.noMinSpend} onChange={(v) => setF({ ...f, noMinSpend: v })} label="🪙 No minimum spend" />
      <Checkbox checked={f.big} onChange={(v) => setF({ ...f, big: v })} label="🦸 20% off or more" />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Button variant="secondary" title="Reset" style={{ flex: 1 }} onPress={() => { setS('nearest'); setF({ flashOnly: false, noMinSpend: false, big: false }); }} />
        <Button title="Show results" style={{ flex: 2 }} onPress={() => { onApply(s, f); onClose(); }} />
      </View>
    </Sheet>
  );
}

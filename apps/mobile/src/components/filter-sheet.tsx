import { useState } from 'react';
import { View } from 'react-native';
import { Checkbox } from './form';
import { Sheet } from './sheet';
import { Button, Chip, T } from './ui';
import type { Filters, SortKey } from '@/lib/perks';
import { t } from '@/lib/i18n';

const SORTS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'nearest', label: 'Nearest', icon: '📍' }, { key: 'discount', label: 'Biggest Discount', icon: '🤑' },
  { key: 'popular', label: 'Most Redeemed', icon: '🔥' }, { key: 'ending', label: 'Ending Soon', icon: '⏳' },
];

export function FilterSortSheet({ visible, onClose, sort, filters, onApply }: {
  visible: boolean; onClose: () => void; sort: SortKey; filters: Filters; onApply: (s: SortKey, f: Filters) => void;
}) {
  const [s, setS] = useState(sort);
  const [f, setF] = useState(filters);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Filter & Sort')} height="75%">
      <T v="label">{t('Sort By')}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SORTS.map((x) => <Chip key={x.key} label={`${x.icon} ${t(x.label)}`} active={s === x.key} onPress={() => setS(x.key)} />)}
      </View>
      <T v="label" style={{ marginTop: 8 }}>{t('Show Only')}</T>
      <Checkbox checked={f.flashOnly} onChange={(v) => setF({ ...f, flashOnly: v })} label={`⚡ ${t('Flash Perks')}`} />
      <Checkbox checked={f.noMinSpend} onChange={(v) => setF({ ...f, noMinSpend: v })} label={`🪙 ${t('No Minimum Spend')}`} />
      <Checkbox checked={f.big} onChange={(v) => setF({ ...f, big: v })} label={`🦸 ${t('20% off or more')}`} />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <Button variant="secondary" title={t('Reset')} style={{ flex: 1 }} onPress={() => { setS('nearest'); setF({ flashOnly: false, noMinSpend: false, big: false }); }} />
        <Button title={t('Show Results')} style={{ flex: 2 }} onPress={() => { onApply(s, f); onClose(); }} />
      </View>
    </Sheet>
  );
}

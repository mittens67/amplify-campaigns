import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, Info, Minus, Plus, Users, X } from 'lucide-react-native';
import { CHANNELS, effectiveAdHeadline, type ChannelKey } from '@amplify/domain';
import { AdPreview } from '@/features/campaign/AdPreview';
import { haptic } from '@/lib/haptics';
import { Button, Chip, colors, IconButton, Notice, radius, Row, space, Text, TextField } from '@/ui';
import { Group, StepIntro, SuggestedChip, useField, useWizard } from '../WizardKit';

const PLACES = ['Arizona', 'California', 'Texas', 'New York', 'Ohio', 'Georgia', 'Illinois', 'Washington, DC', 'Chicago, IL', 'Denver, CO', 'Phoenix, AZ', 'Columbus, OH'];
const INTERESTS = ['Local news', 'Parenting', 'Health & wellness', 'Outdoors', 'Education', 'Volunteering', 'Local politics', 'Small business', 'Food', 'Science'];
const DURATIONS = [7, 14, 21, 30, 45, 60];

function Stepper({ value, onChange, min, max, step = 1, label }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label: string }) {
  return (
    <View style={styles.stepper} accessibilityLabel={`${label}: ${value}`}>
      <IconButton icon={<Minus size={16} color={colors.ink} />} label={`Decrease ${label}`} size={32} variant="filled" disabled={value <= min} onPress={() => { haptic('select'); onChange(Math.max(min, value - step)); }} />
      <Text variant="bodyStrong" style={{ minWidth: 44, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <IconButton icon={<Plus size={16} color={colors.ink} />} label={`Increase ${label}`} size={32} variant="filled" disabled={value >= max} onPress={() => { haptic('select'); onChange(Math.min(max, value + step)); }} />
    </View>
  );
}

function evenSplit(channels: ChannelKey[]): Record<string, number> {
  if (!channels.length) return {};
  const base = Math.floor(100 / channels.length / 5) * 5;
  const out: Record<string, number> = {};
  channels.forEach((k) => (out[k] = base));
  out[channels[0]] += 100 - base * channels.length;
  return out;
}

export function ReachStep() {
  const { content, update } = useWizard();
  const r = content.reach;
  const locErr = useField('reach.locations');
  const chErr = useField('reach.channels');
  const durErr = useField('reach.durationDays');
  const [place, setPlace] = useState('');
  const total = r.channels.reduce((s, k) => s + (r.split[k] ?? 0), 0);

  const toggleChannel = (k: ChannelKey) =>
    update((c) => {
      const on = c.reach.channels.includes(k);
      c.reach.channels = on ? c.reach.channels.filter((x) => x !== k) : [...c.reach.channels, k];
      c.reach.split = evenSplit(c.reach.channels);
    });
  const addPlace = (p: string) => {
    const v = p.trim();
    if (!v) return;
    update((c) => void (c.reach.locations = [...new Set([...c.reach.locations, v])]));
    setPlace('');
  };

  const persona = [
    r.ageMin || r.ageMax ? `Adults ${r.ageMin}–${r.ageMax}${r.ageMax >= 65 ? '+' : ''}` : 'Adults',
    r.locations.length ? `in ${r.locations.slice(0, 2).join(' & ')}${r.locations.length > 2 ? ` +${r.locations.length - 2}` : ''}` : 'in your chosen places',
    r.interests.length ? `interested in ${r.interests.slice(0, 2).join(' or ').toLowerCase()}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View style={{ gap: space.lg }}>
      <StepIntro title="Who should it reach?" body="Tell us who needs to see this. Our team turns it into ad targeting during review." />

      <Group title="You choose">
        <View style={{ gap: space.sm }}>
          <Text variant="label" weight="semi" color={colors.text}>Locations</Text>
          {r.locations.length ? (
            <View style={styles.wrap}>
              {r.locations.map((l) => (
                <Chip key={l} label={l} selected icon={<X size={12} color={colors.white} />} onPress={() => update((c) => void (c.reach.locations = c.reach.locations.filter((x) => x !== l)))} />
              ))}
            </View>
          ) : null}
          <TextField value={place} onChangeText={setPlace} placeholder="Add a state, city or county" onSubmitEditing={() => addPlace(place)} returnKeyType="done" error={locErr.error} right={place ? <Button label="Add" size="sm" variant="ghost" onPress={() => addPlace(place)} /> : undefined} />
          <View style={styles.wrap}>
            {PLACES.filter((p) => !r.locations.includes(p)).slice(0, 8).map((p) => (
              <Chip key={p} size="sm" label={`+ ${p}`} onPress={() => addPlace(p)} />
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="label" weight="semi" color={colors.text}>Age range</Text>
          <Row style={{ justifyContent: 'space-between' }}>
            <Stepper label="Minimum age" value={r.ageMin} min={13} max={r.ageMax - 1} onChange={(v) => update((c) => void (c.reach.ageMin = v))} />
            <Text variant="label">to</Text>
            <Stepper label="Maximum age" value={r.ageMax} min={r.ageMin + 1} max={65} onChange={(v) => update((c) => void (c.reach.ageMax = v))} />
          </Row>
        </View>

        <View style={{ gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="label" weight="semi" color={colors.text}>Interests <Text variant="label" color={colors.textSubtle}>(optional)</Text></Text>
            <SuggestedChip path="reach.interests" />
          </Row>
          <View style={styles.wrap}>
            {[...new Set([...r.interests, ...INTERESTS])].map((i) => (
              <Chip key={i} size="sm" label={i} selected={r.interests.includes(i)} onPress={() => update((c) => void (c.reach.interests = c.reach.interests.includes(i) ? c.reach.interests.filter((x) => x !== i) : [...c.reach.interests, i]), ['reach.interests'])} />
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="label" weight="semi" color={colors.text}>Channels & proposed budget split</Text>
          {CHANNELS.map((ch) => {
            const on = r.channels.includes(ch.key);
            return (
              <View key={ch.key} style={[styles.channel, on && styles.channelOn]}>
                <Pressable onPress={() => toggleChannel(ch.key)} style={styles.channelHead} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                  <View style={[styles.check, on && styles.checkOn]}>{on ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{ch.label}</Text>
                    <Text variant="caption">{ch.placements.join(' · ')}</Text>
                  </View>
                  {on ? (
                    <Stepper label={`${ch.label} share`} value={r.split[ch.key] ?? 0} min={0} max={100} step={5} onChange={(v) => update((c) => void (c.reach.split[ch.key] = v))} />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
          {chErr.error ? <Text variant="caption" color={colors.danger}>{chErr.error}</Text> : null}
          {r.channels.length ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="caption" color={total === 100 ? colors.success : colors.danger} weight="semi">Total {total}%{total === 100 ? ' ✓' : ' — must equal 100%'}</Text>
              <Button label="Split evenly" variant="ghost" size="sm" onPress={() => update((c) => void (c.reach.split = evenSplit(c.reach.channels)))} />
            </Row>
          ) : null}
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="label" weight="semi" color={colors.text}>Ad run length</Text>
          <View style={styles.wrap}>
            {DURATIONS.map((d) => (
              <Chip key={d} label={`${d} days`} selected={r.durationDays === d} onPress={() => update((c) => void (c.reach.durationDays = d))} />
            ))}
          </View>
          {durErr.error ? <Text variant="caption" color={colors.danger}>{durErr.error}</Text> : null}
        </View>
      </Group>

      <Group title="Finalized by our team during review" hint="These depend on live ad prices and policies, so we set them when preparing distribution." locked>
        {[
          ['Exact placements & formats', 'Within the channels you chose'],
          ['Bids and daily pacing', 'Optimised to reach new people, not the same few'],
          ['Final budget per channel', 'Starts from your proposed split'],
          ['Frequency caps', 'So nobody sees the ad too often'],
        ].map(([a, b]) => (
          <View key={a} style={{ gap: 2 }}>
            <Text variant="label" weight="semi" color={colors.textMuted}>{a}</Text>
            <Text variant="caption">{b}</Text>
          </View>
        ))}
      </Group>

      <View style={styles.persona}>
        <Row gap={space.sm}>
          <Users size={18} color={colors.accent} />
          <Text variant="overline" color={colors.accentText}>Audience preview</Text>
        </Row>
        <Text variant="cardTitle">{persona}</Text>
        <Text variant="label" color={colors.text}>
          via {r.channels.length ? CHANNELS.filter((c) => r.channels.includes(c.key)).map((c) => c.label).join(', ') : 'the channels you choose'} for {r.durationDays} days.
        </Text>
        <Text variant="label" weight="semi" color={colors.ink} style={{ marginTop: space.sm }}>How it may appear</Text>
        <AdPreview headline={effectiveAdHeadline(content)} description={content.visuals.adDescription} cta={content.visuals.cta} imageUrl={content.visuals.adImages[0]?.url ?? content.basics.cover?.url} creatorName={content.basics.creatorName} width={280} />
      </View>

      <Notice tone="neutral" icon={<Info size={18} color={colors.textMuted} />}>
        Reach isn’t guaranteed. The number of people reached depends on ad inventory, prices, targeting, delivery and how people respond. You’ll see an estimate when you set your funding goal.
      </Notice>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  channel: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  channelOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  channelHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 60 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  persona: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.accentBorder },
});

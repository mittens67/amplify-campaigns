import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Flag, Share2 } from 'lucide-react-native';
import { api, errorMessage } from '@/lib/api';
import { Button, colors, ListRow, radius, Sheet, space, Text, TextField, toast } from '@/ui';
import { shareCampaign } from '@/lib/share';

const REASONS = [
  { key: 'misleading', label: 'Misleading or false information' },
  { key: 'hateful', label: 'Hateful or harassing' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'copyright', label: 'Uses my work without permission' },
  { key: 'other', label: 'Something else' },
] as const;

export function ReportSheet({ visible, onClose, campaignId, title }: { visible: boolean; onClose: () => void; campaignId: string; title: string }) {
  const [mode, setMode] = useState<'menu' | 'report'>('menu');
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => {
    onClose();
    setTimeout(() => {
      setMode('menu');
      setReason(null);
      setDetails('');
    }, 300);
  };
  const submit = async () => {
    setBusy(true);
    try {
      await api(`/campaigns/${campaignId}/report`, { method: 'POST', body: { reason, details } });
      toast.success('Thanks — our review team will take a look.');
      close();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={mode === 'menu' ? 'Campaign options' : 'Report this campaign'}
      footer={mode === 'report' ? <Button label="Send report" onPress={submit} loading={busy} disabled={!reason} full /> : undefined}
    >
      {mode === 'menu' ? (
        <View style={{ marginHorizontal: -space.xl }}>
          <ListRow icon={<Share2 size={20} color={colors.ink} />} title="Share campaign" onPress={() => { close(); shareCampaign({ id: campaignId, title }); }} />
          <ListRow icon={<Flag size={20} color={colors.danger} />} title="Report a concern" subtitle="Sent privately to the review team" onPress={() => setMode('report')} danger />
        </View>
      ) : (
        <>
          <Text variant="label">Reports are private. The creator won’t see who sent them.</Text>
          {REASONS.map((r) => (
            <Pressable key={r.key} onPress={() => setReason(r.key)} style={[styles.option, reason === r.key && styles.optionOn]} accessibilityRole="radio" accessibilityState={{ checked: reason === r.key }}>
              <Text variant="body" color={colors.ink}>{r.label}</Text>
              <View style={[styles.radio, reason === r.key && styles.radioOn]} />
            </Pressable>
          ))}
          <TextField label="Details" optional value={details} onChangeText={setDetails} multiline maxChars={1000} placeholder="What should reviewers look at?" />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, minHeight: 50 },
  optionOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong },
  radioOn: { borderColor: colors.accent, borderWidth: 6 },
});

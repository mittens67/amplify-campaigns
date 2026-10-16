import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Receipt } from 'lucide-react-native';
import { formatMoney } from '@amplify/domain';
import { PAYMENT_STATUS } from '@/features/campaign/paymentStatus';
import { longDate } from '@/lib/format';
import { useMyContributions } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { colors, EmptyState, ErrorState, Notice, Pill, radius, ScreenHeader, Skeleton, space, Text } from '@/ui';


export default function Payments() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const q = useMyContributions();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Payment history" />
      {q.isPending ? (
        <View style={{ padding: space.lg, gap: space.sm }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={64} radius={14} />)}
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: space.xxxl }}
          ListHeaderComponent={!user && q.data?.length ? <View style={{ marginBottom: space.sm }}><Notice tone="info">These receipts are stored for this device. Sign in to keep them with your account.</Notice></View> : undefined}
          renderItem={({ item: c }) => {
            const s = PAYMENT_STATUS[c.status];
            return (
              <Pressable onPress={() => router.push({ pathname: '/me/receipt/[id]', params: { id: c.id } })} style={styles.row} accessibilityRole="button" accessibilityLabel={`${c.campaignTitle}, ${formatMoney(c.totalCents, { cents: true })}, ${s.label}`}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text variant="label" weight="semi" color={colors.ink} numberOfLines={1}>{c.campaignTitle}</Text>
                  <Text variant="caption">{longDate(c.createdAt)} · {c.receiptNo}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text variant="label" weight="semi" color={colors.ink}>{formatMoney(c.totalCents, { cents: true })}</Text>
                  <Pill label={s.label} tone={s.tone} />
                </View>
                <ChevronRight size={16} color={colors.placeholder} />
              </Pressable>
            );
          }}
          ListEmptyComponent={<EmptyState icon={Receipt} title="No payments yet" body="Receipts for your contributions will appear here." />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});


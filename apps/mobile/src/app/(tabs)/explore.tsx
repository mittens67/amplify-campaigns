import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ArrowDownUp, Search, SearchX, SlidersHorizontal, X } from 'lucide-react-native';
import { CATEGORIES, CREATOR_TYPES } from '@amplify/domain';
import { CampaignCard } from '@/features/campaign/CampaignCard';
import { useFeed, type FeedParams } from '@/lib/queries';
import { Button, CardSkeleton, Chip, colors, EmptyState, ErrorState, fonts, radius, Row, Sheet, space, TabTitle, Text } from '@/ui';

const SORTS = [
  { key: 'trending', label: 'Trending' },
  { key: 'newest', label: 'Newest' },
  { key: 'almost', label: 'Almost funded' },
  { key: 'ending', label: 'Ending soon' },
  { key: 'reach', label: 'Biggest reach' },
] as const;

const STATUS_FILTERS = [
  { key: '', label: 'All public' },
  { key: 'funding', label: 'Open for backing' },
  { key: 'funded', label: 'Funded · preparing' },
  { key: 'promoting', label: 'Ads running' },
  { key: 'completed', label: 'Completed' },
];

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('');
  const [sort, setSort] = useState<string>('trending');
  const [status, setStatus] = useState('');
  const [creatorType, setCreatorType] = useState('');
  const [sheet, setSheet] = useState<'sort' | 'filters' | null>(null);
  const q = useDebounced(query.trim());

  const params: FeedParams = useMemo(() => ({ q, category, sort, status, creatorType, limit: 12 }), [q, category, sort, status, creatorType]);
  const feed = useFeed(params);
  const featured = useFeed({ featured: true, limit: 6 });
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const filterCount = (status ? 1 : 0) + (creatorType ? 1 : 0);
  const hasCriteria = !!(q || category || filterCount);
  const clearAll = () => {
    setQuery('');
    setCategory('');
    setStatus('');
    setCreatorType('');
  };

  const header = (
    <View>
      <TabTitle title="Explore" subtitle="Reviewed campaigns, open to everyone" />
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Search size={18} color={colors.textSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search campaigns, topics, creators"
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search campaigns"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
              <X size={18} color={colors.textSubtle} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        <Chip label="All" selected={!category} onPress={() => setCategory('')} />
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? '' : c)} />
        ))}
      </ScrollView>
      <Row style={styles.toolbar}>
        <Text variant="label" style={{ flex: 1 }}>
          {feed.isPending ? 'Searching…' : `${items.length}${feed.hasNextPage ? '+' : ''} campaign${items.length === 1 ? '' : 's'}`}
        </Text>
        <Chip size="sm" label={SORTS.find((s) => s.key === sort)?.label ?? 'Sort'} icon={<ArrowDownUp size={14} color={colors.text} />} onPress={() => setSheet('sort')} />
        <Chip
          size="sm"
          label="Filters"
          count={filterCount || undefined}
          selected={filterCount > 0}
          icon={<SlidersHorizontal size={14} color={filterCount ? colors.white : colors.text} />}
          onPress={() => setSheet('filters')}
        />
      </Row>
      {!hasCriteria && featured.data?.pages[0]?.items.length ? (
        <View style={{ marginBottom: space.lg }}>
          <Text variant="heading" style={{ paddingHorizontal: space.lg, marginBottom: space.md }}>Featured</Text>
          <FlatList
            horizontal
            data={featured.data.pages[0].items}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.sm }}
            renderItem={({ item }) => <CampaignCard c={item} variant="compact" />}
          />
          <Text variant="heading" style={{ paddingHorizontal: space.lg, marginTop: space.lg }}>All campaigns</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={feed.isPending || feed.isError ? [] : items}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: space.lg }}>
            <CampaignCard c={item} />
          </View>
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => void feed.refetch()} tintColor={colors.accent} colors={[colors.accent]} />}
        ListEmptyComponent={
          feed.isPending ? (
            <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : feed.isError ? (
            <ErrorState error={feed.error} onRetry={feed.refetch} />
          ) : (
            <EmptyState
              icon={SearchX}
              title={q ? `No campaigns match “${q}”` : 'No campaigns here yet'}
              body={hasCriteria ? 'Try a different word, another category, or clear your filters.' : 'New campaigns appear here once they pass review.'}
              action={hasCriteria ? 'Clear search & filters' : undefined}
              onAction={clearAll}
            />
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />
          ) : items.length > 0 && !feed.hasNextPage ? (
            <Text variant="caption" align="center" style={{ marginTop: space.xl }}>You’ve seen every campaign that matches.</Text>
          ) : undefined
        }
      />

      <Sheet visible={sheet === 'sort'} onClose={() => setSheet(null)} title="Sort by">
        {SORTS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => {
              setSort(s.key);
              setSheet(null);
            }}
            style={[styles.option, sort === s.key && styles.optionOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: sort === s.key }}
          >
            <Text variant="body" weight={sort === s.key ? 'semi' : 'regular'} color={colors.ink}>{s.label}</Text>
            <View style={[styles.radio, sort === s.key && styles.radioOn]} />
          </Pressable>
        ))}
      </Sheet>

      <Sheet
        visible={sheet === 'filters'}
        onClose={() => setSheet(null)}
        title="Filters"
        footer={
          <Row gap={space.sm}>
            <Button label="Reset" variant="secondary" onPress={() => { setStatus(''); setCreatorType(''); }} style={{ flex: 1 }} />
            <Button label="Show results" onPress={() => setSheet(null)} style={{ flex: 2 }} />
          </Row>
        }
      >
        <Text variant="label" weight="semi" color={colors.text}>Campaign stage</Text>
        <View style={styles.wrap}>
          {STATUS_FILTERS.map((s) => (
            <Chip key={s.key} label={s.label} selected={status === s.key} onPress={() => setStatus(s.key)} />
          ))}
        </View>
        <Text variant="label" weight="semi" color={colors.text} style={{ marginTop: space.sm }}>Who’s behind it</Text>
        <View style={styles.wrap}>
          <Chip label="Anyone" selected={!creatorType} onPress={() => setCreatorType('')} />
          {CREATOR_TYPES.map((c) => (
            <Chip key={c.key} label={c.label} selected={creatorType === c.key} onPress={() => setCreatorType(c.key)} />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: space.lg },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.md, height: 48 },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 16, color: colors.ink },
  chips: { paddingHorizontal: space.lg, gap: space.sm, paddingVertical: space.md },
  toolbar: { paddingHorizontal: space.lg, marginBottom: space.md },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.md, minHeight: 50 },
  optionOn: { backgroundColor: colors.accentSoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong },
  radioOn: { borderColor: colors.accent, borderWidth: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});

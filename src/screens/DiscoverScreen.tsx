import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedCard } from '../components/FeedCard';
import { useSpotlog } from '../context/SpotlogContext';
import { clips, findPlace, regions } from '../data/mockCatalog';
import { colors } from '../theme';

export function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [feedHeight, setFeedHeight] = useState(0);
  const { activeRegionId, setActiveRegionId, isSaved, toggleSavedPlace } = useSpotlog();
  const regionClips = useMemo(() => clips.filter((clip) => findPlace(clip.placeId)?.regionId === activeRegionId), [activeRegionId]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View><Text style={styles.wordmark}>Spotlog</Text><Text style={styles.subtitle}>장면에서 시작하는 나만의 여행</Text></View>
        <Pressable style={styles.searchButton} accessibilityLabel="장소 검색"><Ionicons name="search" size={21} color={colors.ink} /></Pressable>
      </View>
      <View style={styles.regionRow}>
        {regions.map((region) => (
          <Pressable key={region.id} onPress={() => setActiveRegionId(region.id)} style={[styles.regionButton, activeRegionId === region.id && styles.regionButtonActive]}>
            <Text style={[styles.regionLabel, activeRegionId === region.id && styles.regionLabelActive]}>{region.name}</Text>
          </Pressable>
        ))}
      </View>
      {regionClips.length ? (
        <View style={styles.feed} onLayout={(event) => setFeedHeight(event.nativeEvent.layout.height)}>
          {feedHeight > 0 && <FlatList
            data={regionClips}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const place = findPlace(item.placeId)!;
              return <FeedCard clip={item} place={place} height={feedHeight} saved={isSaved(place.id)} onToggleSave={() => toggleSavedPlace(place.id)} />;
            }}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            getItemLayout={(_, index) => ({ length: feedHeight, offset: feedHeight * index, index })}
          />}
        </View>
      ) : (
        <View style={styles.empty}><Ionicons name="videocam-outline" size={42} color={colors.muted} /><Text style={styles.emptyTitle}>콘텐츠를 준비하고 있어요</Text><Text style={styles.emptyCopy}>첫 검증 지역은 다낭입니다.</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1220' },
  feed: { flex: 1 },
  header: { backgroundColor: '#fff', paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { color: colors.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.8 }, subtitle: { color: colors.muted, fontSize: 11, marginTop: 1 },
  searchButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  regionRow: { backgroundColor: '#fff', flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 12 },
  regionButton: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 99, backgroundColor: colors.canvas }, regionButtonActive: { backgroundColor: colors.ink },
  regionLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' }, regionLabelActive: { color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: 12 }, emptyCopy: { color: colors.muted, marginTop: 5 },
});

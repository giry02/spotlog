import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { SpotClip, SpotlogPlace } from '../types/domain';

interface FeedCardProps {
  clip: SpotClip;
  place: SpotlogPlace;
  height: number;
  saved: boolean;
  onToggleSave: () => void;
}

export function FeedCard({ clip, place, height, saved, onToggleSave }: FeedCardProps) {
  return (
    <View style={[styles.card, { height }]}>
      <Image source={place.image} contentFit="cover" style={StyleSheet.absoluteFill} transition={240} />
      <LinearGradient colors={['rgba(8,15,30,0.05)', 'rgba(8,15,30,0.15)', 'rgba(8,15,30,0.88)']} style={StyleSheet.absoluteFill} />
      <View style={styles.topRow}>
        <View style={styles.categoryChip}><Text style={styles.categoryText}>LANDMARK · {place.area}</Text></View>
        <View style={styles.duration}><Ionicons name="play" color="#fff" size={12} /><Text style={styles.durationText}>{clip.durationLabel}</Text></View>
      </View>
      <View style={styles.bottomContent}>
        <View style={styles.copy}>
          <Text style={styles.creator}>{clip.creator}</Text>
          <Text style={styles.hook}>{clip.hook}</Text>
          <Text style={styles.caption} numberOfLines={2}>{clip.caption}</Text>
          <View style={styles.tags}>{place.moodTags.map((tag) => <Text key={tag} style={styles.tag}>#{tag}</Text>)}</View>
          <View style={styles.placeMeta}>
            <Ionicons name="location" color="#fff" size={16} />
            <Text style={styles.placeName}>{place.name}</Text>
            <Text style={styles.placeTime}>{place.bestTime}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel={saved ? `${place.name} 담기 취소` : `${place.name} 담기`} onPress={onToggleSave} style={[styles.actionButton, saved && styles.actionButtonSaved]}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} color="#fff" size={25} />
          </Pressable>
          <Text style={styles.actionLabel}>{saved ? '담았어요' : '담기'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="공유" style={styles.actionButton}>
            <Ionicons name="paper-plane-outline" color="#fff" size={24} />
          </Pressable>
          <Text style={styles.actionLabel}>공유</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', overflow: 'hidden', backgroundColor: '#0B1220' },
  topRow: { position: 'absolute', top: 18, left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryChip: { borderRadius: radius.pill, backgroundColor: 'rgba(8,15,30,0.52)', paddingHorizontal: 12, paddingVertical: 8 },
  categoryText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  duration: { flexDirection: 'row', gap: 5, alignItems: 'center', borderRadius: radius.pill, backgroundColor: 'rgba(8,15,30,0.52)', paddingHorizontal: 10, paddingVertical: 7 },
  durationText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bottomContent: { position: 'absolute', left: 18, right: 14, bottom: 26, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  copy: { flex: 1 }, creator: { color: '#fff', fontWeight: '800', fontSize: 14, marginBottom: 8 },
  hook: { color: '#fff', fontWeight: '900', fontSize: 25, lineHeight: 32, letterSpacing: -0.5 },
  caption: { color: 'rgba(255,255,255,0.86)', fontSize: 14, lineHeight: 20, marginTop: 8 },
  tags: { flexDirection: 'row', gap: 8, marginTop: 11 }, tag: { color: '#C7D7FE', fontSize: 13, fontWeight: '700' },
  placeMeta: { marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 6 }, placeName: { color: '#fff', fontSize: 14, fontWeight: '800' }, placeTime: { color: 'rgba(255,255,255,0.68)', fontSize: 12 },
  actions: { alignItems: 'center', gap: 5 }, actionButton: { width: 49, height: 49, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,15,30,0.52)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginTop: 10 },
  actionButtonSaved: { backgroundColor: colors.primary }, actionLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

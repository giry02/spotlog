import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';

const rows = [
  ['heart-outline', '나의 여행 취향', '바다 · 골목 · 로컬 미식'],
  ['people-outline', '팔로우한 여행자', '0명'],
  ['notifications-outline', '알림 설정', '추천과 일정 알림'],
  ['shield-checkmark-outline', '개인정보와 공개 범위', '비공개 기본'],
] as const;

export function ProfileScreen() {
  return <SafeAreaView style={styles.safe} edges={['top']}><View style={styles.header}><Text style={styles.title}>프로필</Text><Text style={styles.copy}>Spotlog의 회원은 HotelNGo·PMS 회원과 분리된 독립 회원입니다.</Text></View><View style={styles.profile}><View style={styles.avatar}><Text style={styles.avatarText}>S</Text></View><View><Text style={styles.name}>Spotlog 여행자</Text><Text style={styles.email}>로그인 전 데모 프로필</Text></View></View><View style={styles.menu}>{rows.map(([icon, label, value]) => <Pressable key={label} style={styles.row}><View style={styles.rowIcon}><Ionicons name={icon} size={20} color={colors.primary} /></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>)}</View><View style={styles.note}><Ionicons name="information-circle-outline" size={18} color={colors.muted} /><Text style={styles.noteText}>인증·서버 API는 아직 연결하지 않았습니다. 현재 저장 데이터는 기기 내부 Mock 저장소에만 보관됩니다.</Text></View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, header: { padding: 20 }, title: { color: colors.ink, fontSize: 30, fontWeight: '900' }, copy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7 }, profile: { marginHorizontal: 20, padding: 18, backgroundColor: '#fff', borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: 14 }, avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontSize: 22, fontWeight: '900' }, name: { color: colors.ink, fontSize: 18, fontWeight: '900' }, email: { color: colors.muted, fontSize: 12, marginTop: 4 }, menu: { margin: 20, backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: 15 }, row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line }, rowIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, rowCopy: { flex: 1, paddingHorizontal: 12 }, rowLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' }, rowValue: { color: colors.muted, fontSize: 11, marginTop: 3 }, note: { marginHorizontal: 20, padding: 14, borderRadius: radius.md, backgroundColor: '#EEF2F6', flexDirection: 'row', gap: 8 }, noteText: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 17 } });

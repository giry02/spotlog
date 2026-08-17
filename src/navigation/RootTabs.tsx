import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { PlanScreen } from '../screens/PlanScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { TripsScreen } from '../screens/TripsScreen';
import { colors } from '../theme';

export type RootTabParamList = {
  Discover: undefined;
  Saved: undefined;
  Plan: undefined;
  Trips: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const icons: Record<keyof RootTabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Discover: ['compass-outline', 'compass'], Saved: ['bookmark-outline', 'bookmark'], Plan: ['sparkles-outline', 'sparkles'], Trips: ['map-outline', 'map'], Profile: ['person-outline', 'person'],
};

export function RootTabs() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: '#98A2B3',
      tabBarLabelStyle: { fontSize: 10, fontWeight: '800', marginTop: 2 },
      tabBarStyle: { height: 70, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.line, backgroundColor: '#fff' },
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={icons[route.name][focused ? 1 : 0]} color={color} size={size} />,
    })}>
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ tabBarLabel: '발견' }} />
      <Tab.Screen name="Saved" component={SavedScreen} options={{ tabBarLabel: '담은 장소' }} />
      <Tab.Screen name="Plan" component={PlanScreen} options={{ tabBarLabel: '여행 만들기' }} />
      <Tab.Screen name="Trips" component={TripsScreen} options={{ tabBarLabel: '내 여행' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: '프로필' }} />
    </Tab.Navigator>
  );
}

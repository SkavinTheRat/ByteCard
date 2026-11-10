import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { zh } from '@/i18n/zh';
import { colors, fonts, type } from '@/theme';

type TabIconProps = {
  color: ColorValue;
  focused: boolean;
};

function TodayIcon({ color, focused }: TabIconProps) {
  const tint = typeof color === 'string' ? color : colors.textMute;
  return <Ionicons color={tint} name={focused ? 'today' : 'today-outline'} size={22} />;
}

function StatsIcon({ color, focused }: TabIconProps) {
  const tint = typeof color === 'string' ? color : colors.textMute;
  return (
    <Ionicons
      color={tint}
      name={focused ? 'stats-chart' : 'stats-chart-outline'}
      size={22}
    />
  );
}

function MeIcon({ color, focused }: TabIconProps) {
  const tint = typeof color === 'string' ? color : colors.textMute;
  return <Ionicons color={tint} name={focused ? 'person' : 'person-outline'} size={22} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMute,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 0,
          minHeight: 56,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          ...type.micro,
          fontFamily: fonts.mono,
          textTransform: 'none',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: zh.tabs.today,
          tabBarIcon: (props) => <TodayIcon {...props} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: zh.tabs.stats,
          tabBarIcon: (props) => <StatsIcon {...props} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: zh.tabs.me,
          tabBarIcon: (props) => <MeIcon {...props} />,
        }}
      />
    </Tabs>
  );
}

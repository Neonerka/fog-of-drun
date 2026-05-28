import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import MapScreen from './screens/MapScreen';
import ProgressScreen from './screens/ProgressScreen';
import AchievementsScreen from './screens/AchievementsScreen';
import SessionsScreen from './screens/SessionsScreen';
import SettingsScreen from './screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Карта: '🗺️',
    Прогресс: '📊',
    Достижения: '🏆',
    Сессии: '📋',
    Настройки: '⚙️',
  };
  return (
    <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.5 }}>
      {icons[label] ?? '📌'}
    </Text>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0f172a',
            borderTopColor: '#1e293b',
            borderTopWidth: 1,
            paddingBottom: 8,
            paddingTop: 8,
            height: 60,
          },
          tabBarActiveTintColor: '#22C55E',
          tabBarInactiveTintColor: '#64748b',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
          tabBarIcon: ({ focused }) => (
            <TabIcon label={route.name} focused={focused} />
          ),
        })}
      >
        <Tab.Screen name="Карта" component={MapScreen} />
        <Tab.Screen name="Прогресс" component={ProgressScreen} />
        <Tab.Screen name="Достижения" component={AchievementsScreen} />
        <Tab.Screen name="Сессии" component={SessionsScreen} />
        <Tab.Screen name="Настройки" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

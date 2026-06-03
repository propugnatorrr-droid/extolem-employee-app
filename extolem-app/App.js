import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { colors } from './src/theme';

import InboxScreen from './src/screens/InboxScreen';
import ThreadScreen from './src/screens/ThreadScreen';
import AIAssistantScreen from './src/screens/AIAssistantScreen';
import NewConversationScreen from './src/screens/NewConversationScreen';
import KnowledgeScreen from './src/screens/KnowledgeScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const navTheme = {
  dark: true,
  colors: {
    primary: colors.accent,
    background: colors.bg,
    card: colors.bgCard,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.danger,
  },
};

function InboxStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Inbox" component={InboxScreen} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
      <Stack.Screen name="NewConversation" component={NewConversationScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Font.loadAsync(Ionicons.font).then(() => setReady(true)).catch(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" backgroundColor="#070B14" translucent />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.bgCard,
              borderTopColor: colors.border,
              borderTopWidth: 1,
              paddingTop: 8,
              height: 64,
            },
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            tabBarIcon: ({ focused, color }) => {
              const icons = {
                Messages: focused ? 'chatbubbles' : 'chatbubbles-outline',
                Assistant: focused ? 'sparkles' : 'sparkles-outline',
                Knowledge: focused ? 'library' : 'library-outline',
              };
              return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={23} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Messages" component={InboxStack} />
          <Tab.Screen name="Assistant" component={AIAssistantScreen} />
          <Tab.Screen name="Knowledge" component={KnowledgeScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

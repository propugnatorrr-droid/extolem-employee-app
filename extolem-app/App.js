import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from './src/theme';

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
    notification: colors.accent,
  },
};

function InboxStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgCard, borderBottomColor: colors.border, borderBottomWidth: 1 },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { ...fonts.semibold },
      }}
    >
      <Stack.Screen name="Inbox" component={InboxScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
      <Stack.Screen name="NewConversation" component={NewConversationScreen} options={{ title: 'New Message' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.bgCard,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingBottom: 8,
            paddingTop: 6,
            height: 64,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { ...fonts.medium, fontSize: 10, marginTop: 2 },
          tabBarIcon: ({ focused, color, size }) => {
            const icons = {
              Messages: focused ? 'chatbubbles' : 'chatbubbles-outline',
              Assistant: focused ? 'sparkles' : 'sparkles-outline',
              Knowledge: focused ? 'library' : 'library-outline',
            };
            return <Ionicons name={icons[route.name]} size={22} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Messages" component={InboxStack} />
        <Tab.Screen name="Assistant" component={AIAssistantScreen} />
        <Tab.Screen name="Knowledge" component={KnowledgeScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

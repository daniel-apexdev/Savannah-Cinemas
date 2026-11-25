import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Intro } from "@/components/intro";
import { AuthProvider, useAuth } from "@/lib/auth";
import { GUESTS_ALLOWED } from "@/lib/guest";
import { NotificationsProvider } from "@/lib/notify";
import { loadLocations } from "@/lib/location";
import { loadSettings } from "@/lib/settings";
import { loadWelcomed, useWelcomed } from "@/lib/welcome";
import { colors, fontAssets } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
loadSettings();
loadWelcomed();
loadLocations();

// Web: paint the page itself dark so overscroll never flashes white.
if (Platform.OS === "web" && typeof document !== "undefined") {
  document.documentElement.style.backgroundColor = colors.night;
  document.body.style.backgroundColor = colors.night;
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.night,
    card: colors.night,
    text: colors.bone,
    border: colors.rule,
    primary: colors.laterite,
  },
};

function Root() {
  const { ready, user } = useAuth();
  // The phone app needs an account for everything; the website can be
  // browsed (and booked) without one.
  const open = !!user || GUESTS_ALLOWED;
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const welcomed = useWelcomed();
  const go = ready && welcomed !== "unknown" && (fontsLoaded || !!fontError);
  const [intro, setIntro] = useState(true);
  const endIntro = useCallback(() => setIntro(false), []);

  useEffect(() => {
    if (go) SplashScreen.hideAsync().catch(() => {});
  }, [go]);

  if (!go) return <View style={{ flex: 1, backgroundColor: colors.night }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.night },
          animation: "slide_from_right",
        }}
      >
        {/* (tabs) sends signed-out phone users to the welcome slides / sign-in */}
        <Stack.Screen name="(tabs)" />
        <Stack.Protected guard={open}>
          <Stack.Screen
            name="film/[id]"
            options={{ animation: "fade_from_bottom" }}
          />
          <Stack.Screen name="seats/[showtimeId]" />
          <Stack.Screen name="snacks/[bookingId]" />
          <Stack.Screen name="checkout/[bookingId]" />
          <Stack.Screen name="ticket/[bookingId]" />
          <Stack.Screen name="order/[orderId]" />
          <Stack.Screen name="watchlist" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="profile-setup" />
          <Stack.Screen name="settings/profile" />
          <Stack.Screen name="settings/password" />
          <Stack.Screen name="settings/notifications" />
          <Stack.Screen name="settings/help" />
          <Stack.Screen name="settings/delete" />
        </Stack.Protected>
        <Stack.Screen
          name="sign-in"
          options={
            open
              ? { presentation: "modal", animation: "slide_from_bottom" }
              : // Phone, signed out: sign-in is the way in, not a sheet to swipe away
                { animation: "fade", gestureEnabled: false }
          }
        />
        <Stack.Screen name="welcome" options={{ animation: "fade" }} />
        <Stack.Screen name="reset-password" />
      </Stack>
      {intro ? <Intro onDone={endIntro} /> : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.night }}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <AuthProvider>
            <StatusBar style="light" />
            <NotificationsProvider>
              <Root />
            </NotificationsProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

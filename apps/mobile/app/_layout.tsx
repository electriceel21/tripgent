import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { dynamicClient } from "../lib/dynamicClient";

const DynamicWebView = dynamicClient.reactNative.WebView;

export default function RootLayout() {
  return (
    <>
      {/* Required: Dynamic auth UI runs in this WebView (not compatible with Expo Go). */}
      <DynamicWebView />
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0b1326", borderBottomColor: "#1e293b" },
          headerTintColor: "#e2e8f0",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#0b1326" },
        }}
      />
    </>
  );
}

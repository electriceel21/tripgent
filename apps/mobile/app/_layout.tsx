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
          headerStyle: { backgroundColor: "#0c0f14" },
          headerTintColor: "#e6edf3",
          contentStyle: { backgroundColor: "#0c0f14" },
        }}
      />
    </>
  );
}

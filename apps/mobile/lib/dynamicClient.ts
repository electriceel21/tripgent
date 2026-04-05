import { createClient } from "@dynamic-labs/client";
import { ReactNativeExtension } from "@dynamic-labs/react-native-extension";
import { ViemExtension } from "@dynamic-labs/viem-extension";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Passed to `ReactNativeExtension({ appOrigin })`. Must match Dynamic → Security → Allowed Origins
 * (exact scheme/host/port). A mismatch often surfaces as WebView
 * "Fetch service request failed in setupFetchService".
 *
 * @see https://www.dynamic.xyz/docs/react-native/reference/quickstart
 */
function resolveAppOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_DYNAMIC_APP_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const hostUri = Constants.expoConfig?.hostUri;
  const dbg =
    Constants.expoGoConfig?.debuggerHost ??
    (Constants.manifest as { debuggerHost?: string } | undefined)?.debuggerHost;
  const rawHost = hostUri ?? dbg;

  if (__DEV__ && rawHost) {
    if (rawHost.startsWith("http://") || rawHost.startsWith("https://")) {
      return rawHost.replace(/\/$/, "");
    }
    return `http://${rawHost}`.replace(/\/$/, "");
  }

  // Android emulator: host machine’s Metro is 10.0.2.2, not localhost.
  if (__DEV__ && Platform.OS === "android") {
    return "http://10.0.2.2:8081";
  }

  return "http://localhost:8081";
}

const environmentId = process.env.EXPO_PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? "";
const appOrigin = resolveAppOrigin();

export const dynamicClient = createClient({
  environmentId: environmentId || "missing-set-EXPO_PUBLIC_DYNAMIC_ENVIRONMENT_ID",
  appName: "Tripgent",
  appLogoUrl: "https://demo.dynamic.xyz/favicon-32x32.png",
  ...(__DEV__
    ? {
        debug: {
          messageTransport: true,
          webview: true,
        },
      }
    : {}),
})
  .extend(ReactNativeExtension({ appOrigin }))
  .extend(ViemExtension());

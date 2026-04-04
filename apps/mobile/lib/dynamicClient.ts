import { createClient } from "@dynamic-labs/client";
import { ReactNativeExtension } from "@dynamic-labs/react-native-extension";
import { ViemExtension } from "@dynamic-labs/viem-extension";

/**
 * Customer app auth + EVM (Viem). Not the React web SDK — client + extensions only.
 * @see https://www.dynamic.xyz/docs/react-native/reference/quickstart
 */
const environmentId = process.env.EXPO_PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? "";
const appOrigin =
  process.env.EXPO_PUBLIC_DYNAMIC_APP_ORIGIN ?? "http://localhost:8081";

export const dynamicClient = createClient({
  environmentId: environmentId || "missing-set-EXPO_PUBLIC_DYNAMIC_ENVIRONMENT_ID",
  appName: "Tripgent",
  appLogoUrl: "https://demo.dynamic.xyz/favicon-32x32.png",
})
  .extend(ReactNativeExtension({ appOrigin }))
  .extend(ViemExtension());

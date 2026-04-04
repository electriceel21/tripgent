import { useReactiveClient } from "@dynamic-labs/react-hooks";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { dynamicClient } from "../lib/dynamicClient";

const API_BASE =
  process.env.EXPO_PUBLIC_TRIPGENT_API_URL ?? "http://127.0.0.1:8787";
const API_BEARER_FALLBACK = process.env.EXPO_PUBLIC_API_AUTH_BEARER;

/**
 * Customer-facing travel agent (0G compute via API). Auth: Dynamic embedded wallet + JWT on `client.auth.token`.
 */
export default function ChatScreen() {
  const client = useReactiveClient(dynamicClient);
  const authToken = client.auth.token;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSignIn = useCallback(() => {
    void client.ui.auth.show();
  }, [client.ui.auth]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    setError(null);
    const nextUser = { role: "user" as const, content: trimmed };
    setMessages((m) => [...m, nextUser]);
    setLoading(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const bearer = authToken ?? API_BEARER_FALLBACK;
      if (bearer) headers.Authorization = `Bearer ${bearer}`;

      const res = await fetch(`${API_BASE}/v1/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [...messages, nextUser].map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });
      const data = (await res.json()) as {
        message?: { content: string };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const assistantContent = data.message?.content;
      if (typeof assistantContent !== "string") {
        throw new Error("No assistant message");
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: assistantContent },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [authToken, input, loading, messages]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Tripgent</Text>
        <Text style={styles.sub}>
          Your travel concierge · rewards with Circle Gateway / ARC (nanopayments on the roadmap)
        </Text>

        <View style={styles.authRow}>
          {authToken ? (
            <Text style={styles.authed}>Signed in</Text>
          ) : (
            <Pressable style={styles.signInBtn} onPress={openSignIn}>
              <Text style={styles.signInText}>Sign in</Text>
            </Pressable>
          )}
        </View>

        {messages.length === 0 && (
          <Text style={styles.hint}>
            Ask about neighborhoods, day trips, or food. Inference runs on 0G via the Tripgent API.
            Leave API_AUTH_BEARER unset on the API until you verify Dynamic JWTs in production.
          </Text>
        )}
        {messages.map((m, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            <Text style={styles.bubbleLabel}>{m.role}</Text>
            <Text style={styles.bubbleText}>{m.content}</Text>
          </View>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Where should I eat near…"
          placeholderTextColor="#6e7681"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          editable={!loading}
        />
        <Pressable
          style={[styles.send, loading && styles.sendDisabled]}
          onPress={send}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c0f14" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  title: { fontSize: 24, fontWeight: "700", color: "#e6edf3", marginBottom: 4 },
  sub: { color: "#8b949e", marginBottom: 12, fontSize: 14, lineHeight: 20 },
  authRow: { marginBottom: 16 },
  authed: { color: "#3fb950", fontSize: 14, fontWeight: "600" },
  signInBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#1f6feb",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  signInText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  hint: { color: "#6e7681", fontSize: 14, lineHeight: 20, marginBottom: 16 },
  bubble: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    maxWidth: "100%",
  },
  bubbleUser: { backgroundColor: "#21262d", alignSelf: "flex-end" },
  bubbleAssistant: { backgroundColor: "#161b22", alignSelf: "flex-start" },
  bubbleLabel: {
    fontSize: 11,
    color: "#8b949e",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  bubbleText: { color: "#e6edf3", fontSize: 16, lineHeight: 22 },
  error: { color: "#f85149", marginTop: 8 },
  inputRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#30363d",
    backgroundColor: "#0c0f14",
  },
  input: {
    flex: 1,
    backgroundColor: "#161b22",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#e6edf3",
    fontSize: 16,
  },
  send: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#238636",
    paddingHorizontal: 18,
    borderRadius: 10,
    minWidth: 72,
  },
  sendDisabled: { opacity: 0.6 },
  sendText: { color: "#fff", fontWeight: "600" },
});

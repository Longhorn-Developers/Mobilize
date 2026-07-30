/** OAuth deep-link callback screen. Processes the token from the redirect URL and navigates. Requires no auth. */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { APP_ROUTES } from "~/utils/routes";
import { useAuth } from "~/utils/useAuth";

const firstParam = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
};

export default function OAuthCallbackScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    callbackUrl?: string | string[];
    session_token?: string | string[];
    token?: string | string[];
    error?: string | string[];
  }>();
  const hasHandledRef = useRef(false);
  const { completeGoogleOAuthCallback } = useAuth();

  useEffect(() => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;

    const encodedCallbackUrl = firstParam(params.callbackUrl);
    let callbackUrl: string | null = null;
    if (encodedCallbackUrl) {
      try {
        callbackUrl = decodeURIComponent(encodedCallbackUrl);
      } catch {
        callbackUrl = encodedCallbackUrl;
      }
    }

    const callbackInput =
      callbackUrl ??
      {
        session_token: firstParam(params.session_token),
        token: firstParam(params.token),
        error: firstParam(params.error),
      };

    void (async () => {
      const result = await completeGoogleOAuthCallback(callbackInput);
      if (result.success) {
        if (result.onboardingComplete) {
          router.replace(APP_ROUTES.TABS as any);
        } else {
          router.replace(APP_ROUTES.AUTH_PROFILE_SETUP as any);
        }
        return;
      }

      router.replace({
        pathname: APP_ROUTES.AUTH_GOOGLE_OAUTH as any,
        params: { error: result.error ?? "Authentication failed" } as any,
      });
    })();
  }, [
    completeGoogleOAuthCallback,
    params.callbackUrl,
    params.session_token,
    params.token,
    params.error,
  ]);

  return (
    <View
      className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-900"
      style={{ paddingTop: insets.top }}
    >
      <ActivityIndicator size="large" color="#BF5700" />
      <Text className="mt-4 text-center text-lg text-gray-600 dark:text-gray-300">
        Finishing Google sign-in...
      </Text>
    </View>
  );
}

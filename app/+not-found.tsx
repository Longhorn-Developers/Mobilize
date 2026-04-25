import { Link, Stack } from "expo-router";
import { Text } from "react-native";

import { APP_ROUTES } from "~/utils/routes";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <Text className={styles.title}>{"This screen doesn't exist."}</Text>
      <Link href={APP_ROUTES.WELCOME as any} className={styles.link}>
        <Text className={styles.linkText}>Go to home screen!</Text>
      </Link>
    </>
  );
}

const styles = {
  title: `text-xl font-bold`,
  link: `mt-4 pt-4`,
  linkText: `text-base text-[#2e78b7]`,
};

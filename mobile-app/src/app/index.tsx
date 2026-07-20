import { Redirect } from "expo-router";

export default function RootIndex() {
  // Redirect to the tabbed home screen immediately — no login wall.
  return <Redirect href="/(tabs)" />;
}
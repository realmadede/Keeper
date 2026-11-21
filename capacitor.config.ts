import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.keeper.household",
  appName: "Keeper",
  webDir: "dist",
  backgroundColor: "#F6F5F2",
  android: {
    allowMixedContent: false,
    backgroundColor: "#F6F5F2",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "LIGHT",
      backgroundColor: "#F6F5F2",
    },
  },
};

export default config;

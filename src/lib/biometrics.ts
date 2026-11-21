import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";

const BIOMETRICS_ENABLED_KEY = "keeper_biometrics_v1";

export function isBiometricsEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRICS_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBiometricsEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(BIOMETRICS_ENABLED_KEY, "1");
    else localStorage.removeItem(BIOMETRICS_ENABLED_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function checkBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await NativeBiometric.isAvailable();
    return Boolean(res.isAvailable);
  } catch {
    return false;
  }
}

export async function verifyBiometricIdentity(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await NativeBiometric.verifyIdentity({
      reason: "Unlock Keeper",
      title: "Unlock Keeper",
      subtitle: "Use fingerprint or face to open your household",
      negativeButtonText: "Use PIN",
    });
    return true;
  } catch {
    return false;
  }
}

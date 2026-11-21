export function isBiometricsEnabled(): boolean {
  return false;
}

export function setBiometricsEnabled(_enabled: boolean): void {
  // Biometric unlock is available on the native Android app
}

export async function checkBiometricAvailable(): Promise<boolean> {
  return false;
}

export async function verifyBiometricIdentity(): Promise<boolean> {
  return false;
}

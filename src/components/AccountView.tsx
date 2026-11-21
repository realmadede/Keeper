import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  DoorOpen,
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import {
  checkBiometricAvailable,
  isBiometricsEnabled,
  setBiometricsEnabled,
  verifyBiometricIdentity,
} from "../lib/biometrics";
import { getInitials } from "../lib/format";
import {
  isNotificationsEnabled,
  requestNotificationPermission,
  scheduleBillReminders,
  setNotificationsEnabled,
} from "../lib/notifications";
import { clearHouseholdSnapshot } from "../lib/offlineQueue";
import type { Profile, RecurringBill } from "../types";
import { LegalModal, type LegalDocType } from "./LegalModal";
import { SoftButton, SoftInput } from "./LightControls";
import { MaskedSecretInput } from "./MaskedSecretInput";
import { getStoredPinHash, hashPin, setStoredPinHash } from "./PinLockScreen";
import { SupportAndAboutCard, type AppFeedbackInput } from "./SupportAndAboutCard";

const AVATAR_SWATCHES = [
  "#BFA377",
  "#3B82F6",
  "#10B981",
  "#F97316",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#334155",
];

interface AccountViewProps {
  profile: Profile;
  householdName?: string;
  memberRole?: "admin" | "member";
  bills: RecurringBill[];
  isDemoMode: boolean;
  pendingSyncCount?: number;
  onSyncNow?: () => Promise<void>;
  onUpdateProfile: (fullName: string, avatarColor: string) => Promise<void>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
  onLeaveHousehold: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSubmitFeedback: (input: AppFeedbackInput) => Promise<void>;
  onPinHashChange: (hash: string | null) => void;
}

export function AccountView({
  profile,
  householdName,
  memberRole = "member",
  bills,
  isDemoMode,
  pendingSyncCount = 0,
  onSyncNow,
  onUpdateProfile,
  onUpdatePassword,
  onLeaveHousehold,
  onDeleteAccount,
  onSignOut,
  onSubmitFeedback,
  onPinHashChange,
}: AccountViewProps) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(profile.full_name);
  const [avatarColor, setAvatarColor] = useState(profile.avatar_color);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const [signOutWarning, setSignOutWarning] = useState(false);
  const [syncingBeforeSignOut, setSyncingBeforeSignOut] = useState(false);

  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);
  const [cacheClearedMsg, setCacheClearedMsg] = useState<string | null>(null);
  const [confirmLeaveHouse, setConfirmLeaveHouse] = useState(false);
  const [leavingHouse, setLeavingHouse] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);

  // Optional App PIN Lock, Biometrics & Notifications state
  const [hasPin, setHasPin] = useState(() => Boolean(getStoredPinHash()));
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSavedMsg, setPinSavedMsg] = useState<string | null>(null);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricsOn, setBiometricsOn] = useState(() => isBiometricsEnabled());
  const [bioMsg, setBioMsg] = useState<string | null>(null);

  const [notifsOn, setNotifsOn] = useState(() => isNotificationsEnabled());
  const [notifStatus, setNotifStatus] = useState<string | null>(null);
  const isNativeApp =
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
        ?.isNativePlatform?.(),
    );

  useEffect(() => {
    let active = true;
    void checkBiometricAvailable().then((avail) => {
      if (active) setBiometricAvailable(avail);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleToggleBiometrics = async () => {
    setBioMsg(null);
    if (biometricsOn) {
      setBiometricsEnabled(false);
      setBiometricsOn(false);
      setBioMsg("Fingerprint / face unlock turned off");
      setTimeout(() => setBioMsg(null), 2200);
      return;
    }
    const verified = await verifyBiometricIdentity();
    if (!verified) {
      setBioMsg("Biometric verification cancelled");
      return;
    }
    setBiometricsEnabled(true);
    setBiometricsOn(true);
    setBioMsg("Fingerprint / face unlock enabled");
    setTimeout(() => setBioMsg(null), 2400);
  };

  const handleSavePin = async (e: FormEvent) => {
    e.preventDefault();
    setPinError(null);
    if (!/^\d{4}$/.test(pinInput)) {
      setPinError("Enter a 4-digit numeric PIN.");
      return;
    }
    if (pinInput !== pinConfirm) {
      setPinError("PINs do not match.");
      return;
    }
    const hashed = await hashPin(pinInput);
    setStoredPinHash(hashed);
    onPinHashChange(hashed);
    setHasPin(true);
    setShowPinForm(false);
    setPinInput("");
    setPinConfirm("");
    setPinSavedMsg("4-digit PIN enabled");
    setTimeout(() => setPinSavedMsg(null), 2400);
  };

  const handleRemovePin = () => {
    setStoredPinHash(null);
    onPinHashChange(null);
    setHasPin(false);
    setBiometricsEnabled(false);
    setBiometricsOn(false);
    setShowPinForm(false);
    setPinSavedMsg("PIN lock turned off");
    setTimeout(() => setPinSavedMsg(null), 2400);
  };

  const handleToggleNotifications = async () => {
    setNotifStatus(null);
    if (notifsOn) {
      setNotificationsEnabled(false);
      setNotifsOn(false);
      setNotifStatus("Alerts turned off");
      setTimeout(() => setNotifStatus(null), 2200);
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) {
      setNotifStatus("Permission denied in device settings");
      return;
    }
    setNotificationsEnabled(true);
    setNotifsOn(true);
    await scheduleBillReminders(bills);
    setNotifStatus("Alerts enabled for bills & entry edits");
    setTimeout(() => setNotifStatus(null), 2600);
  };

  useEffect(() => {
    setDisplayName(profile.full_name);
    setAvatarColor(profile.avatar_color);
  }, [profile.avatar_color, profile.full_name]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await onUpdateProfile(displayName, avatarColor);
      setProfileSaved(true);
      setEditingProfile(false);
      setTimeout(() => setProfileSaved(false), 2200);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (newPassword.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    setSavingPw(true);
    try {
      await onUpdatePassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setEditingPassword(false);
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2400);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setSavingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await onDeleteAccount();
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLeaveHousehold = async () => {
    setLeavingHouse(true);
    try {
      await onLeaveHousehold();
    } finally {
      setLeavingHouse(false);
    }
  };

  const handleSignOutClick = () => {
    if (!isDemoMode && pendingSyncCount > 0) {
      setSignOutWarning(true);
      return;
    }
    void onSignOut();
  };

  const handleSyncBeforeSignOut = async () => {
    if (!onSyncNow) return;
    setSyncingBeforeSignOut(true);
    try {
      await onSyncNow();
    } finally {
      setSyncingBeforeSignOut(false);
    }
  };

  const handleClearLocalCache = () => {
    clearHouseholdSnapshot(profile.id);
    setCacheClearedMsg("Local offline cache cleared");
    setTimeout(() => setCacheClearedMsg(null), 2400);
  };

  return (
    <div className="space-y-4">
      {/* My Profile & Account Settings */}
      <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: profile.avatar_color }}
            >
              {getInitials(profile.full_name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[#1C1C1E]">
                {profile.full_name}
              </div>
              <div className="truncate text-xs text-[#8E8E93]">{profile.email}</div>
              {householdName && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-[#F6F5F2] px-2 py-0.5 text-[10px] font-medium text-[#52525B]">
                  <Shield className="h-2.5 w-2.5 text-[#8F703F]" />
                  <span>{memberRole === "admin" ? "Admin" : "Member"}</span>
                  <span>·</span>
                  <span className="truncate max-w-[140px]">{householdName}</span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditingProfile((prev) => !prev)}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-stone-900/10 bg-[#F6F5F2] px-3 py-1.5 text-xs font-medium text-[#1C1C1E] hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <Pencil className="h-3 w-3" />
            {editingProfile ? "Close" : "Edit"}
          </button>
        </div>

        {profileSaved && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Profile updated
          </div>
        )}

        {editingProfile && (
          <form
            onSubmit={(e) => void handleSaveProfile(e)}
            className="rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3.5 space-y-3"
          >
            <div>
              <label className="block text-xs font-medium text-[#52525B] mb-1">Display name</label>
              <SoftInput
                type="text"
                maxLength={80}
                value={displayName}
                onValueChange={setDisplayName}
                icon={<User className="h-4 w-4" />}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#52525B] mb-1.5">
                Avatar color
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_SWATCHES.map((hex) => {
                  const active = avatarColor.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Select avatar color ${hex}`}
                      onClick={() => setAvatarColor(hex)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full cursor-pointer ${
                        active ? "ring-2 ring-[#1C1C1E] ring-offset-2" : ""
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {active && <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <SoftButton
              type="submit"
              variant="filled"
              disabled={savingProfile}
              className="w-full !h-9 text-xs font-medium"
            >
              {savingProfile ? "Saving..." : "Save profile"}
            </SoftButton>
          </form>
        )}

        {/* Inline Change Password */}
        {!isDemoMode && (
          <div className="border-t border-stone-900/[0.06] pt-3">
            <button
              type="button"
              onClick={() => {
                setEditingPassword((prev) => !prev);
                setPwError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {editingPassword ? "Cancel password change" : "Change password"}
            </button>

            {pwSaved && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Password updated
              </div>
            )}

            {editingPassword && (() => {
              const hasConfirm = confirmPassword.length > 0;
              const pwMatches = newPassword.length >= 6 && newPassword === confirmPassword;
              return (
                <form
                  onSubmit={(e) => void handleSavePassword(e)}
                  className="mt-2.5 rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3.5 space-y-2.5"
                >
                  <MaskedSecretInput
                    placeholder="New password (min. 6 characters)"
                    minLength={6}
                    value={newPassword}
                    onValueChange={setNewPassword}
                    icon={<KeyRound className="h-4 w-4" />}
                    required
                    ariaLabel="New password"
                  />

                  <MaskedSecretInput
                    placeholder="Repeat new password"
                    minLength={6}
                    value={confirmPassword}
                    onValueChange={setConfirmPassword}
                    icon={<KeyRound className="h-4 w-4" />}
                    required
                    ariaLabel="Repeat new password"
                  />

                  {hasConfirm && (
                    <div
                      className={`flex items-center gap-1.5 text-xs font-medium ${
                        pwMatches ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {pwMatches ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Passwords match</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {newPassword.length < 6
                              ? "Use at least 6 characters"
                              : "Passwords do not match"}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {pwError && <p className="text-xs font-medium text-rose-700">{pwError}</p>}

                  <SoftButton
                    type="submit"
                    variant="filled"
                    disabled={savingPw || !pwMatches}
                    className="w-full !h-9 text-xs font-medium"
                  >
                    {savingPw ? "Updating..." : "Update password"}
                  </SoftButton>
                </form>
              );
            })()}
          </div>
        )}

      </section>

      {/* Optional Security & Notifications */}
      <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-3.5">
        <div>
          <h3 className="text-base font-semibold text-[#1C1C1E]">Security & alerts</h3>
          <p className="text-xs text-[#52525B] mt-0.5">
            Optional on-device PIN lock and bill/edit notifications
          </p>
        </div>

        {/* App PIN Lock */}
        <div className="rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Lock className="h-4 w-4 shrink-0 text-[#52525B]" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#1C1C1E]">App PIN lock</div>
                <div className="text-[11px] text-[#52525B]">
                  {hasPin ? "Active · locks when app resumes" : "Off · require 4-digit PIN to open"}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {hasPin && (
                <button
                  type="button"
                  onClick={handleRemovePin}
                  className="rounded-lg border border-stone-900/10 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 cursor-pointer"
                >
                  Turn off
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowPinForm((v) => !v);
                  setPinError(null);
                }}
                className="rounded-lg bg-[#1C1C1E] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#2C2C30] cursor-pointer"
              >
                {showPinForm ? "Cancel" : hasPin ? "Change" : "Set PIN"}
              </button>
            </div>
          </div>

          {pinSavedMsg && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{pinSavedMsg}</span>
            </div>
          )}

          {showPinForm && (() => {
            const hasPinConfirm = pinConfirm.length > 0;
            const pinsMatch = /^\d{4}$/.test(pinInput) && pinInput === pinConfirm;
            return (
              <form onSubmit={(e) => void handleSavePin(e)} className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <MaskedSecretInput
                    numericOnly
                    maxLength={4}
                    placeholder="4-digit PIN"
                    value={pinInput}
                    onValueChange={setPinInput}
                    allowToggleReveal={false}
                    required
                    ariaLabel="4-digit PIN"
                  />
                  <MaskedSecretInput
                    numericOnly
                    maxLength={4}
                    placeholder="Repeat PIN"
                    value={pinConfirm}
                    onValueChange={setPinConfirm}
                    allowToggleReveal={false}
                    required
                    ariaLabel="Repeat 4-digit PIN"
                  />
                </div>
                {hasPinConfirm && (
                  <div
                    className={`flex items-center gap-1.5 text-[11px] font-medium ${
                      pinsMatch ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {pinsMatch ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>PINs match</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {pinInput.length < 4 ? "Enter 4 digits first" : "PINs do not match"}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {pinError && <p className="text-[11px] font-medium text-rose-700">{pinError}</p>}
                <SoftButton
                  type="submit"
                  variant="filled"
                  disabled={!pinsMatch}
                  className="w-full !h-9 text-xs font-medium"
                >
                  Save 4-digit PIN
                </SoftButton>
              </form>
            );
          })()}
        </div>

        {/* Optional Fingerprint / Face Unlock (shown on Android devices with biometric hardware once PIN is set) */}
        {hasPin && biometricAvailable && (
          <div className="rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Fingerprint className="h-4 w-4 shrink-0 text-[#8F703F]" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#1C1C1E]">
                    Fingerprint / Face unlock
                  </div>
                  <div className="text-[11px] text-[#52525B]">
                    {biometricsOn
                      ? "On · unlock with biometrics (PIN as backup)"
                      : "Off · tap to enable biometric unlock"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleToggleBiometrics()}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  biometricsOn
                    ? "bg-[#1C1C1E] text-white"
                    : "border border-stone-900/10 bg-white text-[#1C1C1E]"
                }`}
              >
                {biometricsOn ? "On" : "Enable"}
              </button>
            </div>
            {bioMsg && <p className="text-[11px] font-medium text-[#8F703F]">{bioMsg}</p>}
          </div>
        )}

        {/* Optional Local Notifications (Native Android app only) */}
        {isNativeApp && (
          <div className="rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Bell className="h-4 w-4 shrink-0 text-[#52525B]" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#1C1C1E]">
                    Notifications (bills & edits)
                  </div>
                  <div className="text-[11px] text-[#52525B]">
                    {notifsOn
                      ? "On · alerts for due bills, new entries, and edits"
                      : "Off · opt in for bill reminders & edit alerts"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleToggleNotifications()}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  notifsOn
                    ? "bg-[#1C1C1E] text-white"
                    : "border border-stone-900/10 bg-white text-[#1C1C1E]"
                }`}
              >
                {notifsOn ? "On" : "Enable"}
              </button>
            </div>
            {notifStatus && (
              <p className="text-[11px] font-medium text-[#8F703F]">{notifStatus}</p>
            )}
          </div>
        )}
      </section>

      <SupportAndAboutCard onSubmitFeedback={onSubmitFeedback} />

      {/* Standalone Sign Out Section */}
      <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-3">
        {signOutWarning && pendingSyncCount > 0 ? (
          <div className="rounded-xl border border-amber-700/20 bg-amber-50/80 p-3 space-y-2.5">
            <div className="flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
              <p className="leading-snug">
                You have{" "}
                <strong>
                  {pendingSyncCount} unsynced offline{" "}
                  {pendingSyncCount === 1 ? "entry" : "entries"}
                </strong>
                . Sync before signing out so your changes are saved to the house.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSignOutWarning(false)}
                className="rounded-lg border border-stone-900/10 bg-white px-2.5 py-1.5 text-xs font-medium text-[#52525B] cursor-pointer"
              >
                Cancel
              </button>
              {onSyncNow && (
                <button
                  type="button"
                  disabled={syncingBeforeSignOut}
                  onClick={() => void handleSyncBeforeSignOut()}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#1C1C1E] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${syncingBeforeSignOut ? "animate-spin" : ""}`}
                  />
                  {syncingBeforeSignOut ? "Syncing..." : "Sync now"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="rounded-lg bg-rose-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-800 cursor-pointer"
              >
                Sign out anyway
              </button>
            </div>
          </div>
        ) : (
          <SoftButton
            onClick={handleSignOutClick}
            icon={<LogOut className="h-4 w-4" />}
            className="w-full !h-10 text-xs font-medium"
          >
            {isDemoMode ? "Exit demo" : "Sign out"}
          </SoftButton>
        )}
      </section>

      {/* Collapsed Danger Zone (hidden by default at bottom) */}
      <section className="rounded-2xl border border-stone-900/[0.08] bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setDangerZoneOpen((prev) => !prev)}
          aria-expanded={dangerZoneOpen}
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#F6F5F2]/60 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-[#8E8E93]" />
            <span className="text-xs font-medium text-[#52525B]">Danger zone & data</span>
          </div>
          {dangerZoneOpen ? (
            <ChevronUp className="h-4 w-4 text-[#8E8E93]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[#8E8E93]" />
          )}
        </button>

        {dangerZoneOpen && (
          <div className="border-t border-stone-900/[0.06] px-4 py-3.5 space-y-3.5">
            {/* Clear Local Offline Cache */}
            {!isDemoMode && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#1C1C1E]">Clear local cache</div>
                  <div className="text-[11px] text-[#52525B]">
                    Removes cached offline copy on this device without deleting house data
                  </div>
                  {cacheClearedMsg && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{cacheClearedMsg}</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClearLocalCache}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-900/10 bg-[#F6F5F2] px-2.5 py-1.5 text-[11px] font-medium text-[#1C1C1E] hover:bg-stone-200/60 cursor-pointer"
                >
                  <Database className="h-3 w-3" />
                  Clear
                </button>
              </div>
            )}

            {/* Leave House (with confirmation) */}
            <div className={!isDemoMode ? "border-t border-stone-900/[0.06] pt-3.5" : ""}>
              {confirmLeaveHouse ? (
                <div className="rounded-xl border border-amber-700/20 bg-amber-50/70 p-3 space-y-2.5">
                  <p className="text-xs font-medium text-amber-900">
                    {isDemoMode
                      ? "Reset demo household data back to the default sample?"
                      : `Leave ${householdName ?? "this household"}? You will need an invite code to rejoin.`}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmLeaveHouse(false)}
                      className="rounded-lg border border-stone-900/10 bg-white px-2.5 py-1 text-xs font-medium text-[#52525B] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={leavingHouse}
                      onClick={() => void handleLeaveHousehold()}
                      className="rounded-lg bg-rose-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-800 disabled:opacity-50 cursor-pointer"
                    >
                      {leavingHouse
                        ? "Leaving..."
                        : isDemoMode
                          ? "Confirm reset"
                          : "Confirm leave"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#1C1C1E]">
                      {isDemoMode ? "Reset demo household" : "Leave house"}
                    </div>
                    <div className="text-[11px] text-[#52525B]">
                      {isDemoMode
                        ? "Restore the sample roommates and transactions"
                        : "Remove yourself from this shared household"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmLeaveHouse(true)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-700/20 bg-rose-50/60 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100/70 cursor-pointer"
                  >
                    <DoorOpen className="h-3 w-3" />
                    {isDemoMode ? "Reset" : "Leave"}
                  </button>
                </div>
              )}
            </div>

            {/* Delete Account (requires typing DELETE) */}
            {!isDemoMode && (
              <div className="border-t border-stone-900/[0.06] pt-3.5">
                {confirmDeleteAccount ? (
                  <div className="rounded-xl border border-rose-700/20 bg-rose-50/70 p-3 space-y-2.5">
                    <p className="text-xs font-medium text-rose-800">
                      Permanently delete your Keeper account? This cannot be undone. Type{" "}
                      <span className="font-mono font-semibold">DELETE</span> to confirm.
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Type DELETE"
                      autoCapitalize="characters"
                      className="w-full rounded-lg border border-rose-700/25 bg-white px-3 py-1.5 text-xs text-[#1C1C1E] placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-rose-700/25"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteAccount(false);
                          setDeleteConfirmText("");
                        }}
                        className="rounded-lg border border-stone-900/10 bg-white px-2.5 py-1 text-xs font-medium text-[#52525B] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={
                          deletingAccount || deleteConfirmText.trim().toUpperCase() !== "DELETE"
                        }
                        onClick={() => void handleDeleteAccount()}
                        className="rounded-lg bg-rose-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-800 disabled:opacity-40 cursor-pointer"
                      >
                        {deletingAccount ? "Deleting..." : "Delete account"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-rose-700">Delete my account</div>
                      <div className="text-[11px] text-[#52525B]">
                        Permanently erase your account and profile
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteAccount(true);
                        setDeleteConfirmText("");
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-700/20 bg-rose-50/60 px-2.5 py-1.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100/70 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Quiet Legal Footer */}
      <div className="flex items-center justify-center gap-3 pb-2 text-[11px] text-[#8E8E93]">
        <button
          type="button"
          onClick={() => setLegalDoc("terms")}
          className="hover:text-[#1C1C1E] underline underline-offset-2 transition-colors cursor-pointer"
        >
          Terms of Service
        </button>
        <span>·</span>
        <button
          type="button"
          onClick={() => setLegalDoc("privacy")}
          className="hover:text-[#1C1C1E] underline underline-offset-2 transition-colors cursor-pointer"
        >
          Privacy Policy
        </button>
      </div>

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}

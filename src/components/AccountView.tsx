import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { getInitials } from "../lib/format";
import type { Profile } from "../types";
import { LegalModal, type LegalDocType } from "./LegalModal";
import { SoftButton, SoftInput } from "./LightControls";
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
  isDemoMode: boolean;
  onUpdateProfile: (fullName: string, avatarColor: string) => Promise<void>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
  onLeaveHousehold: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSubmitFeedback: (input: AppFeedbackInput) => Promise<void>;
}

export function AccountView({
  profile,
  isDemoMode,
  onUpdateProfile,
  onUpdatePassword,
  onLeaveHousehold,
  onDeleteAccount,
  onSignOut,
  onSubmitFeedback,
}: AccountViewProps) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(profile.full_name);
  const [avatarColor, setAvatarColor] = useState(profile.avatar_color);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);

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

            {editingPassword && (
              <form
                onSubmit={(e) => void handleSavePassword(e)}
                className="mt-2.5 rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3.5 space-y-2.5"
              >
                <div className="relative">
                  <SoftInput
                    type={showNewPw ? "text" : "password"}
                    placeholder="New password (min. 6 characters)"
                    minLength={6}
                    value={newPassword}
                    onValueChange={setNewPassword}
                    icon={<KeyRound className="h-4 w-4" />}
                    className="!pr-11"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showNewPw ? "Hide new password" : "Show new password"}
                    onClick={() => setShowNewPw((prev) => !prev)}
                    className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#8E8E93] hover:text-[#1C1C1E] transition-colors cursor-pointer"
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="relative">
                  <SoftInput
                    type={showConfirmPw ? "text" : "password"}
                    placeholder="Repeat new password"
                    minLength={6}
                    value={confirmPassword}
                    onValueChange={setConfirmPassword}
                    icon={<KeyRound className="h-4 w-4" />}
                    className="!pr-11"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPw ? "Hide confirm password" : "Show confirm password"}
                    onClick={() => setShowConfirmPw((prev) => !prev)}
                    className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#8E8E93] hover:text-[#1C1C1E] transition-colors cursor-pointer"
                  >
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {pwError && <p className="text-xs font-medium text-rose-700">{pwError}</p>}

                <SoftButton
                  type="submit"
                  variant="filled"
                  disabled={savingPw}
                  className="w-full !h-9 text-xs font-medium"
                >
                  {savingPw ? "Updating..." : "Update password"}
                </SoftButton>
              </form>
            )}
          </div>
        )}

        {/* Sign Out / Leave House */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <SoftButton
            onClick={() => void onSignOut()}
            icon={<LogOut className="h-4 w-4" />}
            className="w-full text-xs font-medium"
          >
            {isDemoMode ? "Exit demo" : "Sign out"}
          </SoftButton>
          <SoftButton
            variant="destructive"
            onClick={() => void onLeaveHousehold()}
            className="w-full text-xs font-medium"
          >
            {isDemoMode ? "Reset demo" : "Leave house"}
          </SoftButton>
        </div>

        {/* Self-Service Account Deletion */}
        {!isDemoMode && (
          <div className="border-t border-stone-900/[0.06] pt-3">
            {confirmDeleteAccount ? (
              <div className="rounded-xl border border-rose-700/20 bg-rose-50/70 p-3 space-y-2">
                <p className="text-xs font-medium text-rose-700">
                  Permanently delete your Keeper account? This cannot be undone.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAccount(false)}
                    className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-[#52525B] border border-stone-900/10 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deletingAccount}
                    onClick={() => void handleDeleteAccount()}
                    className="rounded-md bg-rose-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-800 disabled:opacity-50 cursor-pointer"
                  >
                    {deletingAccount ? "Deleting..." : "Delete account"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteAccount(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-800 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete my account
              </button>
            )}
          </div>
        )}

        {/* Quiet Legal Footer Links */}
        <div className="flex items-center justify-center gap-3 border-t border-stone-900/[0.06] pt-3 text-[11px] text-[#8E8E93]">
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
      </section>

      <SupportAndAboutCard onSubmitFeedback={onSubmitFeedback} />

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}

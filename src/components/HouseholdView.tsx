import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  LogOut,
  Pencil,
  Radio,
  RefreshCw,
  Shield,
  ShieldPlus,
  Trash2,
  User,
  UserMinus,
  Users,
} from "lucide-react";
import { getInitials } from "../lib/format";
import type { Household, HouseholdMember, Profile } from "../types";
import { LegalModal, type LegalDocType } from "./LegalModal";
import { SoftButton, SoftInput } from "./LightControls";

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

interface HouseholdViewProps {
  household: Household;
  profile: Profile;
  members: HouseholdMember[];
  isDemoMode: boolean;
  realtimeConnected: boolean;
  onUpdateProfile: (fullName: string, avatarColor: string) => Promise<void>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
  onRenameHousehold: (newName: string) => Promise<void>;
  onPromoteMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onRegenerateInviteCode: () => Promise<void>;
  onLeaveHousehold: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function HouseholdView({
  household,
  profile,
  members,
  isDemoMode,
  realtimeConnected,
  onUpdateProfile,
  onUpdatePassword,
  onRenameHousehold,
  onPromoteMember,
  onRemoveMember,
  onRegenerateInviteCode,
  onLeaveHousehold,
  onDeleteAccount,
  onSignOut,
}: HouseholdViewProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);

  // Admin: Rename household
  const [renamingHouse, setRenamingHouse] = useState(false);
  const [houseNameInput, setHouseNameInput] = useState(household.name);
  const [savingHouseName, setSavingHouseName] = useState(false);

  // Admin: Member removal / promotion confirmation
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  // Profile editor
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(profile.full_name);
  const [avatarColor, setAvatarColor] = useState(profile.avatar_color);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password change
  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  // Delete account confirmation + Legal sheet
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);

  useEffect(() => {
    setHouseNameInput(household.name);
  }, [household.name]);

  useEffect(() => {
    setDisplayName(profile.full_name);
    setAvatarColor(profile.avatar_color);
  }, [profile.avatar_color, profile.full_name]);

  const isAdmin = members.some((m) => m.user_id === profile.id && m.role === "admin");

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(household.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const copyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}/?join=${encodeURIComponent(household.invite_code)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      if (navigator.share) {
        await navigator
          .share({
            title: `Join ${household.name} on Keeper`,
            text: `Join our shared household budget on Keeper using code ${household.invite_code}`,
            url: inviteUrl,
          })
          .catch(() => {});
      }
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      await onRegenerateInviteCode();
      setConfirmRotate(false);
    } finally {
      setRotating(false);
    }
  };

  const handleRenameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!houseNameInput.trim()) return;
    setSavingHouseName(true);
    try {
      await onRenameHousehold(houseNameInput);
      setRenamingHouse(false);
    } finally {
      setSavingHouseName(false);
    }
  };

  const handlePromote = async (userId: string) => {
    setBusyMemberId(userId);
    try {
      await onPromoteMember(userId);
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    setBusyMemberId(userId);
    try {
      await onRemoveMember(userId);
      setConfirmRemoveId(null);
    } finally {
      setBusyMemberId(null);
    }
  };

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
      {/* Household Identity, Rename & Invite Code */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              <Radio
                className={`h-3 w-3 ${
                  isDemoMode
                    ? "text-amber-500"
                    : realtimeConnected
                      ? "text-emerald-500"
                      : "text-slate-400"
                }`}
              />
              {isDemoMode
                ? "Local Demo Mode"
                : realtimeConnected
                  ? "Live Sync Active"
                  : "Synced with Supabase"}
            </span>

            {renamingHouse ? (
              <form onSubmit={(e) => void handleRenameSubmit(e)} className="mt-2 space-y-2">
                <SoftInput
                  type="text"
                  maxLength={80}
                  value={houseNameInput}
                  onValueChange={setHouseNameInput}
                  placeholder="Household name"
                  required
                />
                <div className="flex items-center gap-2">
                  <SoftButton
                    type="submit"
                    variant="filled"
                    disabled={savingHouseName}
                    className="!h-8 text-xs font-semibold"
                  >
                    {savingHouseName ? "Saving..." : "Save Name"}
                  </SoftButton>
                  <button
                    type="button"
                    onClick={() => {
                      setHouseNameInput(household.name);
                      setRenamingHouse(false);
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <h2 className="truncate text-lg font-bold text-slate-900">{household.name}</h2>
                {isAdmin && (
                  <button
                    type="button"
                    aria-label="Rename household"
                    onClick={() => setRenamingHouse(true)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 cursor-pointer"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            <p className="text-xs text-slate-500 mt-0.5">
              Currency: <strong>TZS</strong> · {members.length} members
            </p>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF8F2] text-[#BFA377]">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Private Invite Code
              </div>
              <div className="font-mono text-lg font-bold tracking-[0.18em] text-slate-900 mt-0.5">
                {household.invite_code}
              </div>
            </div>
            <SoftButton
              onClick={() => void copyCode()}
              className="!h-9 text-xs font-semibold"
              icon={
                copiedCode ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )
              }
            >
              {copiedCode ? "Copied" : "Code"}
            </SoftButton>
          </div>

          <SoftButton
            onClick={() => void copyInviteLink()}
            icon={
              copiedLink ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Link2 className="h-4 w-4" />
              )
            }
            className="w-full !h-9 text-xs font-semibold"
          >
            {copiedLink ? "Invite Link Copied" : "Copy Direct Invite Link"}
          </SoftButton>

          {isAdmin && (
            <div className="pt-2 border-t border-slate-200/70">
              {confirmRotate ? (
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-600">Revoke old invite code?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmRotate(false)}
                      className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={rotating}
                      onClick={() => void handleRotate()}
                      className="rounded-lg bg-slate-900 px-2.5 py-1 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                    >
                      {rotating ? "Rotating..." : "Confirm"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRotate(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  Rotate invite code (revokes old code)
                </button>
              )}
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Share the code or direct link privately with roommates so they can join and see the shared
          budget.
        </p>
      </section>

      {/* Household Members + Admin Controls */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
        <h3 className="text-[15px] font-semibold text-slate-900 mb-3">Roommates</h3>
        <div className="space-y-2.5">
          {members.map((m) => {
            const isSelf = m.user_id === profile.id;
            const isBusy = busyMemberId === m.user_id;
            const confirmingRemove = confirmRemoveId === m.user_id;

            return (
              <div
                key={m.user_id}
                className="rounded-2xl border border-slate-100 bg-[#FAFBFD] px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: m.profile.avatar_color }}
                    >
                      {getInitials(m.profile.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-slate-900">
                        {m.profile.full_name}
                        {isSelf && (
                          <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                            (You)
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">{m.profile.email}</div>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold capitalize text-slate-600">
                    {m.role === "admin" && <Shield className="h-2.5 w-2.5 text-[#BFA377]" />}
                    {m.role}
                  </span>
                </div>

                {isAdmin && !isSelf && (
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-2">
                    {confirmingRemove ? (
                      <>
                        <span className="mr-auto text-[11px] text-rose-600 font-medium">
                          Remove from house?
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleRemove(m.user_id)}
                          className="rounded-lg bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                        >
                          {isBusy ? "Removing..." : "Confirm"}
                        </button>
                      </>
                    ) : (
                      <>
                        {m.role !== "admin" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handlePromote(m.user_id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50 cursor-pointer"
                          >
                            <ShieldPlus className="h-3 w-3" />
                            Make Admin
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmRemoveId(m.user_id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                        >
                          <UserMinus className="h-3 w-3" />
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* My Profile & Account Settings */}
      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_2px_16px_rgba(15,23,42,0.04)] space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: profile.avatar_color }}
            >
              {getInitials(profile.full_name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">{profile.full_name}</div>
              <div className="truncate text-[11px] text-slate-500">{profile.email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditingProfile((prev) => !prev)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <Pencil className="h-3 w-3" />
            {editingProfile ? "Close" : "Edit Profile"}
          </button>
        </div>

        {profileSaved && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Profile updated!
          </div>
        )}

        {editingProfile && (
          <form
            onSubmit={(e) => void handleSaveProfile(e)}
            className="rounded-2xl border border-slate-100 bg-[#FAFBFD] p-3.5 space-y-3"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Display Name
              </label>
              <SoftInput
                type="text"
                maxLength={80}
                value={displayName}
                onValueChange={setDisplayName}
                icon={<User className="h-4 w-4 text-slate-400" />}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Avatar Color
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
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform cursor-pointer ${
                        active ? "scale-110 ring-2 ring-slate-900 ring-offset-2" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {active && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <SoftButton
              type="submit"
              variant="filled"
              disabled={savingProfile}
              className="w-full !h-9 text-xs font-semibold"
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </SoftButton>
          </form>
        )}

        {/* Inline Change Password */}
        {!isDemoMode && (
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => {
                setEditingPassword((prev) => !prev);
                setPwError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {editingPassword ? "Cancel Password Change" : "Change Password"}
            </button>

            {pwSaved && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Password updated!
              </div>
            )}

            {editingPassword && (
              <form
                onSubmit={(e) => void handleSavePassword(e)}
                className="mt-2.5 rounded-2xl border border-slate-100 bg-[#FAFBFD] p-3.5 space-y-2.5"
              >
                <div className="relative">
                  <SoftInput
                    type={showNewPw ? "text" : "password"}
                    placeholder="New password (min. 6 characters)"
                    minLength={6}
                    value={newPassword}
                    onValueChange={setNewPassword}
                    icon={<KeyRound className="h-4 w-4 text-slate-400" />}
                    className="!pr-11"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showNewPw ? "Hide new password" : "Show new password"}
                    onClick={() => setShowNewPw((prev) => !prev)}
                    className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="relative">
                  <SoftInput
                    type={showConfirmPw ? "text" : "password"}
                    placeholder="Type new password again"
                    minLength={6}
                    value={confirmPassword}
                    onValueChange={setConfirmPassword}
                    icon={<KeyRound className="h-4 w-4 text-slate-400" />}
                    className="!pr-11"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPw ? "Hide confirm password" : "Show confirm password"}
                    onClick={() => setShowConfirmPw((prev) => !prev)}
                    className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {pwError && (
                  <p className="text-[11px] font-medium text-rose-600">{pwError}</p>
                )}

                <SoftButton
                  type="submit"
                  variant="filled"
                  disabled={savingPw}
                  className="w-full !h-9 text-xs font-semibold"
                >
                  {savingPw ? "Updating..." : "Update Password"}
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
            className="w-full text-xs font-semibold"
          >
            {isDemoMode ? "Exit Demo" : "Sign Out"}
          </SoftButton>
          <SoftButton
            variant="destructive"
            onClick={() => void onLeaveHousehold()}
            className="w-full text-xs font-semibold"
          >
            {isDemoMode ? "Reset Demo" : "Leave House"}
          </SoftButton>
        </div>

        {/* Self-Service Account Deletion */}
        {!isDemoMode && (
          <div className="border-t border-slate-100 pt-3">
            {confirmDeleteAccount ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 space-y-2">
                <p className="text-[11px] font-medium text-rose-700">
                  Permanently delete your Keeper account? This cannot be undone.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAccount(false)}
                    className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deletingAccount}
                    onClick={() => void handleDeleteAccount()}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                  >
                    {deletingAccount ? "Deleting..." : "Yes, Delete Account"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteAccount(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-500 hover:text-rose-700 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                Delete my account
              </button>
            )}
          </div>
        )}

        {/* Quiet Legal Footer Links */}
        <div className="flex items-center justify-center gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
          <button
            type="button"
            onClick={() => setLegalDoc("terms")}
            className="hover:text-slate-700 underline underline-offset-2 cursor-pointer"
          >
            Terms of Service
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => setLegalDoc("privacy")}
            className="hover:text-slate-700 underline underline-offset-2 cursor-pointer"
          >
            Privacy Policy
          </button>
        </div>
      </section>

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  QrCode,
  RefreshCw,
  ShieldPlus,
  Trash2,
  User,
  UserMinus,
} from "lucide-react";
import { getInitials } from "../lib/format";
import { generateQrMatrix } from "../lib/qr";
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
  const [showQr, setShowQr] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);

  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : "https://keeper.vercel.app"}/?join=${encodeURIComponent(household.invite_code)}`;
  const qrMatrix = useMemo(
    () => (showQr ? generateQrMatrix(inviteUrl) : null),
    [inviteUrl, showQr],
  );

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
      {/* Household Identity & Tactile Obsidian-Brass House Key Pass Moment */}
      <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#52525B]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isDemoMode
                    ? "bg-[#C6A87C]"
                    : realtimeConnected
                      ? "bg-emerald-600"
                      : "bg-stone-400"
                }`}
              />
              {isDemoMode
                ? "Local demo mode"
                : realtimeConnected
                  ? "Live sync active"
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
                    className="!h-8 text-xs font-medium"
                  >
                    {savingHouseName ? "Saving..." : "Save name"}
                  </SoftButton>
                  <button
                    type="button"
                    onClick={() => {
                      setHouseNameInput(household.name);
                      setRenamingHouse(false);
                    }}
                    className="text-xs font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-1.5 flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-[#1C1C1E]">{household.name}</h2>
                {isAdmin && (
                  <button
                    type="button"
                    aria-label="Rename household"
                    onClick={() => setRenamingHouse(true)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-stone-100 text-[#52525B] hover:bg-stone-200 hover:text-[#1C1C1E] transition-colors cursor-pointer"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            <p className="text-xs text-[#8E8E93] mt-0.5">
              Currency: <span className="font-mono text-[#52525B]">TZS</span> · {members.length}{" "}
              {members.length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>

        {/* Visual Moment: Tactile Obsidian & Brass House Key Pass Card */}
        <div className="rounded-xl border border-[#C6A87C]/30 bg-[#1C1C1E] p-4 text-white space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
                <span>Household invite key</span>
              </div>
              <div className="mt-1 font-mono text-lg font-semibold tracking-wider text-[#E4CCA0] tabular-nums">
                {household.invite_code}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                aria-label={showQr ? "Hide QR invite key" : "Show QR invite key"}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 text-xs font-medium text-white transition-colors hover:bg-white/15 cursor-pointer"
              >
                <QrCode className="h-3.5 w-3.5 text-[#E4CCA0]" />
                <span>{showQr ? "Hide QR" : "QR key"}</span>
              </button>
              <button
                type="button"
                onClick={() => void copyCode()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/15 cursor-pointer"
              >
                {copiedCode ? (
                  <Check className="h-3.5 w-3.5 text-[#E4CCA0]" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-[#E4CCA0]" />
                )}
                <span>{copiedCode ? "Copied" : "Copy code"}</span>
              </button>
            </div>
          </div>

          {showQr && qrMatrix && (
            <div className="flex flex-col items-center rounded-lg bg-white p-3 text-[#1C1C1E]">
              <svg
                viewBox={`0 0 ${qrMatrix.length + 8} ${qrMatrix.length + 8}`}
                className="h-44 w-44"
                shapeRendering="crispEdges"
                role="img"
                aria-label={`QR code to join ${household.name}`}
              >
                <rect width={qrMatrix.length + 8} height={qrMatrix.length + 8} fill="#FFFFFF" />
                {qrMatrix.map((row, r) =>
                  row.map((dark, c) =>
                    dark ? (
                      <rect
                        key={`${r}-${c}`}
                        x={c + 4}
                        y={r + 4}
                        width={1}
                        height={1}
                        fill="#1C1C1E"
                      />
                    ) : null,
                  ),
                )}
              </svg>
              <p className="mt-1.5 text-[11px] font-medium text-[#52525B]">
                Scan with phone camera to join {household.name}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => void copyInviteLink()}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#E4CCA0] px-3 text-xs font-medium text-[#1C1C1E] transition-colors hover:bg-[#D5B98A] cursor-pointer"
          >
            {copiedLink ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            <span>{copiedLink ? "Invite link copied" : "Copy invite link"}</span>
          </button>

          {isAdmin && (
            <div className="pt-2 border-t border-white/10">
              {confirmRotate ? (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-stone-300">Revoke current invite key?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmRotate(false)}
                      className="rounded-md bg-white/10 px-2.5 py-1 font-medium text-stone-300 hover:bg-white/15 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={rotating}
                      onClick={() => void handleRotate()}
                      className="rounded-md bg-[#E4CCA0] px-2.5 py-1 font-medium text-[#1C1C1E] hover:bg-[#D5B98A] disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {rotating ? "Rotating..." : "Confirm"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRotate(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-white transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Rotate invite key (revokes current code)</span>
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-[#8E8E93]">
          Any roommate can use this key or link to join {household.name}
        </p>
      </section>

      {/* Household Members + Admin Controls */}
      <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-base font-semibold text-[#1C1C1E]">Roommates</h3>
          <span className="font-mono text-xs text-[#8E8E93]">{members.length}</span>
        </div>
        <div className="divide-y divide-stone-900/[0.06]">
          {members.map((m) => {
            const isSelf = m.user_id === profile.id;
            const isBusy = busyMemberId === m.user_id;
            const confirmingRemove = confirmRemoveId === m.user_id;

            return (
              <div key={m.user_id} className="py-3 first:pt-1 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: m.profile.avatar_color }}
                    >
                      {getInitials(m.profile.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[#1C1C1E]">
                        {m.profile.full_name}
                        {isSelf && (
                          <span className="ml-1.5 text-xs font-normal text-[#8E8E93]">
                            (You)
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-[#8E8E93]">{m.profile.email}</div>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-[#52525B]">
                    {m.role === "admin" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
                    )}
                    {m.role === "admin" ? "Admin" : "Member"}
                  </span>
                </div>

                {isAdmin && !isSelf && (
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5 pl-12">
                    {confirmingRemove ? (
                      <>
                        <span className="mr-auto text-xs text-rose-700 font-medium">
                          Remove from house?
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-[#52525B] hover:bg-stone-200 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleRemove(m.user_id)}
                          className="rounded-md bg-rose-700 px-2 py-1 text-xs font-medium text-white hover:bg-rose-800 disabled:opacity-50 transition-colors cursor-pointer"
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
                            className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-[#1C1C1E] hover:bg-stone-200 disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            <ShieldPlus className="h-3 w-3" />
                            Make admin
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmRemoveId(m.user_id)}
                          className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-colors cursor-pointer"
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
            {editingProfile ? "Close" : "Edit profile"}
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
              <label className="block text-xs font-medium text-[#52525B] mb-1">
                Display name
              </label>
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

                {pwError && (
                  <p className="text-xs font-medium text-rose-700">{pwError}</p>
                )}

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

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}

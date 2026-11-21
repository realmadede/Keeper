import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Link2,
  Pencil,
  QrCode,
  RefreshCw,
  Share2,
  ShieldPlus,
  UserMinus,
} from "lucide-react";
import {
  computeMemberTotals,
  computeWhoOwesWhom,
  type MemberTotalSummary,
} from "../lib/analytics";
import { formatTZS, getInitials } from "../lib/format";
import { generateQrMatrix } from "../lib/qr";
import type {
  Household,
  HouseholdMember,
  HouseholdNeed,
  Profile,
  RecurringBill,
  Transaction,
} from "../types";
import { SoftButton, SoftInput, SoftSegmented } from "./LightControls";

interface HouseholdViewProps {
  household: Household;
  profile: Profile;
  members: HouseholdMember[];
  transactions: Transaction[];
  bills: RecurringBill[];
  needs: HouseholdNeed[];
  isDemoMode: boolean;
  realtimeConnected: boolean;
  onRenameHousehold: (newName: string) => Promise<void>;
  onPromoteMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onRegenerateInviteCode: () => Promise<void>;
  onSettlePairwiseDebts: (
    fromUserId: string,
    toUserId: string,
    billIds: string[],
    needIds: string[],
  ) => Promise<void>;
}

export function HouseholdView({
  household,
  profile,
  members,
  transactions,
  bills,
  needs,
  isDemoMode,
  realtimeConnected,
  onRenameHousehold,
  onPromoteMember,
  onRemoveMember,
  onRegenerateInviteCode,
  onSettlePairwiseDebts,
}: HouseholdViewProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);

  // Member totals card state
  const [totalsScope, setTotalsScope] = useState<"all_time" | "this_month">("all_time");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);

  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const memberTotals = useMemo(
    () => computeMemberTotals(members, transactions, bills, needs, totalsScope),
    [bills, members, needs, totalsScope, transactions],
  );

  const settlements = useMemo(
    () => computeWhoOwesWhom(members, bills, needs),
    [bills, members, needs],
  );

  const copyMemberStatement = async (summary: MemberTotalSummary) => {
    const scopeTitle = totalsScope === "this_month" ? "This month" : "All time";
    const lines = [
      `${household.name} — ${summary.member.profile.full_name} (${scopeTitle})`,
      `Total paid: ${formatTZS(summary.totalPaid)}`,
      `• Weekly pool: ${formatTZS(summary.contributionsPaid)}`,
      `• Bills: ${formatTZS(summary.billsPaid)}`,
      `• Needs: ${formatTZS(summary.needsPaid)}`,
    ];
    if (summary.netPayback > 0) {
      lines.push(`Pending payback: Owed ${formatTZS(summary.netPayback)} back`);
    } else if (summary.netPayback < 0) {
      lines.push(`Pending payback: Owes ${formatTZS(Math.abs(summary.netPayback))}`);
    }
    if (summary.items.length > 0) {
      lines.push("", "Breakdown:");
      for (const it of summary.items.slice(0, 15)) {
        const tag =
          it.source === "contribution" ? "Pool" : it.source === "bill" ? "Bill" : "Need";
        lines.push(`- [${tag}] ${it.label}: ${formatTZS(it.amount)}`);
      }
    }
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMemberId(summary.member.user_id);
      setTimeout(() => setCopiedMemberId(null), 2200);
    } catch {
      if (navigator.share) {
        await navigator.share({ title: `${summary.member.profile.full_name} Statement`, text }).catch(() => {});
      }
    }
  };

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

  useEffect(() => {
    setHouseNameInput(household.name);
  }, [household.name]);

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

      {/* Who Owes Whom Net Settlement Summary */}
      {settlements.length > 0 && (
        <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-[#1C1C1E]">Who owes whom</h3>
            <p className="text-xs text-[#52525B] mt-0.5">
              Combined net balance across unsettled 1-member bills and needs
            </p>
          </div>
          <div className="divide-y divide-stone-900/[0.06]">
            {settlements.map((s) => {
              const key = `${s.from.user_id}->${s.to.user_id}`;
              const busy = settlingKey === key;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[#1C1C1E]">
                      <span className="truncate">{s.from.profile.full_name.split(" ")[0]}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-[#8F703F]" />
                      <span className="truncate">{s.to.profile.full_name.split(" ")[0]}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#8E8E93] tabular-nums">
                      {formatTZS(s.amount)} · {s.itemCount}{" "}
                      {s.itemCount === 1 ? "item" : "items"}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setSettlingKey(key);
                      try {
                        await onSettlePairwiseDebts(
                          s.from.user_id,
                          s.to.user_id,
                          s.billIds,
                          s.needIds,
                        );
                      } finally {
                        setSettlingKey(null);
                      }
                    }}
                    className="shrink-0 rounded-lg bg-[#1C1C1E] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#2C2C30] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {busy ? "Settling..." : "Settle all"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Member Total Paid (Contributions + Bills + Needs) */}
      <section className="rounded-2xl border border-stone-900/[0.08] bg-white p-4 space-y-3">
        <div>
          <h3 className="text-base font-semibold text-[#1C1C1E]">Member totals</h3>
          <p className="text-xs text-[#52525B] mt-0.5">
            Total paid across weekly pool, bills, and house needs
          </p>
        </div>

        <SoftSegmented
          value={totalsScope}
          onValueChange={(v) => setTotalsScope(v as "all_time" | "this_month")}
          items={[
            { value: "all_time", label: "All time" },
            { value: "this_month", label: "This month" },
          ]}
        />

        <div className="divide-y divide-stone-900/[0.06]">
          {memberTotals.map((row) => {
            const expanded = expandedMemberId === row.member.user_id;
            const isCopied = copiedMemberId === row.member.user_id;
            return (
              <div key={row.member.user_id} className="py-3 first:pt-1 last:pb-0 space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedMemberId(expanded ? null : row.member.user_id)
                  }
                  className="flex w-full items-start justify-between gap-2 text-left cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                      style={{ backgroundColor: row.member.profile.avatar_color }}
                    >
                      {getInitials(row.member.profile.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-[#1C1C1E]">
                          {row.member.profile.full_name}
                        </span>
                        {row.member.user_id === profile.id && (
                          <span className="text-xs text-[#8E8E93]">(You)</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#52525B] tabular-nums">
                        Pool {formatTZS(row.contributionsPaid)} · Bills{" "}
                        {formatTZS(row.billsPaid)} · Needs {formatTZS(row.needsPaid)}
                      </div>
                      {row.netPayback !== 0 && (
                        <div
                          className={`mt-0.5 text-[11px] font-medium tabular-nums ${
                            row.netPayback > 0 ? "text-emerald-700" : "text-[#8F703F]"
                          }`}
                        >
                          {row.netPayback > 0
                            ? `Owed ${formatTZS(row.netPayback)} back`
                            : `Owes ${formatTZS(Math.abs(row.netPayback))}`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-sm font-semibold text-[#1C1C1E] tabular-nums">
                      {formatTZS(row.totalPaid)}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-[#8E8E93] transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {expanded && (
                  <div className="ml-10 rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] p-3 space-y-2">
                    {row.items.length === 0 ? (
                      <p className="text-xs text-[#8E8E93]">
                        No payments recorded in this period yet
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                        {row.items.map((item, idx) => (
                          <div
                            key={`${item.source}-${idx}`}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex items-center gap-1.5">
                              <span className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#52525B] border border-stone-900/[0.06]">
                                {item.source === "contribution"
                                  ? "Pool"
                                  : item.source === "bill"
                                    ? "Bill"
                                    : "Need"}
                              </span>
                              <span className="truncate text-[#1C1C1E]">{item.label}</span>
                            </div>
                            <span className="shrink-0 font-medium text-[#1C1C1E] tabular-nums">
                              {formatTZS(item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-stone-900/[0.06]">
                      <button
                        type="button"
                        onClick={() => void copyMemberStatement(row)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-900/10 bg-white px-2.5 py-1 text-xs font-medium text-[#1C1C1E] hover:bg-stone-50 transition-colors cursor-pointer"
                      >
                        {isCopied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-700" />
                        ) : (
                          <Share2 className="h-3.5 w-3.5 text-[#52525B]" />
                        )}
                        <span>{isCopied ? "Copied for WhatsApp" : "Copy statement"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

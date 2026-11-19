import { useState, type FormEvent } from "react";
import { Button, Glass, Input, SegmentedControl } from "glisse";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, Mail, Sparkles, User } from "lucide-react";
import { KeeperLogo } from "./KeeperLogo";
import { LegalModal, type LegalDocType } from "./LegalModal";

interface AuthScreenProps {
  isSupabaseReady: boolean;
  passwordRecoveryMode?: boolean;
  pendingInviteCode?: string | null;
  error: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (fullName: string, email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
  onEnterDemo: () => void;
}

export function AuthScreen({
  isSupabaseReady,
  passwordRecoveryMode = false,
  pendingInviteCode,
  error,
  onSignIn,
  onSignUp,
  onResetPassword,
  onUpdatePassword,
  onEnterDemo,
}: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  const handleModeChange = (next: string) => {
    setMode(next as "signin" | "signup");
    setLocalError(null);
    setResetSent(false);
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (passwordRecoveryMode) {
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match. Please type your new password again.");
        return;
      }
      setSubmitting(true);
      try {
        await onUpdatePassword(password);
      } catch {
        // Error surfaced via store
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "forgot") {
      setSubmitting(true);
      try {
        await onResetPassword(email);
        setResetSent(true);
      } catch {
        // Error surfaced via store
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setLocalError("Passwords do not match. Please type your chosen password again.");
      return;
    }

    if (mode === "signup" && !acceptedTerms) {
      setLocalError("Please agree to the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await onSignIn(email, password);
      } else {
        await onSignUp(fullName, email, password);
      }
    } catch {
      // Error surfaced via store
    } finally {
      setSubmitting(false);
    }
  };

  const displayedError = localError ?? error;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] space-y-5">
        {/* Brand Header */}
        <div className="text-center">
          <KeeperLogo
            size={60}
            className="mx-auto mb-3 drop-shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
          />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Keeper</h1>
          <p className="mt-1 text-xs text-slate-500">
            One household, one shared budget, complete transparency.
          </p>
          {pendingInviteCode && !passwordRecoveryMode && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#E5D3B3] bg-[#FBF8F1] px-3 py-1 text-[11px] font-semibold text-[#7A5E31]">
              Joining household code: <span className="font-mono tracking-wider">{pendingInviteCode}</span>
            </div>
          )}
        </div>

        <Glass className="rounded-[28px] !bg-white/85 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
          {passwordRecoveryMode ? (
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">Set New Password</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose a new password for your Keeper account.
              </p>
            </div>
          ) : mode === "forgot" ? (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => handleModeChange("signin")}
                className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </button>
              <h2 className="text-base font-bold text-slate-900">Reset Password</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter your email and we will send you a password reset link.
              </p>
            </div>
          ) : (
            <div className="mb-5 flex justify-center">
              <SegmentedControl
                className="keeper-segmented-2"
                value={mode}
                onValueChange={handleModeChange}
                items={[
                  { value: "signin", label: "Sign In" },
                  { value: "signup", label: "Create Account" },
                ]}
              />
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
            {!passwordRecoveryMode && mode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                <Input
                  type="text"
                  placeholder="e.g. Amani Juma"
                  value={fullName}
                  onValueChange={setFullName}
                  icon={<User className="h-4 w-4 text-slate-400" />}
                  className="w-full"
                  required
                />
              </div>
            )}

            {!passwordRecoveryMode && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onValueChange={setEmail}
                  icon={<Mail className="h-4 w-4 text-slate-400" />}
                  className="w-full"
                  required
                />
              </div>
            )}

            {(passwordRecoveryMode || mode !== "forgot") && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600">
                    {passwordRecoveryMode ? "New Password" : "Password"}
                  </label>
                  {!passwordRecoveryMode && mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setLocalError(null);
                        setResetSent(false);
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={
                      passwordRecoveryMode || mode === "signup"
                        ? "Choose a password (min. 6 characters)"
                        : "Enter your password"
                    }
                    minLength={6}
                    value={password}
                    onValueChange={(v) => {
                      setPassword(v);
                      if (localError) setLocalError(null);
                    }}
                    icon={<KeyRound className="h-4 w-4 text-slate-400" />}
                    className="w-full !pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {(passwordRecoveryMode || mode === "signup") && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600">
                    Confirm Password
                  </label>
                  {passwordsMatch && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <Check className="h-3 w-3" />
                      Matches
                    </span>
                  )}
                  {passwordsMismatch && (
                    <span className="text-[11px] font-medium text-rose-500">Does not match</span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Type your password again"
                    minLength={6}
                    value={confirmPassword}
                    onValueChange={(v) => {
                      setConfirmPassword(v);
                      if (localError) setLocalError(null);
                    }}
                    icon={<KeyRound className="h-4 w-4 text-slate-400" />}
                    className="w-full !pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                    }
                    className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-900/5 hover:text-slate-700 cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {!passwordRecoveryMode && mode === "signup" && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={acceptedTerms}
                  aria-label="Agree to Terms of Service and Privacy Policy"
                  onClick={() => {
                    setAcceptedTerms((prev) => !prev);
                    if (localError) setLocalError(null);
                  }}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors cursor-pointer ${
                    acceptedTerms
                      ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                      : "border-slate-300 bg-white text-transparent hover:border-slate-500"
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </button>
                <p className="text-[11px] leading-snug text-slate-600">
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setLegalDoc("terms")}
                    className="font-semibold text-slate-900 underline underline-offset-2 hover:text-[#A68756] cursor-pointer"
                  >
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={() => setLegalDoc("privacy")}
                    className="font-semibold text-slate-900 underline underline-offset-2 hover:text-[#A68756] cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                  .
                </p>
              </div>
            )}

            {resetSent && mode === "forgot" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                Password reset link sent to <strong>{email}</strong>. Check your inbox.
              </div>
            )}

            {displayedError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {displayedError}
              </div>
            )}

            <Button
              type="submit"
              variant="filled"
              disabled={submitting || (!passwordRecoveryMode && mode === "signup" && !acceptedTerms)}
              className="w-full justify-center !h-11 text-sm font-semibold"
            >
              {submitting
                ? "Please wait..."
                : passwordRecoveryMode
                  ? "Update Password"
                  : mode === "forgot"
                    ? "Send Reset Link"
                    : mode === "signin"
                      ? "Sign In to Household"
                      : "Create Keeper Account"}
            </Button>
          </form>

          {/* Auto-hide Demo Mode once real Supabase credentials are configured */}
          {!isSupabaseReady && !passwordRecoveryMode && mode !== "forgot" && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-medium text-slate-400">OR</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <Button
                onClick={onEnterDemo}
                icon={<Sparkles className="h-4 w-4 text-[#BFA377]" />}
                className="w-full justify-center !h-10 text-xs font-semibold"
              >
                Preview Demo Household (TZS)
              </Button>
            </>
          )}
        </Glass>
      </div>

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { Glass, SegmentedControl } from "glisse";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, Mail, User } from "lucide-react";
import { KeeperLogo } from "./KeeperLogo";
import { LegalModal, type LegalDocType } from "./LegalModal";
import { SoftButton, SoftInput } from "./LightControls";

interface AuthScreenProps {
  isSupabaseReady: boolean;
  initialMode?: "signin" | "signup";
  passwordRecoveryMode?: boolean;
  pendingInviteCode?: string | null;
  error: string | null;
  onBack?: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (fullName: string, email: string, password: string) => Promise<void>;
  onSignInWithGoogle: () => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onUpdatePassword: (newPassword: string) => Promise<void>;
  onEnterDemo: () => void;
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3c-1.07.72-2.45 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.25v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.27a7.21 7.21 0 0 1 0-4.54v-3.1H1.25a12 12 0 0 0 0 10.74l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.25 6.63l4 3.1c.95-2.85 3.61-4.96 6.75-4.96Z"
      />
    </svg>
  );
}

export function AuthScreen({
  isSupabaseReady,
  initialMode = "signin",
  passwordRecoveryMode = false,
  pendingInviteCode,
  error,
  onBack,
  onSignIn,
  onSignUp,
  onSignInWithGoogle,
  onResetPassword,
  onUpdatePassword,
  onEnterDemo,
}: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode);
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
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const handleGoogleAuth = async () => {
    setLocalError(null);
    if (mode === "signup" && !acceptedTerms) {
      setLocalError("Please agree to the Terms of Service and Privacy Policy first.");
      return;
    }
    setGoogleSubmitting(true);
    try {
      await onSignInWithGoogle();
    } catch {
      // Error surfaced via store
    } finally {
      setGoogleSubmitting(false);
    }
  };

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
        {onBack && !passwordRecoveryMode && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              About Keeper
            </button>
          </div>
        )}

        {/* Brand Header */}
        <div className="text-center">
          <KeeperLogo
            size={56}
            className="mx-auto mb-3 drop-shadow-[0_8px_18px_rgba(28,28,30,0.14)]"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-[#1C1C1E]">Keeper</h1>
          <p className="mt-1 text-xs text-[#52525B]">
            One household, one shared budget, complete transparency.
          </p>
          {pendingInviteCode && !passwordRecoveryMode && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-stone-900/10 bg-white px-3 py-1 text-xs font-medium text-[#8F703F]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C6A87C]" />
              <span>Joining household code</span>
              <span className="font-mono font-semibold text-[#1C1C1E]">{pendingInviteCode}</span>
            </div>
          )}
        </div>

        <Glass className="rounded-[20px] !bg-white/90 p-5 shadow-[0_8px_28px_rgba(28,28,30,0.06)]">
          {passwordRecoveryMode ? (
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[#1C1C1E]">Set new password</h2>
              <p className="text-xs text-[#52525B] mt-0.5">
                Choose a new password for your Keeper account
              </p>
            </div>
          ) : mode === "forgot" ? (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => handleModeChange("signin")}
                className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </button>
              <h2 className="text-base font-semibold text-[#1C1C1E]">Reset password</h2>
              <p className="text-xs text-[#52525B] mt-0.5">
                Enter your email to receive a password reset link
              </p>
            </div>
          ) : (
            <div className="mb-5 flex justify-center">
              <SegmentedControl
                className="keeper-segmented-2"
                value={mode}
                onValueChange={handleModeChange}
                items={[
                  { value: "signin", label: "Sign in" },
                  { value: "signup", label: "Create account" },
                ]}
              />
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
            {!passwordRecoveryMode && mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-[#52525B] mb-1">Full name</label>
                <SoftInput
                  type="text"
                  placeholder="Amani Juma"
                  value={fullName}
                  onValueChange={setFullName}
                  icon={<User className="h-4 w-4" />}
                  required
                />
              </div>
            )}

            {!passwordRecoveryMode && (
              <div>
                <label className="block text-xs font-medium text-[#52525B] mb-1">Email</label>
                <SoftInput
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onValueChange={setEmail}
                  icon={<Mail className="h-4 w-4" />}
                  required
                />
              </div>
            )}

            {(passwordRecoveryMode || mode !== "forgot") && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#52525B]">
                    {passwordRecoveryMode ? "New password" : "Password"}
                  </label>
                  {!passwordRecoveryMode && mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setLocalError(null);
                        setResetSent(false);
                      }}
                      className="text-xs font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <SoftInput
                    type={showPassword ? "text" : "password"}
                    placeholder={
                      passwordRecoveryMode || mode === "signup"
                        ? "Min. 6 characters"
                        : "Password"
                    }
                    minLength={6}
                    value={password}
                    onValueChange={(v) => {
                      setPassword(v);
                      if (localError) setLocalError(null);
                    }}
                    icon={<KeyRound className="h-4 w-4" />}
                    className="!pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#8E8E93] transition-colors hover:bg-stone-900/5 hover:text-[#1C1C1E] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {(passwordRecoveryMode || mode === "signup") && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium text-[#52525B]">
                    Confirm password
                  </label>
                  {passwordsMatch && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Check className="h-3 w-3" />
                      Matches
                    </span>
                  )}
                  {passwordsMismatch && (
                    <span className="text-xs font-medium text-rose-700">Does not match</span>
                  )}
                </div>
                <div className="relative">
                  <SoftInput
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repeat password"
                    minLength={6}
                    value={confirmPassword}
                    onValueChange={(v) => {
                      setConfirmPassword(v);
                      if (localError) setLocalError(null);
                    }}
                    icon={<KeyRound className="h-4 w-4" />}
                    className="!pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                    }
                    className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#8E8E93] transition-colors hover:bg-stone-900/5 hover:text-[#1C1C1E] cursor-pointer"
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
              <div className="flex items-start gap-2.5 rounded-xl border border-stone-900/[0.08] bg-[#F6F5F2] px-3 py-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={acceptedTerms}
                  aria-label="Agree to Terms of Service and Privacy Policy"
                  onClick={() => {
                    setAcceptedTerms((prev) => !prev);
                    if (localError) setLocalError(null);
                  }}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors cursor-pointer ${
                    acceptedTerms
                      ? "border-[#1C1C1E] bg-[#1C1C1E] text-white"
                      : "border-stone-300 bg-white text-transparent hover:border-stone-500"
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </button>
                <p className="text-xs leading-snug text-[#52525B]">
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setLegalDoc("terms")}
                    className="font-medium text-[#1C1C1E] underline underline-offset-2 hover:text-[#8F703F] cursor-pointer"
                  >
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={() => setLegalDoc("privacy")}
                    className="font-medium text-[#1C1C1E] underline underline-offset-2 hover:text-[#8F703F] cursor-pointer"
                  >
                    Privacy Policy
                  </button>
                </p>
              </div>
            )}

            {resetSent && mode === "forgot" && (
              <div className="rounded-xl border border-emerald-700/20 bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-800">
                Password reset link sent to <strong>{email}</strong>
              </div>
            )}

            {displayedError && (
              <div className="rounded-xl border border-rose-700/20 bg-rose-50/70 px-3 py-2 text-xs font-medium text-rose-700">
                {displayedError}
              </div>
            )}

            <SoftButton
              type="submit"
              variant="filled"
              disabled={submitting || (!passwordRecoveryMode && mode === "signup" && !acceptedTerms)}
              className="w-full !h-11 text-sm font-medium"
            >
              {submitting
                ? "Please wait..."
                : passwordRecoveryMode
                  ? "Update password"
                  : mode === "forgot"
                    ? "Send reset link"
                    : mode === "signin"
                      ? "Sign in"
                      : "Create account"}
            </SoftButton>
          </form>

          {/* Continue with Google OAuth */}
          {!passwordRecoveryMode && mode !== "forgot" && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-stone-900/[0.08]" />
                <span className="text-xs text-[#8E8E93]">or</span>
                <div className="h-px flex-1 bg-stone-900/[0.08]" />
              </div>

              <SoftButton
                type="button"
                onClick={() => void handleGoogleAuth()}
                disabled={googleSubmitting || submitting}
                icon={<GoogleMark />}
                className="w-full !h-10 text-xs font-medium"
              >
                {googleSubmitting
                  ? "Connecting to Google..."
                  : mode === "signup"
                    ? "Sign up with Google"
                    : "Sign in with Google"}
              </SoftButton>
            </>
          )}

          {/* Auto-hide Demo Mode once real Supabase credentials are configured */}
          {!isSupabaseReady && !passwordRecoveryMode && mode !== "forgot" && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={onEnterDemo}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525B] hover:text-[#1C1C1E] transition-colors cursor-pointer"
              >
                <span>Preview demo household</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </Glass>
      </div>

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}

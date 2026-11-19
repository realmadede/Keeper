import { useState, type FormEvent } from "react";
import { Button, Glass, Input, SegmentedControl } from "glisse";
import { Check, Eye, EyeOff, KeyRound, Mail, Sparkles, User } from "lucide-react";
import { KeeperLogo } from "./KeeperLogo";

interface AuthScreenProps {
  error: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (fullName: string, email: string, password: string) => Promise<void>;
  onEnterDemo: () => void;
}

export function AuthScreen({
  error,
  onSignIn,
  onSignUp,
  onEnterDemo,
}: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  const handleModeChange = (next: string) => {
    setMode(next as "signin" | "signup");
    setLocalError(null);
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (mode === "signup" && password !== confirmPassword) {
      setLocalError("Passwords do not match. Please type your chosen password again.");
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
          <KeeperLogo size={60} className="mx-auto mb-3 drop-shadow-[0_8px_20px_rgba(15,23,42,0.18)]" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Keeper</h1>
          <p className="mt-1 text-xs text-slate-500">
            One household, one shared budget, complete transparency.
          </p>
        </div>

        <Glass className="rounded-[28px] !bg-white/85 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
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

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
            {mode === "signup" && (
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

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    mode === "signup"
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
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {mode === "signup" && (
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
                    <span className="text-[11px] font-medium text-rose-500">
                      Does not match
                    </span>
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
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
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

            {displayedError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {displayedError}
              </div>
            )}

            <Button
              type="submit"
              variant="filled"
              disabled={submitting}
              className="w-full justify-center !h-11 text-sm font-semibold"
            >
              {submitting
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign In to Household"
                  : "Create Keeper Account"}
            </Button>
          </form>

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
        </Glass>
      </div>
    </div>
  );
}

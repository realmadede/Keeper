import { useState, type FormEvent } from "react";
import { Button, Glass, Input, SegmentedControl } from "glisse";
import { KeyRound, Mail, Sparkles, User } from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
              onValueChange={(v) => setMode(v as "signin" | "signup")}
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
              <Input
                type="password"
                placeholder="At least 6 characters"
                minLength={6}
                value={password}
                onValueChange={setPassword}
                icon={<KeyRound className="h-4 w-4 text-slate-400" />}
                className="w-full"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {error}
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

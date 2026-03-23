import { useState, type FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

export const AuthForm = () => {
  const { login, register, loginWithGoogle } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isRegisterMode) {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
        {isRegisterMode ? "Create account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Sign in to manage your RSS feeds.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <input
          type="email"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          disabled={submitting}
        >
          {submitting
            ? "Please wait..."
            : isRegisterMode
              ? "Register"
              : "Login"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => void loginWithGoogle()}
        className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => setIsRegisterMode((prev) => !prev)}
        className="mt-4 text-sm text-brand-700 dark:text-brand-100"
      >
        {isRegisterMode
          ? "Already have an account? Login"
          : "No account yet? Register"}
      </button>
    </div>
  );
};

import { AuthForm } from "../components/AuthForm";

export const AuthPage = () => {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <AuthForm />
    </main>
  );
};

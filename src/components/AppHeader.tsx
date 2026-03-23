import { LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

export const AppHeader = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:px-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">RSS Reader</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <button
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
          onClick={() => void logout()}
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </header>
  );
};

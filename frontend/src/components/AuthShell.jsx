import { Link } from "react-router-dom";

export function AuthShell({ title, subtitle, children, footerText, footerLinkText, footerTo }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,1)_54%,rgba(15,23,42,0.96))]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

      <section className="relative w-full max-w-[28rem]">
        <div className="mb-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">DevChat AI</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-white sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-300">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-xl sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-3 text-xs text-slate-300">
            <div className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2">
              <span className="font-medium text-white">Developer chats</span>
              <p className="mt-1 text-slate-400">Talk in real time</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2">
              <span className="font-medium text-white">@ai support</span>
              <p className="mt-1 text-slate-400">Ask inside threads</p>
            </div>
          </div>

          {children}

          <p className="mt-6 text-center text-sm text-slate-400">
            {footerText}{" "}
            <Link className="font-medium text-cyan-200 transition hover:text-white hover:underline" to={footerTo}>
              {footerLinkText}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export function AuthInput({
  autoComplete,
  error,
  icon,
  id,
  label,
  name,
  onBlur,
  onChange,
  placeholder,
  type = "text",
  value,
}) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-200" htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-slate-500">
          {icon}
        </span>
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className={`min-h-11 w-full rounded-lg border bg-slate-950/50 py-2 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:bg-slate-950/70 focus:ring-4 focus:ring-cyan-300/10 ${
            error ? "border-rose-300/50" : "border-white/10 hover:border-white/20"
          }`}
          id={id}
          name={name}
          onBlur={onBlur}
          onChange={onChange}
          placeholder={placeholder}
          required
          type={type}
          value={value}
        />
      </div>
      {error && (
        <p className="mt-2 text-sm leading-5 text-rose-200" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, disabled, isLoading }) {
  return (
    <button
      className="mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-200 active:scale-[0.99] active:bg-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300 disabled:shadow-none"
      disabled={disabled}
      type="submit"
    >
      {isLoading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-white" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}

export function AlertMessage({ children }) {
  if (!children) return null;

  return (
    <p className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-sm leading-5 text-rose-100">
      {children}
    </p>
  );
}

export function UserIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="m4 6 8 7 8-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M4 6h16v12H4V6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M6 11h12v9H6v-9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { ThemeToggle } from "./ThemeToggle";
import { Button, Card, FieldError, Input, Label, PageHeader, WorkspaceLogo } from "./ui";
import "./workspace-auth.css";

export function AuthIcon({ name = "book", className = "h-5 w-5" }: { name?: "book" | "arrow" | "check" | "eye" | "key" | "mail"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {name === "book" && <><path d="M3 4.5c3-1 6-1 9 1v15c-3-2-6-2-9-1v-15Z" /><path d="M12 5.5c3-2 6-2 9-1v15c-3-1-6-1-9 1v-15Z" /></>}
      {name === "arrow" && <path d="M20 12H4m7-7-7 7 7 7" />}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "eye" && <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
      {name === "key" && <><circle cx="8" cy="8" r="5" /><path d="m12 12 9 9m-3-3 3-3m-6 0 3-3" /></>}
      {name === "mail" && <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>}
    </svg>
  );
}

export function WorkspaceAuth({
  title, subtitle, eyebrow, panelTitle, tips, children, teacher = false,
}: {
  title: string;
  subtitle: string;
  eyebrow: string;
  panelTitle: string;
  tips: string[];
  children: ReactNode;
  teacher?: boolean;
}) {
  const { workspace, publicProfile } = useSession();
  const teacherName = publicProfile?.teacher_name || workspace?.name || "معلّمك";
  const content = (
    <div className="workspace-auth mx-auto w-full max-w-5xl">
      <Link to="/" className="mb-7 inline-flex items-center gap-2 text-xs font-medium text-ink-muted hover:text-accent">
        <AuthIcon name="arrow" className="h-4 w-4 rotate-180" /> العودة إلى مساحة المعلّم
      </Link>
      <div className="grid items-start gap-8 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <span className="mb-4 inline-flex items-center gap-2 rounded-pill border border-accent/15 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent">
            <AuthIcon name={teacher ? "key" : "book"} className="h-3.5 w-3.5" />{eyebrow}
          </span>
          <div className="[&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:leading-relaxed sm:[&_h1]:text-4xl [&_p]:leading-relaxed">
            <PageHeader title={title} subtitle={subtitle} />
          </div>
          <Card className="workspace-auth-card">
            {children}
          </Card>
          <p className="mt-5 text-center text-xs leading-relaxed text-ink-muted">حسابك مرتبط بهذه المساحة فقط · {workspace?.name ?? teacherName}</p>
        </div>
        <aside className="workspace-auth-panel relative min-w-0 overflow-hidden rounded-panel bg-panel p-6 text-panel-fg sm:p-8 lg:col-span-2 lg:sticky lg:top-6" aria-label="إرشادات الوصول إلى المساحة">
          <AuthIcon className="pointer-events-none absolute -top-5 end-1 h-36 w-36 -rotate-12 text-panel-fg/10" />
          <span className="relative mb-5 inline-flex h-12 w-12 items-center justify-center rounded-card border border-panel-fg/20 bg-panel-fg/5"><AuthIcon name={teacher ? "key" : "book"} className="h-6 w-6" /></span>
          <p role="heading" aria-level={2} className="relative text-2xl font-extrabold leading-relaxed">{panelTitle}</p>
          <div className="relative mt-6 flex items-center gap-3 rounded-card border border-panel-fg/15 bg-panel-fg/5 p-4">
            <WorkspaceLogo src={workspace?.logo ?? null} name={teacherName} size={44} />
            <div className="min-w-0"><p className="font-semibold">{teacherName}</p><p className="mt-1 text-xs text-panel-fg/65">{teacher ? "إدارة مساحة التعلّم" : "مساحة تعلّم مستقلة على وجهة"}</p></div>
          </div>
          <ul className="relative mt-6 space-y-4 border-t border-panel-fg/15 pt-6 text-sm leading-relaxed text-panel-fg/80">
            {tips.map((tip) => <li key={tip} className="flex items-start gap-3"><AuthIcon name="check" className="mt-1 h-4 w-4 shrink-0" /><span>{tip}</span></li>)}
          </ul>
          <p className="relative mt-7 text-xs leading-relaxed text-panel-fg/60">{teacher ? "مسار خاص بالمعلّم. لا تحتاج حساب طالب لإدارة مساحتك." : "تعلّم مع معلّمك، بخطوات واضحة وفي مساحته الخاصة."}</p>
        </aside>
      </div>
    </div>
  );
  if (!teacher) return content;
  return (
    <div className="flex min-h-screen flex-col bg-landing text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link to="/" className="min-w-0 text-base font-bold">{workspace?.name ?? "مساحة المعلّم"}</Link>
          <ThemeToggle compact />
        </div>
      </header>
      <main className="mx-auto w-full flex-1 px-6 py-10 sm:py-12">{content}</main>
      <footer className="border-t border-line py-6 text-center text-xs text-ink-muted">وجهة · مساحة المعلّم الخاصة</footer>
    </div>
  );
}

export function AuthPasswordField({
  id, label, value, onChange, visible, onToggle, errors, autoComplete = "new-password", hint,
}: {
  id: string; label: string; value: string; onChange: (value: string) => void;
  visible: boolean; onToggle?: () => void; errors?: string[];
  autoComplete?: "current-password" | "new-password"; hint?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {onToggle && <Button type="button" variant="ghost" size="sm" onClick={onToggle} aria-pressed={visible} aria-controls={id} aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}><AuthIcon name="eye" className="h-4 w-4" />{visible ? "إخفاء" : "إظهار"}</Button>}
      </div>
      <Input id={id} name={id} autoComplete={autoComplete} dir="ltr" type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} required className="h-12 text-start" invalid={Boolean(errors?.length)} aria-invalid={Boolean(errors?.length)} aria-describedby={`${id}-error${hint ? ` ${id}-hint` : ""}`} />
      {hint && <p id={`${id}-hint`} className="mt-2 text-xs leading-relaxed text-ink-muted">{hint}</p>}
      <div id={`${id}-error`}><FieldError messages={errors} /></div>
    </div>
  );
}

export function AuthSuccess({ title, children, kind = "check" }: { title: string; children: ReactNode; kind?: "check" | "mail" }) {
  return (
    <div className="text-center">
      <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent"><AuthIcon name={kind} className="h-8 w-8" /></span>
      <p role="heading" aria-level={2} className="text-xl font-extrabold leading-relaxed text-ink">{title}</p>
      <div className="mt-4 space-y-5 text-sm leading-relaxed text-ink-secondary">{children}</div>
    </div>
  );
}

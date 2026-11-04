import { useState } from "react";
import { Link } from "react-router-dom";

import { registerStudent } from "../../api/studentAuth";
import { Alert, Button, Card, FieldError, Input, Label, PageHeader, Spinner, WorkspaceLogo } from "../../components/ui";
import { useSession } from "../../context/SessionContext";
import { useApiErrorText } from "../../lib/apiErrorText";
import { ApiError } from "../../lib/apiClient";
import { mainSiteUrl } from "../../lib/slug";
import "./student-signup.css";

function SignupIcon({ name, className = "h-5 w-5" }: { name: "book" | "check" | "arrow" | "eye" | "clock" | "chevron"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {name === "book" && <><path d="M3 4.5c3-1 6-1 9 1v15c-3-2-6-2-9-1v-15Z" /><path d="M12 5.5c3-2 6-2 9-1v15c-3-1-6-1-9 1v-15Z" /></>}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "arrow" && <path d="M20 12H4m7-7-7 7 7 7" />}
      {name === "eye" && <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
      {name === "clock" && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
      {name === "chevron" && <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}

function SignupJourney({ pending = false }: { pending?: boolean }) {
  return (
    <ol aria-label="مراحل الانضمام" className="mb-8 grid grid-cols-3 gap-3">
      {["إنشاء الحساب", "مراجعة المعلّم", "بدء التعلّم"].map((step, index) => {
        const current = index === (pending ? 1 : 0);
        const completed = pending && index === 0;
        return (
          <li key={step} aria-current={current ? "step" : undefined} className={`flex flex-col items-center gap-2 border-b-2 pb-4 text-center text-xs ${current || completed ? "border-accent text-accent" : "border-line text-ink-muted"}`}>
            <span className={`grid h-8 w-8 place-items-center rounded-full font-bold ${current || completed ? "bg-accent-soft" : "bg-soft"}`}>
              {completed ? <SignupIcon name="check" className="h-4 w-4" /> : (index + 1).toLocaleString("ar")}
            </span>
            {step}
          </li>
        );
      })}
    </ol>
  );
}

/** Student registration inside the teacher's space — creates a pending account; no session is issued. */
export function SignupPage() {
  const { slug, workspace, publicProfile } = useSession();
  const teacherName = publicProfile?.teacher_name || workspace?.name || "معلّمك";
  const teacherProfileUrl = new URL(
    `${mainSiteUrl()}teachers/${encodeURIComponent(slug ?? "")}`,
    window.location.origin,
  ).href;
  const errorToText = useApiErrorText();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearFieldError(field: string) {
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setErrorText(null);
    setFieldErrors({});
    if (!slug) {
      setErrorText("اختر معلّمك أولًا قبل إنشاء الحساب.");
      return;
    }
    if (!fullName.trim()) {
      setFieldErrors({ full_name: ["اكتب اسمك الكامل."] });
      document.getElementById("signup-name")?.focus();
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors({ confirm_password: ["كلمتا المرور غير متطابقتين."] });
      document.getElementById("signup-password-confirm")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const response = await registerStudent(slug, { email: email.trim(), full_name: fullName.trim(), password, phone: phone.trim() || null });
      setSuccessMessage(response.message || "تم إرسال طلب انضمامك إلى المعلّم.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      const apiError = error as ApiError;
      setFieldErrors(apiError.fieldErrors ?? {});
      setErrorText(errorToText(apiError, "تعذّر إنشاء الحساب."));
    } finally {
      setSubmitting(false);
    }
  }

  if (!successMessage) {
    return (
      <div className="student-signup">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <Link to="/" className="hover:text-accent">مساحة {teacherName}</Link><span aria-hidden>/</span><span className="text-ink" aria-current="page">إنشاء حساب طالب</span>
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <SignupJourney />
          <div className="[&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:leading-relaxed sm:[&_h1]:text-4xl">
            <PageHeader title="خطوتك الأولى تبدأ هنا." subtitle={`أنشئ حسابك كطالب في مساحة ${teacherName}، وابدأ رحلتك بعد موافقة المعلّم.`} />
          </div>
          <Card className="signup-form-card">
          <div className="mb-6 flex items-center gap-3 border-b border-line pb-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-accent-soft text-accent"><SignupIcon name="book" /></span>
            <div><p role="heading" aria-level={2} className="font-bold text-ink">بيانات حسابك</p><p className="mt-1 text-xs text-ink-muted">جميع الحقول مطلوبة، ما عدا رقم الهاتف.</p></div>
          </div>
          {errorText && (
            <div className="mb-4">
              <Alert tone="error">{errorText}</Alert>
            </div>
          )}

          <form onSubmit={submit} aria-busy={submitting}>
            <fieldset disabled={submitting} className="min-w-0 space-y-5">
            <div>
              <Label htmlFor="signup-name">الاسم الكامل</Label>
              <Input
                id="signup-name"
                name="full_name"
                autoComplete="name"
                placeholder="الاسم الذي سيظهر لمعلّمك"
                className="h-12"
                value={fullName}
                onChange={(event) => { setFullName(event.target.value); clearFieldError("full_name"); }}
                required
                invalid={Boolean(fieldErrors.full_name)}
                aria-invalid={Boolean(fieldErrors.full_name)}
                aria-describedby={fieldErrors.full_name ? "signup-name-error" : undefined}
              />
              <span id="signup-name-error">
                <FieldError messages={fieldErrors.full_name} />
              </span>
            </div>
            <div>
              <Label htmlFor="signup-email">البريد الإلكتروني</Label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                className="h-12 text-start"
                dir="ltr"
                value={email}
                onChange={(event) => { setEmail(event.target.value); clearFieldError("email"); }}
                required
                invalid={Boolean(fieldErrors.email)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby="signup-email-hint signup-email-error"
              />
              <p id="signup-email-hint" className="mt-2 text-xs text-ink-muted">استخدم بريدًا يمكنك الوصول إليه وتذكّره عند الدخول.</p>
              <span id="signup-email-error">
                <FieldError messages={fieldErrors.email} />
              </span>
            </div>
            <div>
              <Label htmlFor="signup-phone">رقم الهاتف (اختياري)</Label>
              <Input
                id="signup-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="رقم هاتفك مع رمز الدولة"
                className="h-12 text-start"
                dir="ltr"
                value={phone}
                onChange={(event) => { setPhone(event.target.value); clearFieldError("phone"); }}
                invalid={Boolean(fieldErrors.phone)}
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? "signup-phone-error" : undefined}
              />
              <span id="signup-phone-error">
                <FieldError messages={fieldErrors.phone} />
              </span>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <Label htmlFor="signup-password">كلمة المرور</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} aria-pressed={showPassword} aria-controls="signup-password signup-password-confirm">
                  <SignupIcon name="eye" className="h-4 w-4" />{showPassword ? "إخفاء" : "إظهار"}
                </Button>
              </div>
                <Input
                  id="signup-password"
                  name="password"
                  autoComplete="new-password"
                  dir="ltr"
                  placeholder="اختر كلمة مرور لحسابك"
                  className="h-12 text-start"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); clearFieldError("password"); clearFieldError("confirm_password"); }}
                  required
                  invalid={Boolean(fieldErrors.password)}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby="signup-password-hint signup-password-error"
                />
              <div id="signup-password-hint" className="mt-3 rounded-control bg-soft p-3 text-xs text-ink-secondary">
                <p className="mb-2">نصائح لاختيار كلمة مرور — إرشادات وليست شروطًا إضافية:</p>
                <ul className="space-y-1.5">
                  <li className={`flex items-center gap-2 ${password.length >= 8 ? "text-accent" : ""}`}><SignupIcon name="check" className="h-3.5 w-3.5 shrink-0" /> يُفضّل استخدام ٨ أحرف أو أكثر</li>
                  <li className={`flex items-center gap-2 ${/\p{L}/u.test(password) && /\p{N}/u.test(password) ? "text-accent" : ""}`}><SignupIcon name="check" className="h-3.5 w-3.5 shrink-0" /> امزج الحروف والأرقام وتجنّب المعلومات الشخصية</li>
                </ul>
              </div>
              <span id="signup-password-error">
                <FieldError messages={fieldErrors.password} />
              </span>
            </div>
            <div>
              <Label htmlFor="signup-password-confirm">تأكيد كلمة المرور</Label>
              <Input id="signup-password-confirm" name="confirm_password" autoComplete="new-password" dir="ltr" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); clearFieldError("confirm_password"); }} required className="h-12 text-start" placeholder="أعد كتابة كلمة المرور" invalid={Boolean(fieldErrors.confirm_password)} aria-invalid={Boolean(fieldErrors.confirm_password)} aria-describedby="signup-confirm-error signup-confirm-status" />
              <span id="signup-confirm-error"><FieldError messages={fieldErrors.confirm_password} /></span>
              <p id="signup-confirm-status" className="mt-2 text-xs text-accent" aria-live="polite">{confirmPassword && password === confirmPassword ? "كلمتا المرور متطابقتان." : ""}</p>
            </div>
            <p className="rounded-card border border-line p-3 text-xs leading-relaxed text-ink-secondary">هذا الحساب خاص بمساحة {teacherName}. إنشاء الحساب لا يعني الاشتراك تلقائيًا في جميع الدورات.</p>
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? <><Spinner className="h-4 w-4" />جارٍ إرسال طلبك...</> : <>إنشاء الحساب وإرسال الطلب<SignupIcon name="arrow" /></>}
            </Button>
            </fieldset>
          </form>
        </Card>

        <p className="mt-4 text-center text-sm text-ink-secondary">
          لديك حساب مقبول بالفعل؟{" "}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            تسجيل الدخول
          </Link>
        </p>
        </div>

        <aside className="min-w-0 space-y-5 lg:col-span-2 lg:sticky lg:top-6" aria-label="مساحة المعلّم وتفاصيل الانضمام">
          <div className="relative overflow-hidden rounded-panel bg-panel p-6 text-panel-fg sm:p-8">
            <SignupIcon name="book" className="pointer-events-none absolute -top-4 end-2 h-32 w-32 -rotate-12 opacity-10" />
            <p className="relative text-xs font-medium text-panel-fg/70">أنت على بُعد خطوة من وجهتك</p>
            <p role="heading" aria-level={2} className="relative mt-4 text-2xl font-extrabold leading-relaxed">تعلّم مع معلّمك،<br />في مساحته الخاصة.</p>
            <div className="relative mt-6 flex items-center gap-3 rounded-card border border-panel-fg/15 bg-panel-fg/5 p-4">
              <WorkspaceLogo src={workspace?.logo ?? null} name={teacherName} size={48} />
              <div className="min-w-0"><p className="text-xs text-panel-fg/65">طلب الانضمام إلى</p><p className="mt-1 font-bold">{teacherName}</p><p className="mt-1 text-xs text-panel-fg/65">{workspace?.name}</p></div>
            </div>
            {publicProfile?.headline && <p className="relative mt-4 text-sm leading-relaxed text-panel-fg/75">{publicProfile.headline}</p>}
            <ul className="relative mt-7 space-y-4 border-t border-panel-fg/15 pt-6 text-sm text-panel-fg/85">
              {["حساب مستقل داخل مساحة معلّمك", "الدخول متاح بعد قبول طلبك", "اختيار الدورات بعد الانضمام"].map((item) => <li key={item} className="flex items-center gap-3"><SignupIcon name="check" className="h-4 w-4 shrink-0" />{item}</li>)}
            </ul>
            <Link reloadDocument to={teacherProfileUrl} className="relative mt-6 inline-flex items-center gap-2 text-xs font-semibold text-panel-fg underline underline-offset-4">تعرّف على ملف المعلّم<SignupIcon name="arrow" className="h-4 w-4" /></Link>
          </div>
          <Card>
            <p role="heading" aria-level={2} className="flex items-center gap-2 text-sm font-bold text-ink"><SignupIcon name="clock" className="text-accent h-5 w-5" />ماذا يحدث بعد التسجيل؟</p>
            <ol className="mt-4 space-y-4 text-xs leading-relaxed text-ink-secondary">
              <li className="flex gap-3"><span className="font-bold text-accent">٠١</span>يصل طلب انضمامك إلى المعلّم للمراجعة.</li>
              <li className="flex gap-3"><span className="font-bold text-accent">٠٢</span>بعد الموافقة، يمكنك الدخول إلى هذه المساحة.</li>
              <li className="flex gap-3"><span className="font-bold text-accent">٠٣</span>تختار الدورات المناسبة لك وتبدأ التعلّم.</li>
            </ol>
          </Card>
          <Card>
            <p role="heading" aria-level={2} className="mb-1 text-sm font-bold text-ink">قبل إرسال طلبك</p>
            {[
              { q: "هل يمكنني التسجيل مع معلّم آخر؟", a: "نعم. لكل معلّم مساحة مستقلة، ويكون تسجيلك وطلب موافقتك خاصّين بكل مساحة." },
              { q: "هل يجب إضافة رقم الهاتف؟", a: "رقم الهاتف اختياري. الاسم والبريد الإلكتروني وكلمة المرور مطلوبة لإنشاء الحساب." },
            ].map((faq) => (
              <details key={faq.q} className="signup-disclosure border-b border-line py-4 last:border-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-ink">{faq.q}<SignupIcon name="chevron" className="h-4 w-4 shrink-0 text-ink-muted" /></summary>
                <p className="mt-3 text-xs leading-relaxed text-ink-secondary">{faq.a}</p>
              </details>
            ))}
          </Card>
        </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="student-signup mx-auto max-w-2xl">
      <SignupJourney pending />
      <Card className="text-center">
        <span className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent"><SignupIcon name="clock" className="h-8 w-8" /></span>
        <div className="[&_h1]:text-2xl [&_h1]:font-extrabold"><PageHeader title="وصل طلبك. والخطوة القادمة مع معلّمك." subtitle={`بانتظار موافقة ${teacherName} على انضمامك إلى مساحته.`} /></div>
        <Alert tone="success">{successMessage}</Alert>
        <p className="mt-2 text-sm leading-[1.8] text-ink-secondary">
          لم يبدأ تسجيل الدخول تلقائيًا. يمكنك الدخول بعد قبول المعلّم لحسابك.
        </p>
        <div className="mt-5 rounded-card bg-soft p-4 text-sm text-ink-secondary"><p>البريد المسجّل</p><p dir="ltr" className="mt-1 break-all font-semibold text-ink">{email.trim()}</p></div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="rounded-control bg-accent px-5 py-3 text-sm font-semibold text-accent-contrast hover:opacity-90">العودة إلى مساحة المعلّم</Link>
          <Link to="/login" className="rounded-control border border-line px-5 py-3 text-sm font-semibold text-accent hover:bg-soft">تسجيل الدخول بعد الموافقة</Link>
        </div>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { setStaffPassword, startStaffPasswordReset } from "../../api/staffAuth";
import { Alert, Button, Input, Label, Spinner } from "../../components/ui";
import { AuthIcon, AuthPasswordField, AuthSuccess, WorkspaceAuth } from "../../components/WorkspaceAuth";
import { useSession } from "../../context/SessionContext";
import { useApiErrorText } from "../../lib/apiErrorText";
import { ApiError } from "../../lib/apiClient";

/**
 * Destination of the invitation / staff password-reset email. The link opens
 * /teacher/set-password/?uid=<uid>&token=<token>; both are submitted to the
 * staff set-password endpoint with the chosen new password.
 *
 * Without uid/token in the URL the page becomes the "forgot password" entry
 * point: it sends POST /staff/auth/password-reset/ for a typed email. The
 * answer is always generic, so it does not reveal whether the email exists.
 */
export function TeacherSetPasswordPage() {
  const { slug } = useSession();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");
  const errorToText = useApiErrorText();

  const missingLink = !uid || !token;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [errorText, setErrorText] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || passwordsMismatch) return;
    setSubmitting(true);
    setErrorText(null);
    setFieldErrors({});
    try {
      await setStaffPassword(slug ?? "", uid as string, token as string, newPassword);
      setDone(true);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      const apiError = error as ApiError;
      setFieldErrors(apiError.fieldErrors ?? {});
      setErrorText(errorToText(apiError, "رابط كلمة المرور غير صالح أو منتهي."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WorkspaceAuth teacher
      title={missingLink ? "استعد الوصول إلى مساحتك." : "جهّز مفتاح مساحتك."}
      subtitle={missingLink ? "أدخل البريد الخاص بحساب المعلّم لطلب رابط تعيين كلمة المرور." : "عيّن كلمة المرور الخاصة بحساب المعلّم، ثم ادخل لإدارة مساحتك."}
      eyebrow={missingLink ? "استعادة حساب المعلّم" : "تعيين كلمة مرور المعلّم"}
      panelTitle="مساحتك التعليمية، تحت إدارتك."
      tips={missingLink ? ["استخدم البريد الذي استلمت عليه دعوة المعلّم.", "تصل الخطوة التالية إلى البريد إذا كان مرتبطًا بالحساب.", "لا تستخدم نموذج استعادة الطلاب لحساب المعلّم."] : ["هذا الرابط مخصّص لحساب المعلّم في هذه المساحة.", "اختر كلمة مرور طويلة ومختلفة عن حساباتك الأخرى.", "لن يبدأ تسجيل الدخول تلقائيًا بعد حفظ كلمة المرور."]}
    >
          {done && (
            <AuthSuccess title="كلمة مرورك جاهزة.">
              <Alert tone="success">تم تعيين كلمة المرور بنجاح.</Alert>
              <p>استخدم كلمة المرور الجديدة للدخول إلى لوحة إدارة مساحتك.</p>
              <Link to="/teacher/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-accent px-5 py-3 font-semibold text-accent-contrast">الانتقال إلى دخول المعلّم<AuthIcon name="arrow" /></Link>
            </AuthSuccess>
          )}

          {!done && missingLink && <RequestResetForm slug={slug ?? ""} />}

          {!done && !missingLink && (
            <>
              {errorText && (
                <div className="mb-4">
                  <Alert tone="error">{errorText}</Alert>
                </div>
              )}

              <form onSubmit={submit} aria-busy={submitting}>
                <fieldset disabled={submitting} className="min-w-0 space-y-5">
                <AuthPasswordField id="set-new-password" label="كلمة المرور الجديدة" value={newPassword} onChange={setNewPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} errors={fieldErrors.new_password} hint="اختر كلمة مرور لا يسهل توقّعها، ولا تشاركها مع أي شخص." />
                <AuthPasswordField id="set-confirm-password" label="تأكيد كلمة المرور" value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} errors={passwordsMismatch ? ["كلمتا المرور غير متطابقتين."] : undefined} />
                {confirmPassword && !passwordsMismatch && <p className="text-xs text-accent" role="status">كلمتا المرور متطابقتان.</p>}
                <Button type="submit" size="lg" className="w-full" disabled={submitting || passwordsMismatch}>
                  {submitting ? <><Spinner className="h-4 w-4" />جارٍ الحفظ...</> : <>حفظ كلمة المرور<AuthIcon name="arrow" /></>}
                </Button>
                </fieldset>
              </form>
            </>
          )}
        {!done && !missingLink && <Link to="/teacher/set-password" className="mt-6 inline-block text-xs font-semibold text-accent hover:underline">رابط غير صالح أو منتهي؟ اطلب رابطًا جديدًا</Link>}
    </WorkspaceAuth>
  );
}

/* ---------- Forgot-password entry point (page opened without uid/token) ---------- */

function RequestResetForm({ slug }: { slug: string }) {
  const errorToText = useApiErrorText();
  const [email, setEmail] = useState("");
  const [sentDetail, setSentDetail] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorText(null);
    try {
      const response = await startStaffPasswordReset(slug, email);
      setSentDetail(response.detail);
    } catch (error) {
      setErrorText(errorToText(error as ApiError, "تعذّر إرسال طلب الاستعادة."));
    } finally {
      setSubmitting(false);
    }
  }

  if (sentDetail !== null) {
    return (
      <AuthSuccess kind="mail" title="تحقّق من بريد حساب المعلّم.">
        <Alert tone="success">{sentDetail}</Alert>
        <p>إذا كان البريد مرتبطًا بحساب معلّم، فستصلك رسالة بالخطوة التالية. راجع أيضًا الرسائل غير المرغوب فيها.</p>
        <Button variant="secondary" onClick={() => setSentDetail(null)}>إعادة الطلب أو تعديل البريد</Button>
        <p><Link to="/teacher/login" className="font-semibold text-accent hover:underline">العودة إلى دخول المعلّم</Link></p>
      </AuthSuccess>
    );
  }

  return (
    <>
      {errorText && (
        <div className="mb-4">
          <Alert tone="error">{errorText}</Alert>
        </div>
      )}

      <p className="text-sm leading-[1.8] text-ink-secondary">
        إذا كان بريدك مسجّلًا كمعلّم في هذه المساحة، سنرسل إليه رابطًا لتعيين كلمة مرور جديدة.
      </p>

      <form className="mt-5" onSubmit={submit} aria-busy={submitting}>
        <fieldset disabled={submitting} className="min-w-0 space-y-5">
        <div>
          <Label htmlFor="reset-email">البريد الإلكتروني</Label>
          <Input
            id="reset-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="name@example.com"
            className="h-12 text-start"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? <><Spinner className="h-4 w-4" />جارٍ الإرسال...</> : <>إرسال رابط الاستعادة<AuthIcon name="arrow" /></>}
        </Button>
        </fieldset>
      </form>

      <p className="mt-4 text-center text-sm text-ink-secondary">
        <Link to="/teacher/login" className="font-semibold text-accent hover:underline">
          العودة إلى صفحة دخول المعلّمين
        </Link>
      </p>
    </>
  );
}

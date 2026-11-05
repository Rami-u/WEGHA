import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { confirmStudentPasswordReset, startStudentPasswordReset } from "../../api/studentAuth";
import { Alert, Button, Input, Label, Spinner } from "../../components/ui";
import { AuthIcon, AuthPasswordField, AuthSuccess, WorkspaceAuth } from "../../components/WorkspaceAuth";
import { useSession } from "../../context/SessionContext";
import { useApiErrorText } from "../../lib/apiErrorText";
import { ApiError } from "../../lib/apiClient";

/**
 * Password reset for students — one route handles both steps:
 *  - without uid/token in the URL: ask for the email and send the link
 *  - with uid/token (the emailed link points here): set the new password
 */
export function ResetPasswordPage() {
  const { slug } = useSession();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const hasToken = Boolean(uid && token);
  const errorToText = useApiErrorText();

  const [email, setEmail] = useState("");
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [errorText, setErrorText] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const passwordsMismatch = useMemo(
    () => confirmPassword.length > 0 && newPassword !== confirmPassword,
    [newPassword, confirmPassword],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || (hasToken && passwordsMismatch)) return;
    setSubmitting(true);
    setErrorText(null);
    setFieldErrors({});
    try {
      if (hasToken) {
        await confirmStudentPasswordReset(slug ?? "", uid as string, token as string, newPassword);
        setDone(true);
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const response = await startStudentPasswordReset(slug ?? "", email);
        setSentMessage(response.detail);
      }
    } catch (error) {
      const apiError = error as ApiError;
      setFieldErrors(apiError.fieldErrors ?? {});
      setErrorText(errorToText(apiError, "رابط كلمة المرور غير صالح أو منتهي."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WorkspaceAuth
      title={hasToken ? "كلمة مرور جديدة، وبداية متجدّدة." : "لنعد إلى رحلتك."}
      subtitle={hasToken ? "اختر كلمة مرور جديدة لحساب الطالب في هذه المساحة، ثم أكّدها للحفظ." : "أدخل بريد حسابك في هذه المساحة لطلب رابط استعادة كلمة المرور."}
      eyebrow={hasToken ? "تعيين كلمة مرور الطالب" : "استعادة وصول الطالب"}
      panelTitle={hasToken ? "خطوة أخيرة، ثم تتابع تعلّمك." : "نسيت كلمة المرور؟ وجهتك ما زالت هنا."}
      tips={hasToken ? ["استخدم كلمة مرور مختلفة عن كلمات مرور حساباتك الأخرى.", "أكّد كلمة المرور نفسها قبل الحفظ.", "ستدخل لاحقًا بكلمة المرور الجديدة، دون بدء جلسة تلقائيًا."] : ["استخدم البريد الذي سجّلت به مع هذا المعلّم.", "راجع البريد الوارد ومجلد الرسائل غير المرغوب فيها.", "رابط الاستعادة خاص بحسابك داخل هذه المساحة."]}
    >
        {!hasToken && sentMessage !== null ? (
          <AuthSuccess kind="mail" title="تحقّق من بريدك الإلكتروني.">
            <Alert tone="success">{sentMessage}</Alert>
            <p>إذا كان البريد مرتبطًا بحساب في هذه المساحة، فستصلك رسالة بالخطوة التالية. لا يؤكّد هذا الإشعار وجود حساب.</p>
            <p className="rounded-card bg-soft p-3 text-xs">لم تجد الرسالة؟ راجع مجلد الرسائل غير المرغوب فيها، أو تأكّد من كتابة البريد الصحيح.</p>
            <Button variant="secondary" onClick={() => setSentMessage(null)}>المحاولة ببريد آخر أو إعادة الطلب</Button>
          </AuthSuccess>
        ) : hasToken && done ? (
          <AuthSuccess title="تم تحديث كلمة المرور.">
            <Alert tone="success">تم تعيين كلمة المرور بنجاح.</Alert>
            <p>يمكنك الآن استخدام كلمة المرور الجديدة للدخول إلى مساحة معلّمك.</p>
            <Link to="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-accent px-5 py-3 font-semibold text-accent-contrast">الدخول إلى حسابي<AuthIcon name="arrow" /></Link>
          </AuthSuccess>
        ) : (
          <>
            {errorText && (
              <div className="mb-4">
                <Alert tone="error">{errorText}</Alert>
              </div>
            )}

            <form onSubmit={submit} aria-busy={submitting}>
              <fieldset disabled={submitting} className="min-w-0 space-y-5">
              {!hasToken && (
                <div>
                  <Label htmlFor="reset-email">البريد الإلكتروني</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    className="h-12 text-start"
                    placeholder="name@example.com"
                    dir="ltr"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    aria-describedby="reset-email-hint"
                  />
                  <p id="reset-email-hint" className="mt-2 text-xs leading-relaxed text-ink-muted">لن نعرض ما إذا كان البريد مسجّلًا، حفاظًا على خصوصية الحسابات.</p>
                </div>
              )}
              {hasToken && (
                <>
                  <AuthPasswordField id="reset-password" label="كلمة المرور الجديدة" value={newPassword} onChange={setNewPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} errors={fieldErrors.new_password} hint="اختر كلمة مرور طويلة لا تستخدمها في مكان آخر، وتجنّب معلوماتك الشخصية." />
                  <AuthPasswordField id="reset-confirm" label="تأكيد كلمة المرور" value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} errors={passwordsMismatch ? ["كلمتا المرور غير متطابقتين."] : undefined} />
                  {confirmPassword && !passwordsMismatch && <p className="text-xs text-accent" role="status">كلمتا المرور متطابقتان.</p>}
                </>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={submitting || passwordsMismatch}>
                {submitting ? <><Spinner className="h-4 w-4" />جارٍ العمل...</> : <>{hasToken ? "حفظ كلمة المرور الجديدة" : "إرسال رابط الاستعادة"}<AuthIcon name="arrow" /></>}
              </Button>
              </fieldset>
            </form>
          </>
        )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs">
        <Link to="/login" className="font-semibold text-accent hover:underline">العودة إلى تسجيل الدخول</Link>
        {hasToken && !done && <Link to="/reset-password" className="font-semibold text-accent hover:underline">رابط منتهي؟ اطلب رابطًا جديدًا</Link>}
      </div>
    </WorkspaceAuth>
  );
}

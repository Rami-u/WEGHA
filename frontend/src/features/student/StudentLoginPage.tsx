import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { loginStudent } from "../../api/studentAuth";
import { Alert, Button, Input, Label, Spinner } from "../../components/ui";
import { AuthIcon, AuthPasswordField, WorkspaceAuth } from "../../components/WorkspaceAuth";
import { useSession } from "../../context/SessionContext";
import { useApiErrorText } from "../../lib/apiErrorText";
import { ApiError } from "../../lib/apiClient";
import type { LoginStateError } from "../../types/api";

/**
 * Student login inside the teacher's space. Three account states are visible:
 * success (session starts), pending (approval message), and rejected (shows
 * the teacher's saved reason). The backend still decides everything.
 */
export function StudentLoginPage() {
  const { slug, setUser } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const errorToText = useApiErrorText();

  const from = (location.state as { from?: string } | null)?.from ?? "/courses";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [stateError, setStateError] = useState<LoginStateError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setCredentialsError(null);
    setStateError(null);
    try {
      const me = await loginStudent(slug ?? "", email, password);
      setUser(me);
      navigate(from, { replace: true });
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.body && (apiError.body.code === "pending_approval" || apiError.body.code === "account_rejected")) {
        setStateError(apiError.body as unknown as LoginStateError);
      } else {
        setCredentialsError(errorToText(apiError, "بيانات الدخول غير صحيحة."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WorkspaceAuth title="مرحبًا بعودتك." subtitle="ادخل إلى مساحة معلّمك، واستكمل رحلتك من حيث توقّفت." eyebrow="دخول الطلاب" panelTitle="مساحتك للتعلّم، ومكانك للانطلاق." tips={["استخدم الحساب الذي سجّلت به في هذه المساحة.", "يبدأ الدخول بعد موافقة المعلّم على طلبك.", "اختيار الدورات يتم داخل حسابك بعد القبول."]}>
        {stateError && (
          <div className="mb-4">
            <Alert tone={stateError.code === "account_rejected" ? "error" : "info"}>
              <p className="font-bold">{stateError.message}</p>
              {stateError.rejection_reason && <p className="mt-1 text-sm">سبب الرفض: {stateError.rejection_reason}</p>}
            </Alert>
          </div>
        )}

        {credentialsError && (
          <div className="mb-4">
            <Alert tone="error">{credentialsError}</Alert>
          </div>
        )}

        <form onSubmit={submit} aria-busy={submitting}>
          <fieldset disabled={submitting} className="min-w-0 space-y-5">
          <div>
            <Label htmlFor="login-email">البريد الإلكتروني</Label>
            <Input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="name@example.com"
              className="h-12 text-start"
              dir="ltr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              invalid={Boolean(credentialsError)}
              aria-invalid={Boolean(credentialsError)}
            />
          </div>
          <AuthPasswordField id="login-password" label="كلمة المرور" autoComplete="current-password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
          <div className="flex justify-end"><Link to="/reset-password" className="text-xs font-semibold text-accent hover:underline">نسيت كلمة المرور؟</Link></div>
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? <><Spinner className="h-4 w-4" />جارٍ الدخول...</> : <>الدخول إلى مساحتي<AuthIcon name="arrow" /></>}
          </Button>
          </fieldset>
        </form>
      <div className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-secondary">لم تنضم لهذه المساحة بعد؟ <Link to="/signup" className="font-semibold text-accent hover:underline">أنشئ حساب طالب</Link></div>
      <p className="mt-4 rounded-card bg-soft p-3 text-xs leading-relaxed text-ink-secondary">قدّمت طلبًا جديدًا؟ إذا كان قيد المراجعة، ستظهر حالته عند محاولة الدخول.</p>
    </WorkspaceAuth>
  );
}

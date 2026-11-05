import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { loginStaff } from "../../api/staffAuth";
import { getMe } from "../../api/studentAuth";
import { Alert, Button, Input, Label, Spinner } from "../../components/ui";
import { AuthIcon, AuthPasswordField, WorkspaceAuth } from "../../components/WorkspaceAuth";
import { useSession } from "../../context/SessionContext";
import { useApiErrorText } from "../../lib/apiErrorText";
import { ApiError } from "../../lib/apiClient";

/**
 * Private teacher sign-in at /teacher/login — not linked from student pages,
 * keep it out of navigation. Students (and any non-teacher) get the same
 * generic failure as a wrong password.
 */
export function TeacherLoginPage() {
  const { slug, user, setUser, refreshWorkspace } = useSession();
  const navigate = useNavigate();
  const errorToText = useApiErrorText();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorText(null);
    try {
      await loginStaff(slug ?? "", email, password);
      setUser(await getMe(slug ?? ""));
      void refreshWorkspace();
      navigate("/teacher/students", { replace: true });
    } catch (error) {
      setErrorText(errorToText(error as ApiError, "بيانات الدخول غير صحيحة."));
    } finally {
      setSubmitting(false);
    }
  }

  // Already signed in as the teacher of this space — go straight to the portal.
  if (user?.role === "teacher") {
    return <Navigate to="/teacher/students" replace />;
  }

  return (
    <WorkspaceAuth teacher title="مساحتك، بإدارتك." subtitle="سجّل الدخول بحساب المعلّم لإدارة طلابك ودوراتك في هذه المساحة." eyebrow="دخول المعلّم" panelTitle="كل ما يخصّ تعليمك، في مكان واحد." tips={["راجع طلبات انضمام الطلاب إلى مساحتك.", "نظّم دوراتك وتابع طلبات الدفع.", "حدّث معلومات المساحة وطريقة ظهورها."]}>
          {errorText && (
            <div className="mb-4">
              <Alert tone="error">{errorText}</Alert>
            </div>
          )}

          <form onSubmit={submit} aria-busy={submitting}>
            <fieldset disabled={submitting} className="min-w-0 space-y-5">
            <div>
              <Label htmlFor="staff-email">البريد الإلكتروني</Label>
              <Input
                id="staff-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="name@example.com"
                className="h-12 text-start"
                dir="ltr"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                invalid={Boolean(errorText)}
                aria-invalid={Boolean(errorText)}
              />
            </div>
            <AuthPasswordField id="staff-password" label="كلمة المرور" autoComplete="current-password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} />
            <Link to="/teacher/set-password" className="inline-block text-xs font-semibold text-accent hover:underline">نسيت كلمة المرور؟</Link>
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? <><Spinner className="h-4 w-4" />جارٍ الدخول...</> : <>الدخول إلى لوحة المعلّم<AuthIcon name="arrow" /></>}
            </Button>
            </fieldset>
          </form>
        <div className="mt-6 space-y-3 border-t border-line pt-5 text-xs leading-relaxed text-ink-secondary">
          <p className="font-semibold text-ink">هذه أول زيارة لك كمعلّم؟</p>
          <p>افتح رابط الدعوة المرسل إلى بريدك لتعيين كلمة المرور أولًا. لا يُنشأ حساب معلّم من نموذج تسجيل الطلاب.</p>
          <Link to="/login" className="inline-flex items-center gap-2 font-semibold text-accent hover:underline">أنا طالب، الانتقال إلى دخول الطلاب<AuthIcon name="arrow" className="h-4 w-4" /></Link>
        </div>
    </WorkspaceAuth>
  );
}

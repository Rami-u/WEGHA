import { useCallback, useEffect, useRef, useState } from "react";

import { getWorkspaceSettings, updateWorkspaceSettings } from "../../../api/workspace";
import { Alert, Button, Card, FieldError, FullPageSpinner, Input, Label, PageHeader, Spinner, Textarea, WorkspaceLogo } from "../../../components/ui";
import { useSession } from "../../../context/SessionContext";
import { useApiErrorText } from "../../../lib/apiErrorText";
import { ApiError } from "../../../lib/apiClient";
import type { WorkspaceSettings } from "../../../types/api";

type Draft = { name: string; headline: string; bio: string; about: string; payment_instructions: string; is_listed: boolean };
const toDraft = (settings: WorkspaceSettings): Draft => ({
  name: settings.name, headline: settings.headline ?? "", bio: settings.bio ?? "", about: settings.about ?? "",
  payment_instructions: settings.payment_instructions ?? "", is_listed: settings.is_listed,
});
const emptyDraft: Draft = { name: "", headline: "", bio: "", about: "", payment_instructions: "", is_listed: false };

function SettingsIcon({ name }: { name: "identity" | "eye" | "receipt" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden>
      {name === "identity" && <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="10" r="2" /><path d="M5 16c0-3 6-3 6 0M14 9h4M14 13h4" /></>}
      {name === "eye" && <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
      {name === "receipt" && <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>}
    </svg>
  );
}

export default function TeacherSettingsPage() {
  const { slug } = useSession();
  return <WorkspaceSettingsForm key={slug} slug={slug ?? ""} />;
}
export { TeacherSettingsPage };

function WorkspaceSettingsForm({ slug }: { slug: string }) {
  const { refreshWorkspace } = useSession();
  const errorToText = useApiErrorText();
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [preview, setPreview] = useState<"identity" | "payment">("identity");
  const [discard, setDiscard] = useState(false);
  const guard = useRef(false);
  const requestRef = useRef(0);
  const resetOpener = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const dirty = Boolean(settings && (JSON.stringify(draft) !== JSON.stringify(toDraft(settings)) || logo));

  useEffect(() => {
    if (!logo) { setLogoPreview(null); return; }
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setPageError(null);
    try {
      const response = await getWorkspaceSettings(slug);
      if (request === requestRef.current) { setSettings(response); setDraft(toDraft(response)); }
    } catch (caught) {
      if (request === requestRef.current) setPageError(errorToText(caught as ApiError, "تعذّر تحميل إعدادات المساحة."));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [slug, errorToText]);
  useEffect(() => { void load(); return () => { requestRef.current += 1; }; }, [load]);

  function edit<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setFields((current) => ({ ...current, [key]: [] }));
  }
  function chooseLogo(file: File | null) {
    setSaved(false);
    setLogoError(null);
    setFields((current) => ({ ...current, logo: [] }));
    setLogo(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0) {
      setLogoError("اختر صورة JPEG أو PNG أو WebP غير فارغة، أو ألغِ الاختيار للمتابعة بالشعار المحفوظ.");
      setFileKey((current) => current + 1);
      return;
    }
    setLogo(file);
  }
  function clearLogoSelection() {
    setLogo(null); setLogoError(null); setFileKey((current) => current + 1);
    setFields((current) => ({ ...current, logo: [] }));
  }
  function restore() {
    if (!settings) return;
    setDraft(toDraft(settings)); clearLogoSelection(); setFields({}); setError(null); setSaved(false); setDiscard(false);
    requestAnimationFrame(() => document.getElementById("ws-name")?.focus());
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (guard.current || !dirty || logoError) return;
    setError(null); setFields({}); setSaved(false);
    if (!draft.name.trim()) { setFields({ name: ["اكتب اسمًا للمساحة، وليس مسافات فقط."] }); setError("راجع اسم المساحة قبل الحفظ."); return; }
    guard.current = true; setSaving(true);
    try {
      const updated = await updateWorkspaceSettings(slug, {
        name: draft.name.trim(), headline: draft.headline.trim() || null, bio: draft.bio.trim() || null,
        about: draft.about.trim() || null, payment_instructions: draft.payment_instructions.trim() || null,
        is_listed: draft.is_listed, ...(logo ? { logo } : {}),
      });
      setSettings(updated); setDraft(toDraft(updated)); clearLogoSelection(); setSaved(true);
      await refreshWorkspace();
    } catch (caught) {
      const apiError = caught as ApiError;
      setFields(apiError.fieldErrors ?? {});
      setError(errorToText(apiError, "تعذّر إكمال الحفظ. مدخلاتك ما زالت موجودة. إذا غيّرت الشعار مع مسح حقول نصية فقد يكون جزء من التغييرات حُفظ؛ أعد المحاولة لإكمالها."));
    } finally { guard.current = false; setSaving(false); }
  }

  if (loading) return <FullPageSpinner />;
  if (!settings) return <Card><Alert tone="error">{pageError ?? "تعذّر تحميل الإعدادات."}</Alert><Button variant="secondary" className="mt-4" onClick={() => void load()}>إعادة المحاولة</Button></Card>;

  const inputError = (key: string) => Boolean(fields[key]?.length);
  const logoSource = logoPreview || settings.logo;

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-line bg-section p-6 sm:p-8" aria-label="إعدادات هوية المساحة">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-accent"><SettingsIcon name="identity" />مساحتك، كما يراها الطلاب</div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="[&_h1]:text-3xl [&_h1]:font-extrabold"><PageHeader title="إعدادات المساحة" subtitle="عرّف بمساحتك، حدّد ظهورها، ووضّح طريقة الدفع لطلابك." /></div>
          <span className={`rounded-pill px-3 py-2 text-sm font-bold ${dirty ? "bg-surface text-ink" : "bg-accent-soft text-accent"}`}>{dirty ? "تعديلات غير محفوظة" : "الإعدادات المحفوظة"}</span>
        </div>
        <div className="text-sm leading-8 text-ink">التعديلات تظهر في المعاينة فورًا، ولا تُطبّق على المساحة إلا بعد الحفظ.</div>
      </section>
      {error && <div ref={errorRef} tabIndex={-1} className="rounded-card focus-visible:outline-2 focus-visible:outline-accent"><Alert tone="error">{error}</Alert></div>}
      <div role="status" aria-live="polite" className={saved ? "rounded-card border border-line bg-accent-soft p-4 text-ink" : "sr-only"}>{saved ? "تم حفظ إعدادات المساحة. المعاينة الآن مطابقة للبيانات المحفوظة." : ""}</div>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <form className="space-y-6 xl:col-span-2" onSubmit={(event) => void save(event)} aria-busy={saving}>
          <fieldset disabled={saving} className="min-w-0 space-y-6">
            <Card className="p-6 sm:p-8">
              <div role="heading" aria-level={2} className="flex items-center gap-2 text-xl font-bold text-ink"><SettingsIcon name="identity" />هوية المساحة</div>
              <div className="mt-2 text-sm leading-8 text-ink">الاسم والشعار يساعدان الطالب على التعرّف على مساحتك.</div>
              <div className="mt-5 space-y-5">
                <div><Label htmlFor="ws-name">اسم المساحة (مطلوب)</Label><Input id="ws-name" className="min-h-12" required value={draft.name} onChange={(event) => edit("name", event.target.value)} invalid={inputError("name")} aria-describedby="ws-name-error" /><FieldError id="ws-name-error" messages={fields.name} /></div>
                <div>
                  <Label htmlFor="ws-logo">تغيير الشعار (اختياري)</Label>
                  <div className="mb-3 flex items-center gap-3"><WorkspaceLogo src={logoSource} name={draft.name} size={56} /><div className="text-sm leading-7 text-ink">{logo ? "معاينة الشعار الجديد · لم يُحفظ بعد" : settings.logo ? "الشعار المحفوظ حاليًا" : "لا يوجد شعار مرفوع؛ يظهر بديل بحرف الاسم"}</div></div>
                  <Input key={fileKey} id="ws-logo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseLogo(event.target.files?.[0] ?? null)} className="min-h-12 w-full min-w-0 file:me-3 file:rounded-control file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-accent" invalid={Boolean(logoError) || inputError("logo")} aria-describedby="ws-logo-hint ws-logo-error" />
                  <div id="ws-logo-hint" className="mt-2 text-sm leading-7 text-ink">JPEG أو PNG أو WebP. اختر شعارًا واضحًا عند عرضه بحجم صغير؛ يستبدل الشعار الحالي بعد الحفظ فقط.</div>
                  <FieldError id="ws-logo-error" messages={logoError ? [logoError] : fields.logo} />
                  {(logo || logoError) && <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 break-all text-sm text-ink">{logo?.name}</span><Button type="button" variant="secondary" className="min-h-11" onClick={clearLogoSelection}>إلغاء اختيار الشعار الجديد</Button></div>}
                </div>
              </div>
            </Card>

            <Card className="p-6 sm:p-8">
              <div role="heading" aria-level={2} className="flex items-center gap-2 text-xl font-bold text-ink"><SettingsIcon name="eye" />التعريف والظهور</div>
              <div className="mt-2 text-sm leading-8 text-ink">معلومات تساعد الطالب يفهم تخصّصك وطريقة تعلّمه معك.</div>
              <div className="mt-5 space-y-5">
                <div><Label htmlFor="ws-headline">العنوان التعريفي (اختياري)</Label><Input id="ws-headline" className="min-h-12" value={draft.headline} onChange={(event) => edit("headline", event.target.value)} placeholder="سطر واضح يعرّف بتخصّص مساحتك" invalid={inputError("headline")} aria-describedby="ws-headline-error" /><FieldError id="ws-headline-error" messages={fields.headline} /></div>
                <div><Label htmlFor="ws-bio">نبذة مختصرة (اختياري)</Label><Textarea id="ws-bio" rows={3} value={draft.bio} onChange={(event) => edit("bio", event.target.value)} placeholder="من تساعد، وما الذي يميّز طريقة شرحك؟" invalid={inputError("bio")} aria-describedby="ws-bio-error" /><FieldError id="ws-bio-error" messages={fields.bio} /></div>
                <div><Label htmlFor="ws-about">عن المعلّم (اختياري)</Label><Textarea id="ws-about" rows={5} value={draft.about} onChange={(event) => edit("about", event.target.value)} placeholder="أضف خبرتك وطريقتك في التدريس بتفاصيل مفيدة ودقيقة." invalid={inputError("about")} aria-describedby="ws-about-error" /><FieldError id="ws-about-error" messages={fields.about} /></div>
                <div className="rounded-card border border-line bg-soft p-4">
                  <div className="flex items-start gap-3"><Input id="ws-listed" type="checkbox" className="mt-1 h-5 w-5! shrink-0 p-0! accent-accent" checked={draft.is_listed} onChange={(event) => edit("is_listed", event.target.checked)} aria-describedby="ws-listed-hint ws-listed-error" /><Label htmlFor="ws-listed" className="min-w-0 flex-1 leading-7">إدراج المساحة في دليل المعلّمين العام</Label></div>
                  <div id="ws-listed-hint" className="mt-2 text-sm leading-8 text-ink">هذا الخيار يخص ظهور المساحة في الدليل، وليس نشر الدورات أو إلغاء حسابات الطلاب. {draft.is_listed ? "الإدراج مفعّل في النموذج." : "الإدراج غير مفعّل في النموذج."}</div>
                  {draft.is_listed !== settings.is_listed && <div className="mt-2 text-sm font-bold text-accent">لن يتغيّر الظهور إلا بعد الحفظ.</div>}
                  <FieldError id="ws-listed-error" messages={fields.is_listed} />
                </div>
              </div>
            </Card>

            <Card className="p-6 sm:p-8">
              <div role="heading" aria-level={2} className="flex items-center gap-2 text-xl font-bold text-ink"><SettingsIcon name="receipt" />تعليمات الدفع</div>
              <div className="mt-2 text-sm leading-8 text-ink">اكتب خطوات الدفع خارج المنصّة للطلاب المشتركين في دورات بمقابل.</div>
              <div className="mt-5"><Label htmlFor="ws-payment">التعليمات التي تظهر للطالب (اختياري)</Label><Textarea id="ws-payment" rows={6} value={draft.payment_instructions} onChange={(event) => edit("payment_instructions", event.target.value)} invalid={inputError("payment_instructions")} placeholder={"وضّح وسيلة الدفع المعتمدة، وبيانات المستلم اللازمة.\nثم اشرح ما يكتبه الطالب في مرجع العملية وكيف يقدّم الإشعار."} aria-describedby="ws-payment-hint ws-payment-error" /><FieldError id="ws-payment-error" messages={fields.payment_instructions} /></div>
              <div id="ws-payment-hint" className="mt-4 rounded-card bg-soft p-4 text-sm leading-8 text-ink">راجع بيانات المستلم بعناية. لا تُدرج كلمات مرور أو رموز تحقّق، ولا تطلب بيانات بطاقة كاملة. كتابة تعليمات الدفع لا تفعّل بوابة دفع أو تحقّقًا بنكيًا تلقائيًا.</div>
            </Card>

            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4"><div className="text-sm leading-7 text-ink">{dirty ? "توجد تعديلات لم تُحفظ بعد." : "لا توجد تعديلات جديدة للحفظ."}<div>الحفظ يشمل جميع الأقسام.</div></div><div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" size="lg" disabled={!dirty && !logoError} onClick={(event) => { resetOpener.current = event.currentTarget; setDiscard(true); }}>استعادة المحفوظ</Button><Button type="submit" size="lg" disabled={saving || !dirty || Boolean(logoError)}>{saving && <Spinner className="h-4 w-4 border-accent-contrast/40 border-t-accent-contrast" />}{saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</Button></div></div>
              <div className="mt-4 text-sm leading-7 text-ink">احفظ قبل الانتقال إلى صفحة أخرى. يُظهر المتصفّح تنبيهًا عند تحديث التبويب أو إغلاقه مع وجود تعديلات غير محفوظة.</div>
            </Card>
          </fieldset>
        </form>

        <aside className="space-y-5 xl:sticky xl:top-6" aria-label="معاينة الإعدادات">
          <Card className="p-6">
            <div role="heading" aria-level={2} className="text-xl font-bold text-ink">معاينة مباشرة</div>
            <div className="mt-2 text-sm leading-7 text-ink">توضيح تقريبي للمحتوى، وليس لقطة من الصفحة المنشورة.</div>
            <div className="my-4 flex flex-wrap gap-2"><Button variant={preview === "identity" ? "primary" : "secondary"} className="min-h-11" aria-pressed={preview === "identity"} onClick={() => setPreview("identity")}>هوية المساحة</Button><Button variant={preview === "payment" ? "primary" : "secondary"} className="min-h-11" aria-pressed={preview === "payment"} onClick={() => setPreview("payment")}>تعليمات الدفع</Button></div>
            <div className="rounded-card border border-line bg-soft p-5">
              {preview === "identity" ? <><WorkspaceLogo src={logoSource} name={draft.name} size={56} /><div className="mt-4 break-words text-xl font-extrabold leading-8 text-ink">{draft.name.trim() || "اسم المساحة"}</div><div className="mt-2 break-words text-sm font-bold leading-8 text-accent">{draft.headline.trim() || "العنوان التعريفي يظهر هنا"}</div><div className="mt-3 whitespace-pre-wrap break-words text-sm leading-8 text-ink">{draft.bio.trim() || "النبذة المختصرة تظهر هنا بعد إضافتها."}</div>{draft.about.trim() && <details className="mt-4 border-t border-line pt-4"><summary className="cursor-pointer rounded-control text-sm font-bold text-ink focus-visible:outline-accent">عن المعلّم</summary><div className="mt-3 whitespace-pre-wrap break-words text-sm leading-8 text-ink">{draft.about}</div></details>}</> : <><div className="mb-3 flex items-center gap-2 font-bold text-ink"><SettingsIcon name="receipt" />تعليمات الدفع للطالب</div><div className="whitespace-pre-wrap break-words text-sm leading-8 text-ink">{draft.payment_instructions.trim() || "لم تُضف تعليمات دفع بعد. إن كانت لديك دورات بمقابل، وضّح للطالب كيفية الدفع قبل التحويل."}</div></>}
            </div>
            <div className="mt-3 text-sm font-bold text-ink">{dirty ? "المعاينة تتضمّن تغييرات غير محفوظة." : "المعاينة من الإعدادات المحفوظة."}</div>
          </Card>
        </aside>
      </div>
      {discard && <DiscardSettings onCancel={() => { setDiscard(false); resetOpener.current?.focus(); }} onConfirm={restore} />}
    </div>
  );
}

function DiscardSettings({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="m-auto max-h-dvh w-full max-w-md overflow-y-auto rounded-panel border border-line bg-surface p-6 text-ink shadow-elevated backdrop:bg-panel/50" aria-labelledby="discard-settings-title" aria-describedby="discard-settings-hint" onCancel={(event) => { event.preventDefault(); onCancel(); }}><div id="discard-settings-title" role="heading" aria-level={2} className="text-xl font-bold">استعادة آخر إعدادات محفوظة؟</div><div id="discard-settings-hint" className="mt-3 text-sm leading-8">ستُلغى كل تعديلات النموذج غير المحفوظة، بما فيها اختيار الشعار الجديد. الإعدادات المحفوظة لن تتغيّر.</div><div className="mt-5 flex flex-wrap justify-end gap-3"><Button variant="secondary" size="lg" autoFocus onClick={onCancel}>العودة للتعديل</Button><Button variant="danger" size="lg" onClick={onConfirm}>تجاهل التعديلات</Button></div></dialog>;
}

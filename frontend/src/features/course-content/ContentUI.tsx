import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Label, PageHeader, Textarea } from "../../components/ui";

export const contentLink = "inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-surface px-4 py-3 text-sm font-bold text-accent hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";

export function ContentHeader({ title, hint, back, backLabel, note }: { title: string; hint: string; back: string; backLabel: string; note?: string | null }) {
  const defaultNote = "محتوى تجريبي لمعاينة الواجهة. الملاحظات والإجابات ليست سجلًّا محفوظًا، والملفات المعروضة غير مرفوعة فعليًا.";
  const shownNote = note === undefined ? defaultNote : note;
  return <section className="mb-6 rounded-panel border border-line bg-section p-6 sm:p-8">
    <Link to={back} className="mb-4 inline-flex min-h-11 items-center text-sm font-bold text-accent hover:underline">{backLabel}</Link>
    <div className="[&_h1]:text-2xl [&_h1]:font-extrabold sm:[&_h1]:text-3xl"><PageHeader title={title} subtitle={hint} /></div>
    {shownNote && <div className="text-sm leading-7 text-ink">{shownNote}</div>}
  </section>;
}

export function ContentStats({ items }: { items: Array<[string, string]> }) {
  return <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{items.map(([value, label]) => <Card key={label}><dd className="text-2xl font-extrabold text-accent">{value}</dd><dt className="mt-2 text-sm text-ink">{label}</dt></Card>)}</dl>;
}

export function LessonReflection() {
  const [note, setNote] = useState("");
  const [understood, setUnderstood] = useState(false);
  return <Card className="mt-6">
    <div role="heading" aria-level={2} className="text-lg font-bold text-ink">قبل الانتقال للدرس التالي</div>
    <div className="my-3 text-sm leading-8 text-ink">هل تستطيع شرح الفكرة بطريقتك؟ اكتب نقطة فهمتها أو سؤالًا تحتاج إلى مراجعته.</div>
    <Label htmlFor="lesson-reflection">مسودة ملاحظتك (اختيارية)</Label>
    <Textarea id="lesson-reflection" rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} aria-describedby="reflection-hint" placeholder="الفكرة التي فهمتها، والسؤال الذي سأعود إليه..." />
    <div id="reflection-hint" className="mt-2 text-sm leading-7 text-ink">هذه المسودة مؤقتة وتُمسح عند تغيير الدرس أو مغادرة الصفحة؛ انسخها إن أردت الاحتفاظ بها.</div>
    <Button variant={understood ? "primary" : "secondary"} className="mt-4 min-h-11" aria-pressed={understood} onClick={() => setUnderstood((current) => !current)}>{understood ? "راجعت الفكرة · إلغاء التحديد" : "راجعت الفكرة الأساسية"}</Button>
    <div role="status" className="mt-2 text-sm text-ink">{understood ? "تقييم ذاتي لهذه الجلسة فقط، وليس إنجازًا مسجّلًا." : ""}</div>
  </Card>;
}

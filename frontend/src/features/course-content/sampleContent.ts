/*
  Sample content for the course-content UI (Stage 6 skeleton preview).

  The backend has the CourseSection / Lesson / LessonAsset / Topic / Question /
  Exam / ExamAttempt / Answer models but NO endpoints for them yet (the design
  explicitly leaves content endpoints out of the current round). These screens
  are therefore a design preview: the *course* on each screen is loaded from the
  real API, and everything below the course follows the exact fields the Stage 6
  models define, so swapping the sample in for the real API later is a data
  change, not a redesign. Every screen using this file labels it clearly.
*/

/** Convert 0-9 to Arabic-Indic digits for display. */
export function arDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}

/** Map Arabic-Indic digits back to 0-9 and trim, for the short-answer check. */
export function normalizeAnswerText(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .trim()
    .replace(/\s+/g, " ");
}

/* ---------- Types (mirrors of the Stage 6 models) ---------- */

export interface SampleSection {
  id: string;
  title: string;
  position: number;
}

export interface SampleAsset {
  id: string;
  lessonId: string;
  /** LessonAsset.AssetType: pdf | video | slide | doc | audio */
  assetType: "pdf" | "video" | "slide" | "doc" | "audio";
  fileName: string;
  /** LessonAsset.ExtractionStatus: pending | running | done | failed */
  extractionStatus: "pending" | "running" | "done" | "failed";
}

export interface SampleLesson {
  id: string;
  sectionId: string;
  title: string;
  content: string;
  position: number;
  isPublished: boolean;
  topicIds: string[];
  examId?: string;
}

export interface SampleTopic {
  id: string;
  name: string;
  /* Topic.slug */
  slug: string;
}

export interface SampleQuestion {
  id: string;
  /** Question.QuestionType: mcq | true_false | short | essay */
  questionType: "mcq" | "true_false" | "short" | "essay";
  stem: string;
  options: string[] | null;
  /** JSONField on the model; for the mock: index into options, boolean as an index, or exact short text. */
  correctAnswer: number | string;
  explanation: string;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  sourceType: "manual" | "ai_generated";
  /* Question.Status */
  status: "draft" | "approved" | "rejected" | "archived";
}

export interface SampleExam {
  id: string;
  lessonId: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScorePercent: number;
  maxAttempts: number;
  status: "draft" | "published" | "archived";
  questions: SampleQuestion[];
}

/* ---------- The sample tree (one realistic algebra course) ---------- */

export const sampleSections: SampleSection[] = [
  { id: "s1", title: "بداية الجبر: المقادير", position: 1 },
  { id: "s2", title: "المعادلات من الدرجة الأولى", position: 2 },
];

export const sampleTopics: SampleTopic[] = [
  { id: "t1", name: "مقادير جبرية", slug: "algebraic-expressions" },
  { id: "t2", name: "معادلات", slug: "equations" },
  { id: "t3", name: "تطبيقات حياتية", slug: "real-life-problems" },
];

export const sampleAssets: SampleAsset[] = [
  { id: "a1", lessonId: "l1", assetType: "pdf", fileName: "ورقة-تمارين-01.pdf", extractionStatus: "done" },
  { id: "a2", lessonId: "l2", assetType: "video", fileName: "شرح-تبسيط-المقادير.mp4", extractionStatus: "done" },
  {
    id: "a3",
    lessonId: "l3",
    assetType: "slide",
    fileName: "حل-المعادلات-عرض.pptx",
    extractionStatus: "pending",
  },
  { id: "a4", lessonId: "l4", assetType: "pdf", fileName: "مسائل-حياتية.pdf", extractionStatus: "done" },
];

export const sampleLessons: SampleLesson[] = [
  {
    id: "l1",
    sectionId: "s1",
    title: "المتغيّر والتعبير الجبري",
    content:
      "المتغيّر رمز يمثّل قيمة مجهولة، والتعبير الجبري يُبنى من متغيّرات وأعداد وعمليات حسابية.\n\nمثال: إذا كانت أجرة الحصّة 5 ريالات وعدد الحصص س، فإن التعبير الذي يمثّل التكلفة الكلية هو 5س.\n\nفي هذا الدرس نتعلّم ترجمة نصّ قصير إلى تعبير جبري، وأهم ملاحظات الكتابة الصحيحة.",
    position: 1,
    isPublished: true,
    topicIds: ["t1"],
  },
  {
    id: "l2",
    sectionId: "s1",
    title: "تبسيط المقادير",
    content:
      "تبسيط المقادير يعني جمع الحدود المتشابهة، أي الحدود التي تشترك في المتغيّر نفسه.\n\nالقاعدة الأساسية: 3س + 5س = 8س؛ بينما 3س + 5 تبقى كما هي لأن الحدين مختلفان.\n\nنستخدم الخطوات نفسها مع المعاملات الأكبر ومع الأعداد السالبة، مع الانتباه إلى إشارة كل حدّ.",
    position: 2,
    isPublished: true,
    topicIds: ["t1"],
  },
  {
    id: "l3",
    sectionId: "s2",
    title: "حل المعادلات الأساسية",
    content:
      "المعادلة مساواة بين طرفين، وحلّها هو القيمة التي تحقّق هذه المساواة.\n\nخطوات الحل: ننقل الحدود المعلومة إلى طرف والمتغيّر إلى الطرف الآخر، ثم نقسم على معامل المتغيّر.\n\nمثال: 2س + 3 = 11 ← 2س = 8 ← س = 4.",
    position: 1,
    isPublished: true,
    topicIds: ["t1", "t2"],
    examId: "e1",
  },
  {
    id: "l4",
    sectionId: "s2",
    title: "معادلات في مسائل حياتية",
    content:
      "نترجم نصّ المسألة إلى معادلة ثم نحلّها كالعادة.\n\nمثال: اشترى طالبٌ دفترات بسعر ثابت لكل دفتر، ودفع 24 ريالًا عن 6 دفترات. ما سعر الدفتر الواحد؟ نترجم إلى معادلة: 6س = 24، ومنها س = 4 ريالات.",
    position: 2,
    isPublished: false,
    topicIds: ["t2", "t3"],
  },
];

const ASSET_TYPE_LABELS: Record<SampleAsset["assetType"], string> = {
  pdf: "ملف PDF",
  video: "فيديو",
  slide: "عرض تقديمي",
  doc: "مستند",
  audio: "صوت",
};

const EXTRACTION_LABELS: Record<SampleAsset["extractionStatus"], string> = {
  pending: "بانتظار المعالجة",
  running: "جارٍ الاستخراج",
  done: "جاهز",
  failed: "فشل الاستخراج",
};

const DIFFICULTY_LABELS: Record<SampleQuestion["difficulty"], string> = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

const SOURCE_LABELS: Record<SampleQuestion["sourceType"], string> = {
  manual: "كتبه المعلّم",
  ai_generated: "مقترح بالذكاء الاصطناعي",
};

export function assetTypeLabel(type: SampleAsset["assetType"]): string {
  return ASSET_TYPE_LABELS[type];
}

export function extractionStatusLabel(status: SampleAsset["extractionStatus"]): string {
  return EXTRACTION_LABELS[status];
}

export function difficultyLabel(difficulty: SampleQuestion["difficulty"]): string {
  return DIFFICULTY_LABELS[difficulty];
}

export function sourceLabel(source: SampleQuestion["sourceType"]): string {
  return SOURCE_LABELS[source];
}

/* ---------- The sample exam on lesson l3 ---------- */

export const sampleExam: SampleExam = {
  id: "e1",
  lessonId: "l3",
  title: "اختبار الوحدة الأولى",
  description: "أسئلة قصيرة تغطي تبسيط المقادير وحل المعادلات من الدرجة الأولى.",
  durationMinutes: 20,
  passingScorePercent: 60,
  maxAttempts: 2,
  status: "published",
  questions: [
    {
      id: "q1",
      questionType: "mcq",
      stem: "ما ناتج تبسيط المقدار 3س + 5س؟",
      options: ["8س", "15س", "8 + س", "15 + س"],
      correctAnswer: 0,
      explanation: "نجمع الحدين لأنهما للمتغيّر نفسه: 3س + 5س = 8س.",
      points: 1,
      difficulty: "easy",
      sourceType: "manual",
      status: "approved",
    },
    {
      id: "q2",
      questionType: "true_false",
      stem: "كل عدد صحيح هو عدد طبيعي.",
      options: ["صحيح", "خطأ"],
      correctAnswer: 1,
      explanation:
        "العكس صحيح: كل عدد طبيعي هو عدد صحيح، بينما الأعداد السالبة صحيحة وليست طبيعية.",
      points: 1,
      difficulty: "easy",
      sourceType: "manual",
      status: "approved",
    },
    {
      id: "q3",
      questionType: "mcq",
      stem: "ما قيمة س التي تحقّق المعادلة 2س + 3 = 11؟",
      options: ["س = 3", "س = 4", "س = 7", "س = 14"],
      correctAnswer: 1,
      explanation: "س = (11 − 3) ÷ 2 = 4.",
      points: 2,
      difficulty: "medium",
      sourceType: "manual",
      status: "approved",
    },
    {
      id: "q4",
      questionType: "short",
      stem: "حلّ المعادلة 5س = 20، ثم اكتب قيمة س فقط.",
      options: null,
      correctAnswer: "4",
      explanation: "س = 20 ÷ 5 = 4.",
      points: 2,
      difficulty: "medium",
      sourceType: "manual",
      status: "approved",
    },
  ],
};

export const sampleExamTotalPoints = sampleExam.questions.reduce((sum, q) => sum + q.points, 0);

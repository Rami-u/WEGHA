/*
  TypeScript mirrors of the backend serializer shapes. Keep these in sync with
  the serializers under backend/apps/* — the authoritative reference is the
  OpenAPI schema at /api/schema/ (Shape 8.x of docs/backend-design.md).
*/

export type Role = "teacher" | "student" | "assistant" | "admin";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type WorkspaceStatus = "active" | "suspended";

export type EnrollmentStatus = "pending_payment" | "active" | "withdrawn";

export type PaymentStatus = "submitted" | "confirmed" | "rejected";

export type PaymentMethod = "transfer" | "e_wallet" | "cash" | "other";

/* ---------- Authentication (apps/accounts) ---------- */

export interface WorkspaceRef {
  slug: string;
  name: string;
}

/** GET auth/me/ — any role currently signed in to this workspace. */
export interface ApiUser {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  approval_status: ApprovalStatus;
  workspace: WorkspaceRef;
}

/** 403 body of student login when credentials are correct but the account is pending/rejected. */
export interface LoginStateError {
  code: "pending_approval" | "account_rejected";
  message: string;
  rejection_reason?: string | null;
}

export interface RegistrationResponse {
  message: string;
  approval_status: ApprovalStatus;
}

/* ---------- Public showcase (apps/public) ---------- */

export interface PublicTeacherDirectoryEntry {
  slug: string;
  name: string;
  teacher_name: string;
  logo: string | null;
  headline: string | null;
}

export interface PublicCourse {
  id: number;
  title: string;
  description: string | null;
  price: string;
}

export interface PublicTeacherProfile {
  slug: string;
  name: string;
  teacher_name: string;
  logo: string | null;
  headline: string | null;
  bio: string | null;
  about: string | null;
  courses: PublicCourse[];
}

/** Branding response — includes status so the frontend can show "unavailable". */
export interface WorkspaceBranding {
  slug: string;
  name: string;
  logo: string | null;
  headline: string | null;
  status: WorkspaceStatus;
}

/* ---------- Workspace settings (teacher) ---------- */

export interface WorkspaceSettings {
  slug: string;
  name: string;
  logo: string | null;
  headline: string | null;
  bio: string | null;
  about: string | null;
  is_listed: boolean;
  payment_instructions: string | null;
}

/* ---------- Courses (apps/courses) ---------- */

export interface Course {
  id: number;
  title: string;
  description: string | null;
  price: string;
  is_published: boolean;
  /** The signed-in student's enrollment status for this course; null for teachers/guests. */
  enrollment_status: EnrollmentStatus | null;
  created_at: string;
}

/* ---------- Enrollments (apps/enrollments) ---------- */

export interface EnrollResult {
  enrollment_id: number;
  status: EnrollmentStatus;
  price: string;
  payment_instructions: string | null;
}

export interface Enrollment {
  id: number;
  course_id: number;
  course_title: string;
  status: EnrollmentStatus;
  price_at_enrollment: string;
  created_at: string;
  activated_at: string | null;
}

/* ---------- Payments (apps/payments) ---------- */

export interface PaymentSubmission {
  id: number;
  enrollment_id: number;
  course_id: number;
  course_title: string;
  student_id: number;
  student_name: string;
  student_email: string;
  amount: string;
  method: PaymentMethod;
  note: string | null;
  has_receipt: boolean;
  status: PaymentStatus;
  submitted_at: string;
  reviewed_by_id: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

/* ---------- Student review (apps/accounts) ---------- */

export interface StudentReviewEntry {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  approval_status: ApprovalStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  date_joined: string;
}

/* ---------- Assessments: topics, questions, exams (apps/assessments) ---------- */

export type QuestionType = "mcq" | "true_false" | "short" | "essay";

export type QuestionStatus = "draft" | "approved" | "rejected" | "archived";

export type QuestionDifficulty = "easy" | "medium" | "hard";

export type QuestionSource = "manual" | "ai_generated";

export type ExamStatus = "draft" | "published" | "archived";

/** Topic as embedded in a question (TopicBriefSerializer). */
export interface TopicRef {
  id: number;
  name: string;
}

export interface Topic {
  id: number;
  name: string;
  slug: string;
  course: number | null;
  created_at: string;
}

/** A multiple-choice option: `id` is the value stored in correct_answer. */
export interface McqOption {
  id: string;
  text: string;
}

/** correct_answer is typed per question_type: option id, boolean, list, or text. */
export type QuestionAnswer = string | boolean | string[] | null;

export interface Question {
  id: number;
  question_type: QuestionType;
  stem: string;
  options: McqOption[] | null;
  correct_answer: QuestionAnswer;
  explanation: string | null;
  difficulty: QuestionDifficulty;
  points: string;
  course: number | null;
  lesson: number | null;
  topics: TopicRef[];
  status: QuestionStatus;
  source_type: QuestionSource;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Exam {
  id: number;
  course: number;
  lesson: number | null;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  passing_score: string | null;
  max_attempts: number;
  proctoring_enabled: boolean;
  status: ExamStatus;
  published_at: string | null;
  created_at: string;
  question_count: number;
  total_points: string;
}

/** Student-facing exam card: no questions and no passing score (StudentExamSerializer). */
export interface StudentExam {
  id: number;
  title: string;
  description: string | null;
  course: { id: number; title: string };
  duration_minutes: number | null;
  max_attempts: number;
  proctoring_enabled: boolean;
  question_count: number;
  total_points: string;
  attempts_used: number;
  in_progress_attempt_id: number | null;
}

export interface ExamQuestionRow {
  question_id: number;
  position: number;
  points_override: string | null;
  points: string;
  stem: string;
  question_type: QuestionType;
}

export type AttemptStatus = "in_progress" | "submitted" | "graded";

export interface ExamAttemptState {
  id: number;
  exam: number;
  attempt_number: number;
  status: AttemptStatus;
  started_at: string;
  submitted_at: string | null;
  ends_at: string;
  remaining_seconds: number;
}

/* ---------- Proctoring (apps/proctoring) ---------- */

export type ProctoringEventType =
  | "face_missing"
  | "multiple_faces"
  | "looking_away"
  | "phone_detected"
  | "tab_switch";

export type ProctoringSeverity = "info" | "warning" | "high";

export type ProctoringReviewStatus = "pending" | "dismissed" | "violation";

export interface ProctoringEvidence {
  id: number;
  evidence_type: "snapshot" | "video" | "screen" | "audio";
  mime_type: string | null;
  /** Authorized API route; already absolute from the API root. */
  file_url: string;
}

export interface ProctoringEvent {
  id: number;
  attempt: number;
  student: number;
  event_type: ProctoringEventType;
  severity: ProctoringSeverity;
  occurred_at: string;
  details: Record<string, unknown> | null;
  review_status: ProctoringReviewStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  evidence: ProctoringEvidence[];
}

/* ---------- Generic pagination (PageNumberPagination, 20 per page) ---------- */

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

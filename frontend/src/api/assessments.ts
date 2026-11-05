import { apiRequest } from "../lib/apiClient";
import { fetchAllPages } from "./pagination";
import type {
  Exam,
  ExamAttemptState,
  ExamQuestionRow,
  McqOption,
  Question,
  QuestionAnswer,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
  StudentExam,
  Topic,
} from "../types/api";

/**
 * Assessment endpoints from apps/assessments (Stage 8/9).
 * All of them live under /api/v1/workspaces/{slug}/.
 */

const prefix = (slug: string): string => `/workspaces/${encodeURIComponent(slug)}`;

/* ---------- Topics ---------- */

/** GET /topics/?course= — teacher only, optionally one course. */
export function listTopics(slug: string, courseId?: number): Promise<Topic[]> {
  const query = courseId ? `?course=${courseId}` : "";
  return fetchAllPages<Topic>(`${prefix(slug)}/topics/${query}`);
}

export interface TopicInput {
  name: string;
  course: number | null;
}

/** POST /topics/ — the slug is derived from the name by the server. */
export function createTopic(slug: string, input: TopicInput): Promise<Topic> {
  return apiRequest(`${prefix(slug)}/topics/`, { method: "POST", json: input });
}

/** PATCH /topics/{id}/ */
export function updateTopic(slug: string, topicId: number, patch: Partial<TopicInput>): Promise<Topic> {
  return apiRequest(`${prefix(slug)}/topics/${topicId}/`, { method: "PATCH", json: patch });
}

/* ---------- Questions ---------- */

export interface QuestionFilters {
  course?: number;
  status?: QuestionStatus;
  question_type?: QuestionType;
  difficulty?: QuestionDifficulty;
  search?: string;
}

export function listQuestions(slug: string, filters: QuestionFilters = {}): Promise<Question[]> {
  const query = new URLSearchParams();
  if (filters.course) query.set("course", String(filters.course));
  if (filters.status) query.set("status", filters.status);
  if (filters.question_type) query.set("question_type", filters.question_type);
  if (filters.difficulty) query.set("difficulty", filters.difficulty);
  if (filters.search?.trim()) query.set("search", filters.search.trim());
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchAllPages<Question>(`${prefix(slug)}/questions/${suffix}`);
}

/**
 * POST /questions/ and PATCH /questions/{id}/.
 * `question_type` and `status` are create-only, so they are omitted on update.
 */
export interface QuestionInput {
  stem: string;
  options: McqOption[] | null;
  correct_answer: QuestionAnswer;
  explanation: string | null;
  difficulty: QuestionDifficulty;
  points: string;
  course: number | null;
  topic_ids: number[];
}

export function createQuestion(
  slug: string,
  questionType: QuestionType,
  input: QuestionInput,
): Promise<Question> {
  return apiRequest(`${prefix(slug)}/questions/`, {
    method: "POST",
    json: { ...input, question_type: questionType },
  });
}

export function updateQuestion(
  slug: string,
  questionId: number,
  input: Partial<QuestionInput>,
): Promise<Question> {
  return apiRequest(`${prefix(slug)}/questions/${questionId}/`, { method: "PATCH", json: input });
}

/** POST /questions/{id}/approve|reject|archive/ — 409 when the state forbids it. */
export function questionAction(
  slug: string,
  questionId: number,
  action: "approve" | "reject" | "archive",
): Promise<Question> {
  return apiRequest(`${prefix(slug)}/questions/${questionId}/${action}/`, { method: "POST" });
}

/* ---------- Exams (teacher) ---------- */

/** GET /exams/ — teachers get every exam in the workspace. */
export function listTeacherExams(slug: string): Promise<Exam[]> {
  return fetchAllPages<Exam>(`${prefix(slug)}/exams/`);
}

/** GET /exams/{id}/ — the full exam shape for a teacher. */
export function getTeacherExam(slug: string, examId: number): Promise<Exam> {
  return apiRequest(`${prefix(slug)}/exams/${examId}/`);
}

export interface ExamInput {
  title: string;
  description: string | null;
  duration_minutes: number | null;
  passing_score: string | null;
  max_attempts: number;
  proctoring_enabled: boolean;
}

/** POST /exams/ — created as a draft. `course` is create-only. */
export function createExam(slug: string, courseId: number, input: ExamInput): Promise<Exam> {
  return apiRequest(`${prefix(slug)}/exams/`, {
    method: "POST",
    json: { ...input, course: courseId },
  });
}

/** PATCH /exams/{id}/ — 409 when the freeze rules forbid the change. */
export function updateExam(slug: string, examId: number, patch: Partial<ExamInput>): Promise<Exam> {
  return apiRequest(`${prefix(slug)}/exams/${examId}/`, { method: "PATCH", json: patch });
}

/** POST /exams/{id}/publish/ — 400 without approved questions, 409 if not a draft. */
export function publishExam(slug: string, examId: number): Promise<Exam> {
  return apiRequest(`${prefix(slug)}/exams/${examId}/publish/`, { method: "POST" });
}

/** POST /exams/{id}/archive/ */
export function archiveExam(slug: string, examId: number): Promise<Exam> {
  return apiRequest(`${prefix(slug)}/exams/${examId}/archive/`, { method: "POST" });
}

/** GET /exams/{id}/questions/ — the ordered rows (not paginated). */
export async function getExamQuestions(slug: string, examId: number): Promise<ExamQuestionRow[]> {
  const payload = await apiRequest<{ questions: ExamQuestionRow[] }>(
    `${prefix(slug)}/exams/${examId}/questions/`,
  );
  return payload.questions;
}

export interface ExamQuestionInput {
  question_id: number;
  points_override?: string | null;
}

/** PUT /exams/{id}/questions/ — replaces the whole ordered list. */
export async function replaceExamQuestions(
  slug: string,
  examId: number,
  questions: ExamQuestionInput[],
): Promise<ExamQuestionRow[]> {
  const payload = await apiRequest<{ questions: ExamQuestionRow[] }>(
    `${prefix(slug)}/exams/${examId}/questions/`,
    { method: "PUT", json: { questions } },
  );
  return payload.questions;
}

/* ---------- Exams and attempts (student) ---------- */

/** GET /exams/ as an approved student: published exams in active courses only. */
export function listStudentExams(slug: string): Promise<StudentExam[]> {
  return fetchAllPages<StudentExam>(`${prefix(slug)}/exams/`);
}

/**
 * POST /exams/{id}/attempts/start/
 * Returns 201 for a new attempt and 200 when an unexpired attempt is resumed.
 * `consent` must be true when the exam has proctoring enabled.
 */
export function startAttempt(slug: string, examId: number, consent: boolean): Promise<ExamAttemptState> {
  return apiRequest(`${prefix(slug)}/exams/${examId}/attempts/start/`, {
    method: "POST",
    json: { consent },
  });
}

/** GET /attempts/{id}/ — the student's own attempt, or any attempt for a teacher. */
export function getAttempt(slug: string, attemptId: number): Promise<ExamAttemptState> {
  return apiRequest(`${prefix(slug)}/attempts/${attemptId}/`);
}

/** POST /attempts/{id}/submit/ — closes the attempt and ends proctoring. */
export function submitAttempt(slug: string, attemptId: number): Promise<ExamAttemptState> {
  return apiRequest(`${prefix(slug)}/attempts/${attemptId}/submit/`, { method: "POST" });
}

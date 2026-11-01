# Proctoring app

Proctoring produces **signals for staff review**, never an automatic cheating verdict (design section 1). The code never writes `violation` or changes `ExamAttempt.proctoring_review_status`; only a teacher decides.

## Flow

1. The student starts an attempt with `{"consent": true}`. The time is stored once in `ExamAttempt.consent_given_at`.
2. While the attempt is `in_progress`, the client uploads a frame every 1-2 seconds and reports browser events.
3. The vision backend analyses each frame. Detected events and their snapshots are saved.
4. A teacher reviews each event as `dismissed` or `violation`.
5. Submitting, or the exam time running out, closes the attempt and ends the vision session.

## Student endpoints (`/api/v1/workspaces/{slug}/`)

| Method and path | Purpose | Success |
|---|---|---|
| `POST exams/{exam_id}/attempts/start/` | Start an attempt. Body `{"consent": true}` is required for proctored exams | see attempts API |
| `POST attempts/{id}/frames/` | Upload one frame, multipart field `image` | `200 {"ok": true}` |
| `POST attempts/{id}/browser-events/` | Record a browser event | `201 {"ok": true}` |
| `POST attempts/{id}/submit/` | Submit and close the attempt | see attempts API |

Start without consent returns `400 {"consent": "Consent is required to start this exam."}` and the attempt is not opened.

Checks on frames and browser events, in this order:

1. `404` if the attempt is not the student's own.
2. `400` if proctoring is not enabled for the exam.
3. `403` "This attempt is not accepting frames/events." if the attempt is not `in_progress` or its time has ended.
4. `403` "Consent has not been given for this attempt." if `consent_given_at` is empty.

Frame validation (by content, using Pillow, not by file name or header): JPEG or PNG only, not empty, at most `PROCTORING_FRAME_MAX_BYTES` (default 500 KB), at most `PROCTORING_FRAME_MAX_PIXELS` (default 4,000,000). A missing file or an invalid image returns `400`.

Browser event body: `{"type": "tab_hidden", "started_at": optional, "duration_seconds": optional, 0..86400}`. It is saved as `event_type=tab_switch`, severity `warning`.

Throttles: `proctoring_frame` 120/minute and `proctoring_browser_event` 30/minute.

## Teacher endpoints (`/api/v1/workspaces/{slug}/`, workspace teacher only)

| Method and path | Purpose |
|---|---|
| `GET attempts/{id}/proctoring/events/` | Paginated events of one attempt; filters `review_status`, `event_type`, `severity` (invalid value: 400) |
| `GET proctoring/events/{id}/` | One event with its `evidence` list `{id, evidence_type, mime_type, file_url}` |
| `POST proctoring/events/{id}/review/` | Body `{"review_status": "dismissed" or "violation"}`; the server sets reviewer and time; `pending` returns 400; a second review returns 409 |
| `GET proctoring/evidence/{id}/file/` | Streams a snapshot; `file_url` is this route, never the storage key |

Every query is scoped to the URL workspace. An id from another workspace returns 404; students, pending students, anonymous users and other workspaces' teachers are refused. A review changes the event only, not `ExamAttempt.proctoring_review_status`.

## What exists (Stage 9)

| Part | File |
|---|---|
| Models `ProctoringEvent` (5.22), `ProctoringEvidence` (5.23), admin (read-only), migration `0001` | `models.py`, `admin.py`, `migrations/` |
| Services: `record_consent`, `record_event`, `save_snapshot`, `process_frame`, `finish_attempt`, `finish_proctoring_safely` | `services.py` |
| Close hook: `_close_attempt` in `assessments/attempt_services.py` calls `finish_proctoring_safely` after commit (`transaction.on_commit`), only for exams with `proctoring_enabled` | `assessments/attempt_services.py` |
| Vision adapter with the fake and real backends, severity map | `vision_adapter.py` |
| Student serializers, views, urls, throttles | `student_*.py`, `throttles.py` |
| Teacher endpoints, review service, retention command | `teacher_*.py`, `review_services.py`, `management/commands/clean_proctoring_evidence.py` |
| Vision package (detection code and model files) | `vision/` at the backend root |

## Vision backend

`PROCTORING_VISION_BACKEND` selects the backend:

- `fake` (default): detects nothing real; used for tests and for running without the vision dependencies.
- `vision`: the real backend. It needs `mediapipe`, `numpy` and `opencv-python-headless` (in `requirements.txt`) and the model files in `vision/`. It calls `vision.pipeline.process_session_frame` with the attempt id as session id.

Detected event types: `face_missing`, `multiple_faces`, `looking_away`, `phone_detected`. An event opens once, after the face or object has been present for a minimum time (`vision/config.py`): `face_missing` 3 seconds; `multiple_faces`, `looking_away` and `phone_detected` 5 seconds. The adapter saves only the `opened` record, so the stored `duration_seconds` is the duration at the moment the event opened, not the final duration. Closing the attempt clears the vision session.

Limits that were observed or are known:

- The session store is in memory, so the real backend is only valid with a single worker. There is no Redis or shared store.
- In manual tests with the real model, a head tilt of about 25 degrees gave `looking_away`, but a tilt of 45 degrees and looking down gave `face_missing`. This is how the model behaves.
- The automated tests for the real backend replace the vision package with fakes. The real model was only exercised by hand.

## Data rules

- Event types: `face_missing`, `multiple_faces`, `looking_away`, `phone_detected`, `tab_switch`. Severity comes from `SEVERITY_BY_EVENT_TYPE` in `vision_adapter.py`: `face_missing` warning, `multiple_faces` high, `looking_away` info, `phone_detected` high, `tab_switch` warning. This mapping is a first guess awaiting the lead.
- `details` holds `source` (`vision` or `browser`), `duration_seconds` and `confidence`. For browser events `duration_seconds` is the reported number (or `null`) and `confidence` is `null`.
- Consent is stored once as `ExamAttempt.consent_given_at` (a resumed attempt keeps the first time) and is not shown in any API.
- Snapshots are written with `default_storage` under `proctoring/<workspace_id>/<attempt_id>/<uuid>.<ext>` in the private media root. `storage_key` never appears in an API response and nothing is served through `MEDIA_URL`.
- Events saved when an attempt closes have no snapshot (there is no current frame).
- Retention: `PROCTORING_EVIDENCE_RETENTION_DAYS` (default 30) sets `retention_expires_at`; `manage.py clean_proctoring_evidence [--dry-run]` removes expired files and rows and keeps the events.

## Not built

- Video, screen and audio evidence.
- A background worker, and a shared (Redis) session store for several workers.
- Automatic verdicts, and the assistant role.
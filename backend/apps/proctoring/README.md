# Proctoring app

Proctoring produces **signals for staff review**, never an automatic cheating verdict (design section 1). The code never writes `violation` or changes `ExamAttempt.proctoring_review_status`; only a teacher decides.

## What exists (Stage 9)

| Part | File | Owner |
|---|---|---|
| Models `ProctoringEvent` (5.22), `ProctoringEvidence` (5.23), admin, migration `0001` | `models.py`, `admin.py`, `migrations/` | A |
| Services: `record_consent`, `record_event`, `save_snapshot`, `process_frame`, `finish_attempt`, `finish_proctoring_safely` | `services.py` | A |
| Close hook: `_close_attempt` in `assessments/attempt_services.py` calls `finish_proctoring_safely` after commit, only for exams with `proctoring_enabled` | `assessments/attempt_services.py` | A |
| Vision adapter (fake backend only), severity map, frame and browser-event endpoints, throttles | `vision_adapter.py`, `student_*.py`, `throttles.py` | B |
| Teacher endpoints, review service, retention command | `teacher_*.py`, `review_services.py`, `management/commands/clean_proctoring_evidence.py` | C |

## Teacher endpoints (`/api/v1/workspaces/{slug}/`, workspace teacher only)

| Method and path | Purpose |
|---|---|
| `GET attempts/{id}/proctoring/events/` | Paginated events of one attempt; filters `review_status`, `event_type`, `severity` (invalid value: 400) |
| `GET proctoring/events/{id}/` | One event with its `evidence` list `{id, evidence_type, mime_type, file_url}` |
| `POST proctoring/events/{id}/review/` | Body `{"review_status": "dismissed" or "violation"}`; the server sets reviewer and time; a second review returns 409 |
| `GET proctoring/evidence/{id}/file/` | Streams a snapshot; `file_url` is this route, never the storage key |

Every query is scoped to the URL workspace. An id from another workspace returns 404; students, pending students, anonymous users and other workspaces' teachers are refused.

## Data rules

- Event types: `face_missing`, `multiple_faces`, `looking_away`, `phone_detected`, `tab_switch`. Severity comes from `SEVERITY_BY_EVENT_TYPE` in `vision_adapter.py`: `face_missing` warning, `multiple_faces` high, `looking_away` info, `phone_detected` high, `tab_switch` warning. This mapping is a first guess awaiting the lead.
- `details` holds `duration_seconds` and `confidence` (both `null` for browser events).
- Consent is stored once as `ExamAttempt.consent_given_at` (a resumed attempt keeps the first time) and is not shown in any API.
- Snapshots are written with `default_storage` under `proctoring/<workspace_id>/<attempt_id>/<uuid>.<ext>` in the private media root. `storage_key` never appears in an API response and nothing is served through `MEDIA_URL`.
- Events saved when an attempt closes have no snapshot (there is no current frame).
- Retention: `PROCTORING_EVIDENCE_RETENTION_DAYS` (default 30) sets `retention_expires_at`; `manage.py clean_proctoring_evidence [--dry-run]` removes expired files and rows and keeps the events.

## Not built

- The real vision backend. Only `PROCTORING_VISION_BACKEND=fake` exists; it detects nothing.
- Video, screen and audio evidence, a background worker, automatic verdicts, the assistant role.

# Requirements Document

## Introduction

Kết nối frontend Element IQ (React/TypeScript) với Supabase Auth và FastAPI backend thật, thay thế toàn bộ dữ liệu hardcoded hiện tại. Sau khi hoàn thành, UI sẽ hiển thị dữ liệu thực từ database (projects, files, analysis results) và user profile từ Supabase Auth session.

## Glossary

- **Frontend**: Ứng dụng React 19 (element-iq-ui) chạy trên port 3000, proxy API qua server.ts
- **Backend_API**: FastAPI server (element-iq-server) chạy trên port 8000, cung cấp REST endpoints tại `/api/v1/*`
- **Supabase_Auth**: Dịch vụ xác thực của Supabase, cung cấp JWT access token cho mỗi user session
- **Auth_Context**: React context (`src/lib/auth-context.tsx`) quản lý user session state
- **authFetch**: Helper function (`src/lib/supabase.ts`) tự động gắn JWT Bearer token vào mọi API request
- **ProjectDashboard**: Component hiển thị danh sách projects của user
- **Sidebar_UserPanel**: Phần hiển thị username và email ở bottom-left của sidebar trong ProjectDashboard
- **Drawing_File**: File PDF được upload lên hệ thống, metadata lưu trong bảng `drawing_files`
- **Analysis_Job**: Một lần chạy phân tích trên file PDF, metadata lưu trong bảng `jobs`

## Requirements

### Requirement 1: User Profile Display

**User Story:** As a logged-in user, I want to see my real username and email from Supabase Auth session displayed in the UI, so that I know I am logged in with the correct account.

#### Acceptance Criteria

1. WHEN a user successfully authenticates, THE Sidebar_UserPanel SHALL display the username from Supabase Auth user metadata (`user.user_metadata.username`)
2. WHEN a user successfully authenticates, THE Sidebar_UserPanel SHALL display the email from Supabase Auth session (`user.email`)
3. WHEN the username metadata is not available, THE Sidebar_UserPanel SHALL display the email prefix as fallback username
4. WHEN a user successfully authenticates, THE ProjectDashboard welcome heading SHALL display the user email or username instead of hardcoded text

### Requirement 2: Sign Out

**User Story:** As a logged-in user, I want to sign out of the application, so that I can end my session securely.

#### Acceptance Criteria

1. WHEN the user clicks the user panel area in the Sidebar_UserPanel, THE Frontend SHALL display a dropdown menu with a sign-out option
2. WHEN the user clicks the sign-out option, THE Frontend SHALL call Supabase Auth signOut and clear all local session state
3. WHEN sign-out completes, THE Frontend SHALL redirect the user to the LoginPage

### Requirement 3: Projects CRUD — List Projects

**User Story:** As a logged-in user, I want to see my real projects loaded from the database, so that I can work with my actual project data.

#### Acceptance Criteria

1. WHEN the ProjectDashboard mounts, THE Frontend SHALL call `GET /api/v1/projects` using authFetch to retrieve the user's projects
2. WHILE the projects are loading, THE ProjectDashboard SHALL display a loading skeleton or spinner
3. IF the API request fails, THEN THE ProjectDashboard SHALL display an error message with a retry button
4. WHEN projects are loaded successfully, THE ProjectDashboard SHALL render each project with its name, description, and created_at timestamp
5. WHEN the user has zero projects, THE ProjectDashboard SHALL display an empty state message encouraging project creation

### Requirement 4: Projects CRUD — Create Project

**User Story:** As a logged-in user, I want to create a new project that persists to the database, so that I can organize my drawing files.

#### Acceptance Criteria

1. WHEN the user submits the Create Project form, THE Frontend SHALL call `POST /api/v1/projects` using authFetch with the project name and optional description
2. WHEN the Backend_API returns a successful response, THE ProjectDashboard SHALL add the new project to the displayed list without a full page reload
3. IF the Backend_API returns a validation error, THEN THE Frontend SHALL display the error message to the user in the Create Project modal

### Requirement 5: Projects CRUD — Edit Project

**User Story:** As a project owner, I want to rename or update my project description, so that I can keep project information current.

#### Acceptance Criteria

1. WHEN the user submits the Edit Project form, THE Frontend SHALL call `PATCH /api/v1/projects/{id}` using authFetch with the updated fields
2. WHEN the Backend_API returns a successful response, THE ProjectDashboard SHALL update the project in the displayed list without a full page reload
3. IF the Backend_API returns a 404 error, THEN THE Frontend SHALL display a "Project not found" error message

### Requirement 6: Projects CRUD — Delete Project

**User Story:** As a project owner, I want to delete a project I no longer need, so that I can keep my workspace clean.

#### Acceptance Criteria

1. WHEN the user clicks the delete button on a project, THE Frontend SHALL display a confirmation dialog before proceeding
2. WHEN the user confirms deletion, THE Frontend SHALL call `DELETE /api/v1/projects/{id}` using authFetch
3. WHEN the Backend_API returns a successful response, THE ProjectDashboard SHALL remove the project from the displayed list without a full page reload
4. IF the Backend_API returns a 404 error, THEN THE Frontend SHALL display a "Project not found" error message

### Requirement 7: Files Management — Upload PDF

**User Story:** As a logged-in user, I want to upload PDF drawing files via the backend API, so that the files are stored on the server and tracked in the database.

#### Acceptance Criteria

1. WHEN the user selects a PDF file for upload, THE Frontend SHALL call `POST /api/v1/files` using authFetch with the file as multipart form data
2. WHILE the upload is in progress, THE Frontend SHALL display an upload progress indicator
3. WHEN the Backend_API returns a successful response with `file_id`, THE Frontend SHALL add the file to the session file list
4. IF the Backend_API returns a 413 error, THEN THE Frontend SHALL display "File exceeds 100 MB limit"
5. IF the Backend_API returns a 415 error, THEN THE Frontend SHALL display "Only PDF files are supported"
6. WHEN the Backend_API returns `duplicate: true`, THE Frontend SHALL inform the user that the file already exists and use the existing file_id

### Requirement 8: Files Management — List Files

**User Story:** As a logged-in user, I want to see all my uploaded files loaded from the database, so that I can select files for analysis.

#### Acceptance Criteria

1. WHEN the user opens a project in the editor view, THE Frontend SHALL call `GET /api/v1/files` using authFetch to retrieve the user's files
2. WHEN files are loaded successfully, THE Frontend SHALL display each file with its original filename, file size, and upload timestamp
3. IF the API request fails, THEN THE Frontend SHALL display an error notification

### Requirement 9: Files Management — File Status

**User Story:** As a logged-in user, I want to see the analysis status of each file, so that I can track which files have been analyzed.

#### Acceptance Criteria

1. WHEN files are loaded, THE Frontend SHALL call `GET /api/v1/files/{id}` using authFetch to retrieve file details including versions
2. THE Frontend SHALL display the latest analysis status (PENDING, ANALYZING, PASS, FAIL, WARN) for each file based on the most recent job status

### Requirement 10: Analysis Integration — Submit Analysis with Auth

**User Story:** As a logged-in user, I want to submit files for analysis with my JWT token, so that results are linked to my account in the database.

#### Acceptance Criteria

1. WHEN the user triggers analysis on a file, THE Frontend SHALL call `POST /api/v1/analyze/re-run` using authFetch with the file_id, selected components, and analysis config
2. WHEN the Backend_API returns a job_id and status_url, THE Frontend SHALL poll `GET /api/v1/jobs/{job_id}` using authFetch to track progress
3. WHILE the job status is PENDING or PROCESSING, THE Frontend SHALL display the progress percentage and stage description from the job response
4. WHEN the job status becomes COMPLETED, THE Frontend SHALL render the detection results on the drawing view

### Requirement 11: Analysis Integration — Load History

**User Story:** As a logged-in user, I want to view the analysis history of a file, so that I can compare results across different analysis runs.

#### Acceptance Criteria

1. WHEN the user views a file's analysis history, THE Frontend SHALL call `GET /api/v1/files/{id}/history` using authFetch
2. WHEN history items are loaded, THE Frontend SHALL display each analysis run with its status, components analyzed, and timestamp
3. WHEN the user selects a history item, THE Frontend SHALL load the corresponding job result via `GET /api/v1/jobs/{job_id}` using authFetch

### Requirement 12: Real-time Data in ProjectDashboard

**User Story:** As a logged-in user, I want the ProjectDashboard to always show live data from the API, so that changes made elsewhere are reflected.

#### Acceptance Criteria

1. THE ProjectDashboard SHALL load projects from the Backend_API on every mount, replacing all hardcoded mock data
2. WHEN a CRUD operation succeeds, THE ProjectDashboard SHALL optimistically update the local state and reconcile with the server response
3. THE Frontend SHALL map Backend_API project fields (`id`, `name`, `description`, `is_archived`, `created_at`) to the UI display format

### Requirement 13: Backend Projects API (New Endpoints)

**User Story:** As a frontend developer, I want CRUD endpoints for projects, so that the UI can manage projects via the API.

#### Acceptance Criteria

1. THE Backend_API SHALL provide `GET /api/v1/projects` that returns all non-archived projects owned by the authenticated user
2. THE Backend_API SHALL provide `POST /api/v1/projects` that creates a new project with name and optional description, setting owner_id from the JWT
3. THE Backend_API SHALL provide `PATCH /api/v1/projects/{id}` that updates name or description for a project owned by the authenticated user
4. THE Backend_API SHALL provide `DELETE /api/v1/projects/{id}` that soft-deletes (archives) a project owned by the authenticated user
5. IF an unauthenticated request is made to any projects endpoint, THEN THE Backend_API SHALL return a 401 Unauthorized response

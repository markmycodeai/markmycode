# Tasks: Replace IDs with Proper Names

The goal is to ensure that nowhere in the UI are unique IDs (UUIDs) displayed to the user. Instead, the corresponding human-readable names (College Name, Department Name, Batch Name, Topic Name) should be shown.

## 1. Admin Module (`js/admin.js`)
- [ ] Check `renderStudents` (or equivalent) - Ensure College, Dept, Batch are names.
- [ ] Check `renderBatches` - Ensure Dept ID is Dept Name.
- [ ] Check `renderDepartments` - Ensure College ID is College Name.

## 2. Questions Module (`js/questions-rbac.js`)
- [ ] List View: Verify `college_id`, `department_id`, `batch_id`, `topic_id` are converted.
- [ ] Table View: Verify columns show names.

## 3. Student Module (`js/student.js` / `js/student-profile.js`)
- [ ] Profile Header/Hierarchy: Ensure "College: <ID>" is "College: <Name>".

## 4. Hierarchy Dashboards (`js/college.js`, `js/department.js`, `js/batch.js`)
- [ ] `js/college.js`: Check Dept list, Student list.
- [ ] `js/department.js`: Check Batch list, Student list.
- [ ] `js/batch.js`: Check Student list.

## 5. Notes & Topics (`js/admin-notes.js`, `js/admin-topics.js`)
- [ ] Check Topic Lists (often show `batch_id` or `department_id`).
- [ ] Check Note Lists (often show `topic_id`).

"use client";

import { useEffect, useMemo, useState } from "react";
import "./school.css";

type Role = "student" | "teacher" | "parent";
type SchoolClass = { id: string; name: string; teacher: string; inviteCode: string };
type Student = { id: string; name: string; classId: string; parentName?: string; parentCode: string; streak: number; stars: number };
type Assignment = {
  id: string;
  classId: string;
  studentId?: string;
  title: string;
  reference: string;
  due: string;
  instructions: string;
  status: "assigned" | "in-progress" | "submitted" | "reviewed";
  practiceCount: number;
  bestScore?: number;
  teacherFeedback?: string;
  createdAt: number;
};
type SchoolState = { classes: SchoolClass[]; students: Student[]; assignments: Assignment[] };

const STORAGE_KEY = "hassoun-quran-school-v1";
const ROLE_KEY = "hassoun-quran-school-role";
const EMPTY: SchoolState = { classes: [], students: [], assignments: [] };

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function readState(): SchoolState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as SchoolState;
    return {
      classes: Array.isArray(parsed.classes) ? parsed.classes : [],
      students: Array.isArray(parsed.students) ? parsed.students : [],
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
    };
  } catch {
    return EMPTY;
  }
}

function referenceKeys(reference: string) {
  const cleaned = reference.trim();
  const single = cleaned.match(/^(\d{1,3}):(\d{1,3})$/);
  if (single) return [`${Number(single[1])}:${Number(single[2])}`];
  const range = cleaned.match(/^(\d{1,3}):(\d{1,3})\s*[-–]\s*(?:(\d{1,3}):)?(\d{1,3})$/);
  if (!range) return [];
  const startSurah = Number(range[1]);
  const startAyah = Number(range[2]);
  const endSurah = range[3] ? Number(range[3]) : startSurah;
  const endAyah = Number(range[4]);
  if (startSurah !== endSurah || endAyah < startAyah || endAyah - startAyah > 100) return [];
  return Array.from({ length: endAyah - startAyah + 1 }, (_, index) => `${startSurah}:${startAyah + index}`);
}

export default function QuranSchoolPage() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role>("student");
  const [state, setState] = useState<SchoolState>(EMPTY);
  const [activeClass, setActiveClass] = useState("");
  const [activeStudent, setActiveStudent] = useState("");
  const [className, setClassName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [parentName, setParentName] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentReference, setAssignmentReference] = useState("");
  const [assignmentDue, setAssignmentDue] = useState("");
  const [assignmentInstructions, setAssignmentInstructions] = useState("");

  useEffect(() => {
    setState(readState());
    const savedRole = window.localStorage.getItem(ROLE_KEY) as Role | null;
    if (savedRole === "student" || savedRole === "teacher" || savedRole === "parent") setRole(savedRole);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(ROLE_KEY, role);
  }, [role, ready]);

  useEffect(() => {
    if (!activeClass && state.classes[0]) setActiveClass(state.classes[0].id);
    if (!activeStudent && state.students[0]) setActiveStudent(state.students[0].id);
  }, [state.classes, state.students, activeClass, activeStudent]);

  const currentClass = state.classes.find((item) => item.id === activeClass) || null;
  const currentStudent = state.students.find((item) => item.id === activeStudent) || null;
  const classStudents = state.students.filter((item) => item.classId === activeClass);
  const visibleAssignments = useMemo(() => {
    if (role === "teacher") return state.assignments.filter((item) => !activeClass || item.classId === activeClass);
    if (!currentStudent) return [];
    return state.assignments.filter((item) => item.classId === currentStudent.classId && (!item.studentId || item.studentId === currentStudent.id));
  }, [state.assignments, role, activeClass, currentStudent]);

  const completed = visibleAssignments.filter((item) => item.status === "reviewed" || item.status === "submitted").length;
  const best = visibleAssignments.reduce((value, item) => Math.max(value, item.bestScore || 0), 0);

  const createClass = () => {
    const name = className.trim();
    const teacher = teacherName.trim() || "Teacher";
    if (!name) return;
    const item: SchoolClass = { id: id("class"), name, teacher, inviteCode: code() };
    setState((value) => ({ ...value, classes: [item, ...value.classes] }));
    setActiveClass(item.id);
    setClassName("");
  };

  const addStudent = () => {
    const name = studentName.trim();
    if (!name || !activeClass) return;
    const item: Student = { id: id("student"), name, classId: activeClass, parentName: parentName.trim() || undefined, parentCode: code(), streak: 0, stars: 0 };
    setState((value) => ({ ...value, students: [item, ...value.students] }));
    setActiveStudent(item.id);
    setStudentName("");
    setParentName("");
  };

  const createAssignment = () => {
    if (!activeClass || !assignmentTitle.trim() || !assignmentReference.trim()) return;
    const item: Assignment = {
      id: id("assignment"),
      classId: activeClass,
      title: assignmentTitle.trim(),
      reference: assignmentReference.trim(),
      due: assignmentDue,
      instructions: assignmentInstructions.trim(),
      status: "assigned",
      practiceCount: 0,
      createdAt: Date.now(),
    };
    setState((value) => ({ ...value, assignments: [item, ...value.assignments] }));
    setAssignmentTitle("");
    setAssignmentReference("");
    setAssignmentDue("");
    setAssignmentInstructions("");
  };

  const practiceAssignment = (assignment: Assignment) => {
    const keys = referenceKeys(assignment.reference);
    if (keys.length) window.localStorage.setItem("wopt-quran-memorize-selection", JSON.stringify(keys));
    setState((value) => ({
      ...value,
      assignments: value.assignments.map((item) => item.id === assignment.id ? { ...item, status: "in-progress", practiceCount: item.practiceCount + 1 } : item),
      students: value.students.map((student) => student.id === activeStudent ? { ...student, streak: student.streak + 1, stars: student.stars + 1 } : student),
    }));
    window.location.assign("/quran");
  };

  const submitAssignment = (assignmentId: string) => {
    setState((value) => ({ ...value, assignments: value.assignments.map((item) => item.id === assignmentId ? { ...item, status: "submitted" } : item) }));
  };

  const reviewAssignment = (assignmentId: string, score: number, feedback: string) => {
    setState((value) => ({ ...value, assignments: value.assignments.map((item) => item.id === assignmentId ? { ...item, status: "reviewed", bestScore: score, teacherFeedback: feedback } : item) }));
  };

  if (!ready) return <main className="school-loading">Loading Qur’an School…</main>;

  return (
    <main className="school-app">
      <header className="school-header">
        <a href="/" className="school-brand"><img src="/hassoun-logo.png?v=20260824-4" alt="Hassoun" /><div><small>HASSOUN</small><strong>Qur’an School</strong></div></a>
        <div className="school-header-actions"><a href="/quran">Open Qur’an</a><a href="/">Today</a></div>
      </header>

      <section className="school-hero">
        <div><span className="school-kicker">AL-HAFIZ • SCHOOL & MEMORIZATION</span><h1>One Qur’an school for students, teachers and parents.</h1><p>Assignments, memorization practice, recitation progress, teacher feedback and family follow-up in one calm experience.</p></div>
        <img src="/hassoun-logo.png?v=20260824-4" alt="Hassoun Qur’an School" />
      </section>

      <nav className="role-tabs" aria-label="School role">
        <button className={role === "student" ? "active" : ""} onClick={() => setRole("student")}>🎒 Student</button>
        <button className={role === "teacher" ? "active" : ""} onClick={() => setRole("teacher")}>🍎 Teacher</button>
        <button className={role === "parent" ? "active" : ""} onClick={() => setRole("parent")}>👨‍👩‍👧 Parent</button>
      </nav>

      {role === "teacher" && (
        <div className="school-grid teacher-grid">
          <section className="school-panel">
            <div className="panel-head"><div><span>TEACHER DESK</span><h2>Classes</h2></div><b>{state.classes.length}</b></div>
            <div className="form-stack"><input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class name" /><input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Teacher name" /><button onClick={createClass}>+ Create class</button></div>
            <div className="item-list">{state.classes.map((item) => <button className={activeClass === item.id ? "selected" : ""} key={item.id} onClick={() => setActiveClass(item.id)}><div><strong>{item.name}</strong><small>{item.teacher} · Code {item.inviteCode}</small></div><span>›</span></button>)}{!state.classes.length && <p className="empty-copy">Create your first Qur’an class.</p>}</div>
          </section>

          <section className="school-panel">
            <div className="panel-head"><div><span>CLASS ROSTER</span><h2>{currentClass?.name || "Students"}</h2></div><b>{classStudents.length}</b></div>
            <div className="form-stack"><input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Student name" disabled={!activeClass} /><input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Parent name (optional)" disabled={!activeClass} /><button onClick={addStudent} disabled={!activeClass}>+ Add student</button></div>
            <div className="student-cards">{classStudents.map((student) => <article key={student.id}><div className="avatar">{student.name.slice(0, 1).toUpperCase()}</div><div><strong>{student.name}</strong><small>Parent code {student.parentCode}</small><p>🔥 {student.streak} practice · ⭐ {student.stars}</p></div></article>)}{activeClass && !classStudents.length && <p className="empty-copy">No students added yet.</p>}</div>
          </section>

          <section className="school-panel assignment-builder">
            <div className="panel-head"><div><span>ASSIGNMENT BOARD</span><h2>Create homework</h2></div></div>
            <div className="form-stack"><input value={assignmentTitle} onChange={(e) => setAssignmentTitle(e.target.value)} placeholder="Assignment title" disabled={!activeClass} /><input value={assignmentReference} onChange={(e) => setAssignmentReference(e.target.value)} placeholder="Qur’an reference, e.g. 67:1-5" disabled={!activeClass} /><input type="date" value={assignmentDue} onChange={(e) => setAssignmentDue(e.target.value)} disabled={!activeClass} /><textarea value={assignmentInstructions} onChange={(e) => setAssignmentInstructions(e.target.value)} placeholder="Teacher instructions" disabled={!activeClass} /><button onClick={createAssignment} disabled={!activeClass}>Assign to class</button></div>
          </section>

          <section className="school-panel assignment-list-panel">
            <div className="panel-head"><div><span>REVIEW CENTER</span><h2>Assignments & feedback</h2></div></div>
            <div className="assignment-list">{visibleAssignments.map((assignment) => <TeacherAssignment key={assignment.id} assignment={assignment} onReview={reviewAssignment} />)}{!visibleAssignments.length && <p className="empty-copy">Assignments will appear here for review.</p>}</div>
          </section>
        </div>
      )}

      {(role === "student" || role === "parent") && (
        <>
          <section className="profile-strip">
            <label><span>{role === "student" ? "Student profile" : "Child"}</span><select value={activeStudent} onChange={(e) => setActiveStudent(e.target.value)}><option value="">Choose</option>{state.students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
            {currentStudent && <div className="profile-name"><div className="avatar large">{currentStudent.name.slice(0,1).toUpperCase()}</div><div><strong>{currentStudent.name}</strong><small>{state.classes.find((item) => item.id === currentStudent.classId)?.name || "Qur’an School"}</small></div></div>}
          </section>

          {currentStudent ? <>
            <section className="summary-cards"><article><span>📘</span><strong>{visibleAssignments.length}</strong><small>Assignments</small></article><article><span>✅</span><strong>{completed}</strong><small>Completed</small></article><article><span>🔥</span><strong>{currentStudent.streak}</strong><small>Practice streak</small></article><article><span>⭐</span><strong>{role === "student" ? currentStudent.stars : best || "—"}</strong><small>{role === "student" ? "Stars" : "Best score"}</small></article></section>

            <section className="school-panel wide-panel">
              <div className="panel-head"><div><span>{role === "student" ? "MY LEARNING" : "FAMILY VIEW"}</span><h2>{role === "student" ? "My assignments" : `${currentStudent.name}'s assignments`}</h2></div></div>
              <div className="assignment-list">{visibleAssignments.map((assignment) => <article className="assignment-card" key={assignment.id}><div className="assignment-main"><div><span className={`status ${assignment.status}`}>{assignment.status.replace("-", " ")}</span><h3>{assignment.title}</h3><strong className="reference">{assignment.reference}</strong>{assignment.due && <small>Due {new Date(`${assignment.due}T12:00:00`).toLocaleDateString()}</small>}{assignment.instructions && <p>{assignment.instructions}</p>}</div><div className="assignment-score">{assignment.bestScore != null ? <><strong>{assignment.bestScore}%</strong><span>Teacher score</span></> : <><strong>{assignment.practiceCount}</strong><span>Practices</span></>}</div></div>{assignment.teacherFeedback && <div className="teacher-feedback"><b>🍎 Teacher feedback</b><p>{assignment.teacherFeedback}</p></div>}{role === "student" && <div className="assignment-actions"><button onClick={() => practiceAssignment(assignment)}>▶ Practice in Qur’an</button><button className="secondary" onClick={() => submitAssignment(assignment.id)}>✓ Submit for review</button></div>}</article>)}{!visibleAssignments.length && <p className="empty-copy">No assignments yet. Your teacher’s work will appear here.</p>}</div>
            </section>

            {role === "parent" && <section className="parent-note"><div>👨‍👩‍👧</div><div><strong>Parent connection</strong><p>Linked to {currentStudent.name}. Parent code: <b>{currentStudent.parentCode}</b>. You can follow assignments, practice activity, scores and teacher feedback from this dashboard.</p></div></section>}
          </> : <section className="school-panel wide-panel"><p className="empty-copy">A teacher needs to add the student first. Then select the student above.</p></section>}
        </>
      )}

      <footer className="school-footer"><img src="/hassoun-logo.png?v=20260824-4" alt="Hassoun" /><p>Hassoun Qur’an School supports practice and family follow-up. A qualified Qur’an teacher remains the best source for precise tajweed and recitation correction.</p></footer>
    </main>
  );
}

function TeacherAssignment({ assignment, onReview }: { assignment: Assignment; onReview: (id: string, score: number, feedback: string) => void }) {
  const [score, setScore] = useState(assignment.bestScore != null ? String(assignment.bestScore) : "");
  const [feedback, setFeedback] = useState(assignment.teacherFeedback || "");
  return <article className="assignment-card"><div className="assignment-main"><div><span className={`status ${assignment.status}`}>{assignment.status.replace("-", " ")}</span><h3>{assignment.title}</h3><strong className="reference">{assignment.reference}</strong>{assignment.due && <small>Due {new Date(`${assignment.due}T12:00:00`).toLocaleDateString()}</small>}{assignment.instructions && <p>{assignment.instructions}</p>}</div><div className="assignment-score"><strong>{assignment.practiceCount}</strong><span>Practices</span></div></div><div className="review-form"><input type="number" min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} placeholder="Score %" /><input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Teacher feedback" /><button onClick={() => onReview(assignment.id, Math.max(0, Math.min(100, Number(score) || 0)), feedback.trim())}>Save review</button></div></article>;
}

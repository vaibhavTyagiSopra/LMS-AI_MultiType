import React, { useState } from "react";

const API = import.meta.env.VITE_API_BASE || "http://localhost:3000";
const HEADERS = {
  "Content-Type": "application/json",
  // set only if you enabled SERVER_SHARED_KEY in API:
  // "x-faas-key": "changeme"
};

const sampleQuiz = {
  question: "What is the primary driver of recent global climate change?",
  reference: "Increased greenhouse gas concentrations (especially CO2) from human activities.",
};

const sampleMcq = {
  question: "Which of the following are greenhouse gases?",
  options: ["Oxygen (O2)", "Carbon Dioxide (CO2)", "Methane (CH4)", "Nitrogen (N2)"],
  correct: [1,2], // B and C
};

const sampleCode = {
  language: "javascript",
  source: `export function sum(arr){ 
  // returns sum; fails on non-numbers
  return arr.reduce((a,b)=>a+b,0);
}`
};

export default function App() {
  const [type, setType] = useState("essay");
  const [audience, setAudience] = useState("student");
  const [text, setText] = useState("Write a short paragraph about climate change impacts on cities.");
  const [quizAns, setQuizAns] = useState("Greenhouse gases like CO2 trap heat.");
  const [mcqSelected, setMcqSelected] = useState([]);
  const [codeText, setCodeText] = useState(sampleCode.source);

  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const send = async (body) => {
    setBusy(true);
    setResult(null);
    const res = await fetch(`${API}/api/feedback`, {
      method: "POST", headers: HEADERS, body: JSON.stringify(body)
    });
    const json = await res.json();
    setResult(json);
    setBusy(false);
  };

  const handleSubmit = async () => {
    if (type === "essay") {
      return send({
        type, audience,
        courseId: "COURSE-101", learnerId: "demo-learner",
        rubricId: "demo_rubric_1",
        payload: { text }
      });
    }
    if (type === "quiz") {
      return send({
        type, audience, courseId: "COURSE-101", learnerId: "demo-learner",
        rubricId: "demo_rubric_1",
        payload: { question: sampleQuiz.question, answer: quizAns, reference: sampleQuiz.reference }
      });
    }
    if (type === "mcq") {
      return send({
        type, audience, courseId: "COURSE-101", learnerId: "demo-learner",
        rubricId: "demo_rubric_1",
        payload: {
          question: sampleMcq.question,
          options: sampleMcq.options,
          selected: mcqSelected.sort(),
          correct: sampleMcq.correct
        }
      });
    }
    if (type === "code") {
      return send({
        type, audience, courseId: "COURSE-101", learnerId: "demo-learner",
        rubricId: "demo_rubric_1",
        payload: { language: "javascript", source: codeText }
      });
    }
  };

  const toggleChoice = (idx) => {
    setMcqSelected(prev => prev.includes(idx) ? prev.filter(i=>i!==idx) : [...prev, idx]);
  };

  return (
    <div style={{ maxWidth: 900, margin: "32px auto", fontFamily: "system-ui, Arial" }}>
      <h1>Feedback as a Service — Multi-Type Demo</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label>Type:{" "}
          <select value={type} onChange={e=>setType(e.target.value)}>
            <option value="essay">Essay</option>
            <option value="quiz">Quiz (short answer)</option>
            <option value="mcq">MCQ</option>
            <option value="code">Programming / Code</option>
          </select>
        </label>
        <label>Audience:{" "}
          <select value={audience} onChange={e=>setAudience(e.target.value)}>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>
        </label>
        <button onClick={handleSubmit} disabled={busy}>
          {busy ? "Working..." : "Get AI Feedback"}
        </button>
      </div>

      <div style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        {type === "essay" && (
          <>
            <h3>Essay</h3>
            <textarea style={{ width: "100%", height: 160 }} value={text} onChange={e=>setText(e.target.value)} />
          </>
        )}

        {type === "quiz" && (
          <>
            <h3>Quiz — Short Answer</h3>
            <p><b>Q:</b> {sampleQuiz.question}</p>
            <p><i>Reference (hidden from student in real app): {sampleQuiz.reference}</i></p>
            <textarea style={{ width: "100%", height: 100 }} value={quizAns} onChange={e=>setQuizAns(e.target.value)} />
          </>
        )}

        {type === "mcq" && (
          <>
            <h3>MCQ</h3>
            <p><b>Q:</b> {sampleMcq.question}</p>
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {sampleMcq.options.map((opt, i) => (
                <li key={i}>
                  <label>
                    <input type="checkbox" checked={mcqSelected.includes(i)} onChange={()=>toggleChoice(i)} />{" "}
                    {String.fromCharCode(65+i)}. {opt}
                  </label>
                </li>
              ))}
            </ul>
            <small><i>Correct: {sampleMcq.correct.map(i=>String.fromCharCode(65+i)).join(", ")}</i></small>
          </>
        )}

        {type === "code" && (
          <>
            <h3>Programming / Code (JavaScript)</h3>
            <textarea style={{ width: "100%", height: 180, fontFamily: "monospace" }}
                      value={codeText} onChange={e=>setCodeText(e.target.value)} />
          </>
        )}
      </div>

      {result && (
        <div style={{ marginTop: 16 }}>
          <h3>AI Feedback</h3>
          <pre style={{ background:"#111", color:"#0f0", padding:12, borderRadius:8 }}>
{JSON.stringify(result.feedback, null, 2)}
          </pre>
          <small>Type: {result.type} • Audience: {result.audience} • Model: {result.model} • Latency: {result.latencyMs}ms</small>
        </div>
      )}
    </div>
  );
}

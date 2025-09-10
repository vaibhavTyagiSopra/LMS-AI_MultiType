import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { getConnection, exec } from "./snowflake.js";
import { buildPrompt } from "./prompt.js";

const app = express();
app.use(express.json({ limit: "4mb" }));
app.use(cors());

// Simple shared key auth (optional)
app.use((req, res, next) => {
  const expected = process.env.SERVER_SHARED_KEY;
  if (!expected) return next();
  if (req.header("x-faas-key") !== expected) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const feedbackRequestSchema = z.object({
  type: z.enum(["essay","quiz","mcq","code"]),
  audience: z.enum(["student","instructor"]).default("student"),
  courseId: z.string().default("COURSE-101"),
  learnerId: z.string().default("demo-learner"),
  rubricId: z.string().default("demo_rubric_1"),
  payload: z.union([
    z.object({ text: z.string().min(10) }),                                             // essay
    z.object({ question: z.string(), answer: z.string(), reference: z.string() }),      // quiz
    z.object({ question: z.string(), options: z.array(z.string()).min(2),
               selected: z.array(z.number().int().nonnegative()),
               correct: z.array(z.number().int().nonnegative()) }),                     // mcq
    z.object({ language: z.string(), source: z.string().min(1) })                       // code
  ])
});

app.get("/api/health", (_, res) => res.json({ ok: true }));

// Fetch rubric (helper)
async function loadRubric(conn, rubricId) {
  const rows = await exec(conn, `SELECT RUBRIC_ID, TITLE, CRITERIA FROM RUBRICS WHERE RUBRIC_ID = ? LIMIT 1;`, [rubricId]);
  if (!rows?.length) throw new Error("Rubric not found");
  return { rubricId: rows[0].RUBRIC_ID, title: rows[0].TITLE, criteria: rows[0].CRITERIA };
}

app.post("/api/feedback", async (req, res) => {
  try {
    const inReq = feedbackRequestSchema.parse(req.body);
    const conn = await getConnection();
    const rubric = await loadRubric(conn, inReq.rubricId);

    // store submission
    const submissionId = uuid();
    await exec(conn,
  `INSERT INTO SUBMISSIONS (SUBMISSION_ID, LEARNER_ID, COURSE_ID, TYPE, CONTENT)
   SELECT ?, ?, ?, ?, TRY_PARSE_JSON(?);`,
  [submissionId, inReq.learnerId, inReq.courseId, inReq.type, JSON.stringify(inReq.payload)]
);


    // build prompt and call LLM
    const prompt = buildPrompt({ type: inReq.type, audience: inReq.audience, payload: inReq.payload, rubric });
    const t0 = Date.now();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });
    const latency = Date.now() - t0;

    // parse JSON output
    let ai;
    try {
      const raw = completion.choices[0].message.content.trim();
      const json = raw.startsWith("{") ? raw : raw.slice(raw.indexOf("{"));
      ai = JSON.parse(json);
    } catch {
      ai = { note: "fallback", strengths: "", improvements: "", next_actions: [], rubric_scores: {} };
    }

    // For MCQ, compute deterministic correctness too
    let mcqScore = null;
    if (inReq.type === "mcq") {
      const a = new Set(inReq.payload.selected);
      const b = new Set(inReq.payload.correct);
      const same = a.size === b.size && [...a].every(x => b.has(x));
      mcqScore = same ? "correct" : "incorrect";
      ai = { ...ai, correctness: mcqScore };
    }

    // persist feedback
    const feedbackId = uuid();
    await exec(conn,
  `INSERT INTO FEEDBACK (FEEDBACK_ID, SUBMISSION_ID, RUBRIC_ID, AUDIENCE, RAW_JSON, MODEL, LATENCY_MS, SOURCE)
   SELECT ?, ?, ?, ?, TRY_PARSE_JSON(?), ?, ?, 'ai';`,
  [feedbackId, submissionId, rubric.rubricId, inReq.audience, JSON.stringify(ai), "openai:gpt-4o-mini", latency]
);


    res.json({
      submissionId, feedbackId,
      type: inReq.type, audience: inReq.audience,
      model: "openai:gpt-4o-mini", latencyMs: latency,
      feedback: ai
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: String(e?.message || e) });
  }
});

const port = 3000;
app.listen(port, () => console.log(`API up on :${port}`));

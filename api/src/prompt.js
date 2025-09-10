// prompt.js (tightened endings + no code fences)
function rubricToText(criteria = []) {
  return criteria.map(c => `- ${c.name} (${c.weight}%): ${c.description}`).join("\n");
}

export function buildPrompt({ type, audience, payload, rubric }) {
  const rubricText = rubricToText(rubric.criteria);
  const jsonRule = "Return ONLY valid JSON. No markdown, no commentary.";

  if (type === "essay") {
    const role = audience === "instructor"
      ? "Provide rubric-aligned, professional assessment usable by a teacher."
      : "Provide encouraging, plain-language feedback that helps the student improve.";
    return `
You are an expert writing coach. ${role}
Output schema:
{
  "strengths": "string",
  "improvements": "string",
  "next_actions": ["string","string","string"],
  "rubric_scores": {"Clarity":0-5,"Evidence":0-5,"Structure":0-5}
}

Rubric:
${rubricText}

Submission:
${payload.text}

${jsonRule}`.trim();
  }

  if (type === "quiz") {
    const role = audience === "instructor" ? "Be concise and rubric-aligned." : "Be supportive and actionable.";
    return `
You evaluate a short-answer response against a reference answer. ${role}
Output schema:
{
  "correctness": "correct|partial|incorrect",
  "justification": "string",
  "next_actions": ["string"],
  "rubric_scores": {"Accuracy":0-5,"Completeness":0-5}
}

Question: ${payload.question}
Reference answer: ${payload.reference}
Student answer: ${payload.answer}

${jsonRule}`.trim();
  }

  if (type === "mcq") {
    const role = audience === "instructor" ? "Provide concise rationale aligned to rubric." : "Explain simply why the choices are right/wrong.";
    const opts = payload.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join("\n");
    const chosen = payload.selected.map(i => String.fromCharCode(65 + i)).join(", ");
    const correct = payload.correct.map(i => String.fromCharCode(65 + i)).join(", ");
    return `
You explain MCQ outcomes. ${role}
Output schema:
{
  "rationale": "string",
  "next_actions": ["string"]
}

Question: ${payload.question}
Options:
${opts}
Chosen: ${chosen}
Correct: ${correct}

${jsonRule}`.trim();
  }

  if (type === "code") {
    const role = audience === "instructor" ? "Focus on correctness, complexity, readability; map to rubric." : "Give practical suggestions and small examples.";
    return `
You are a senior ${payload.language} mentor. Review the code. ${role}
Output schema:
{
  "strengths": "string",
  "improvements": "string",
  "next_actions": ["string","string","string"],
  "possible_bugs": ["string"],
  "rubric_scores": {"Correctness":0-5,"Readability":0-5,"Efficiency":0-5}
}

Code (${payload.language}):
${payload.source}

${jsonRule}`.trim();
  }

  return `{"note":"unsupported type"}`;
}

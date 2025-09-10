// Builds audience-aware prompts for each type.

function rubricToText(criteria = []) {
  return criteria.map(c => `- ${c.name} (${c.weight}%): ${c.description}`).join("\n");
}

export function buildPrompt({ type, audience, payload, rubric }) {
  const rubricText = rubricToText(rubric.criteria);

  if (type === "essay") {
    const role = audience === "instructor"
      ? "Provide rubric-aligned, professional assessment that a teacher can use."
      : "Provide encouraging, plain-language feedback that helps the student improve.";
    return `
You are an expert writing coach.
${role}
Return STRICT JSON with keys:
strengths (string), improvements (string), next_actions (array of 3 short items), rubric_scores (object of criterion->0..5).

Rubric:
${rubricText}

Submission:
"""${payload.text}"""

JSON ONLY.`;
  }

  if (type === "quiz") {
    const role = audience === "instructor"
      ? "Be concise and rubric-aligned."
      : "Be supportive and actionable.";
    return `
You evaluate a short-answer quiz response against a reference answer.
${role}
Return STRICT JSON: correctness ("correct"|"partial"|"incorrect"), justification (string),
next_actions (array of up to 3), rubric_scores (object of criterion->0..5).

Question: ${payload.question}
Reference answer: ${payload.reference}
Student answer: ${payload.answer}

Rubric:
${rubricText}

JSON ONLY.`;
  }

  if (type === "mcq") {
    // We will compute correctness in API; LLM explains rationale.
    const role = audience === "instructor"
      ? "Provide rationale concise and rubric-aligned."
      : "Explain simply why the chosen options are right/wrong.";
    const opts = payload.options.map((o, i) => `${String.fromCharCode(65+i)}. ${o}`).join("\n");
    const chosen = payload.selected.map(i => String.fromCharCode(65+i)).join(", ");
    const correct = payload.correct.map(i => String.fromCharCode(65+i)).join(", ");
    return `
You explain MCQ results to the specified audience.
${role}
Return STRICT JSON: rationale (string), next_actions (array of up to 3).

Question: ${payload.question}
Options:
${opts}
Chosen: ${chosen}
Correct: ${correct}

Rubric:
${rubricText}

JSON ONLY.`;
  }

  if (type === "code") {
    const role = audience === "instructor"
      ? "Focus on correctness, complexity, readability; map to rubric."
      : "Give practical suggestions and small examples.";
    return `
You are a senior ${payload.language} mentor. Review the code.
${role}
Return STRICT JSON with keys:
strengths (string), improvements (string), next_actions (array of 3 short items),
rubric_scores (object of criterion->0..5), possible_bugs (array of strings, up to 3).

Code (${payload.language}):
\`\`\`${payload.language}
${payload.source}
\`\`\`

Rubric:
${rubricText}

JSON ONLY.`;
  }

  // Fallback
  return "Return JSON: { note: 'unsupported type' }";
}

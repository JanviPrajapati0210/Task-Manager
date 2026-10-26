/**
 * AI Service for Task Management
 * Supports:
 * 1. Google Gemini API (gemini-1.5-flash / gemini-2.0-flash via GEMINI_API_KEY)
 * 2. OpenAI API (gpt-4o-mini via OPENAI_API_KEY)
 * 3. Intelligent Contextual Engine (Graceful fallback when API keys are not set, quota exceeded, or network offline)
 *
 * Requirements:
 * - API keys stored and used strictly on backend (.env), never exposed to frontend
 * - Graceful error and timeout handling (8-second timeout)
 * - Auto-generates structured description, priority level, deadline, and actionable subtasks
 * - Mandatory AI disclaimer
 */

const AI_TIMEOUT_MS = 8000; // 8 seconds timeout
const AI_DISCLAIMER =
  'AI-generated suggestion. Please review and verify accuracy before saving.';

/**
 * Intelligent heuristic fallback engine that parses title semantics
 * and generates high quality task recommendations offline.
 */
function generateContextualFallback(title, existingDesc = '') {
  const cleanTitle = (title || '').trim();
  const lower = cleanTitle.toLowerCase();

  // Determine priority based on urgency indicators
  let priority = 'medium';
  let deadline = 'Within 3 business days';
  let reasoning = 'Standard project deliverable with moderate scope and priority.';

  if (
    lower.includes('bug') ||
    lower.includes('fix') ||
    lower.includes('critical') ||
    lower.includes('error') ||
    lower.includes('crash') ||
    lower.includes('urgent') ||
    lower.includes('security') ||
    lower.includes('patch') ||
    lower.includes('fail')
  ) {
    priority = 'high';
    deadline = 'Immediate (Within 24 hours)';
    reasoning =
      'Identified as a defect, bug fix, or high-priority issue requiring prompt investigation and remediation.';
  } else if (
    lower.includes('read') ||
    lower.includes('learn') ||
    lower.includes('study') ||
    lower.includes('explore') ||
    lower.includes('docs') ||
    lower.includes('cleanup') ||
    lower.includes('note') ||
    lower.includes('meeting')
  ) {
    priority = 'low';
    deadline = 'Flexible (Within 1-2 weeks)';
    reasoning =
      'Routine study, documentation, or non-blocking exploratory activity suitable for low priority scheduling.';
  }

  // Generate actionable subtasks based on keywords
  let subtasks = [
    `Analyze requirements and scope for "${cleanTitle}"`,
    `Execute core implementation and verify deliverable quality`,
    `Review final output and mark task as completed`,
  ];

  if (lower.includes('test') || lower.includes('qa')) {
    subtasks = [
      'Identify edge cases and write automated test assertions',
      'Execute local test suite and verify 100% pass rate',
      'Verify continuous integration pipeline status',
    ];
  } else if (lower.includes('deploy') || lower.includes('docker') || lower.includes('ci')) {
    subtasks = [
      'Verify container configurations and build scripts',
      'Run pre-deployment tests in staging environment',
      'Deploy to target environment and verify health endpoints',
    ];
  } else if (lower.includes('ui') || lower.includes('design') || lower.includes('frontend')) {
    subtasks = [
      'Draft layout structure and ensure color theme compliance',
      'Implement responsive component states (loading, empty, error)',
      'Test across multiple screen resolutions and user interactions',
    ];
  } else if (lower.includes('api') || lower.includes('backend') || lower.includes('db')) {
    subtasks = [
      'Define data model schema and route endpoints',
      'Add input validation and error handling middlewares',
      'Verify API response contracts and response time metrics',
    ];
  }

  // Generate structured description
  let suggestedDescription =
    existingDesc && existingDesc.trim().length > 10
      ? `${existingDesc.trim()}\n\n[AI Enhancement]\n- Objective: Complete deliverable for "${cleanTitle}".\n- Expected Outcome: Fully tested, reliable outcome aligned with ${priority} priority expectations.`
      : `Complete all deliverables required for "${cleanTitle}". Ensure implementation adheres to established standards, passes validation criteria, and is documented appropriately.`;

  if (lower.includes('db') || lower.includes('database') || lower.includes('sql')) {
    suggestedDescription = `Complete the database tasks for "${cleanTitle}" by designing the schema, executing the required queries or migrations, and verifying data consistency and query outputs before submission.`;
  }

  return {
    title: cleanTitle,
    suggestedDescription,
    suggestedPriority: priority,
    suggestedDeadline: deadline,
    subtasks,
    reasoning,
    disclaimer: AI_DISCLAIMER,
    provider: 'Contextual Engine (Local Smart Fallback)',
    isFallback: true,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Call Google Gemini API
 */
async function callGeminiAPI(title, existingDesc, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const prompt = `You are an expert productivity and project management assistant.
Analyze the following task and return a JSON object with:
- "suggestedDescription": a professional, clear, 2-3 sentence description outlining objectives and deliverables.
- "suggestedPriority": either "low", "medium", or "high" (strictly one of these three strings).
- "suggestedDeadline": a realistic recommended timeline (e.g. "Tomorrow by 5 PM", "Within 3 days", "In 1 week").
- "subtasks": an array of 3 to 4 actionable, concise bullet points/milestones.
- "reasoning": 1 sentence explaining why this priority and deadline were selected.

Task Title: "${title}"
${existingDesc ? `Additional Context: "${existingDesc}"` : ''}

Respond ONLY with valid JSON conforming to this schema:
{
  "suggestedDescription": "string",
  "suggestedPriority": "low" | "medium" | "high",
  "suggestedDeadline": "string",
  "subtasks": ["string", "string", "string"],
  "reasoning": "string"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 1000,
        },
      }),
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini API HTTP ${response.status}: ${errorText.slice(0, 150)}`);
    }

    const data = await response.json();
    const rawContent =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON safely
    const cleanJson = rawContent
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    // Validate and sanitize priority
    let validPriority = (parsed.suggestedPriority || 'medium').toLowerCase();
    if (!['low', 'medium', 'high'].includes(validPriority)) {
      validPriority = 'medium';
    }

    return {
      title,
      suggestedDescription: parsed.suggestedDescription || `Complete tasks for ${title}.`,
      suggestedPriority: validPriority,
      suggestedDeadline: parsed.suggestedDeadline || 'Within 3 days',
      subtasks: Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0 ? parsed.subtasks : ['Analyze scope', 'Execute implementation', 'Verify completion'],
      reasoning: parsed.reasoning || 'Derived from task title and operational urgency.',
      disclaimer: AI_DISCLAIMER,
      provider: 'Google Gemini (gemini-1.5-flash)',
      isFallback: false,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAIAPI(title, existingDesc, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const prompt = `Analyze this task title: "${title}". ${
      existingDesc ? `Context: "${existingDesc}".` : ''
    } Return JSON with:
"suggestedDescription": concise professional description,
"suggestedPriority": "low" | "medium" | "high",
"suggestedDeadline": realistic timeframe,
"subtasks": array of 3-4 concise step strings,
"reasoning": brief explanation.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a task management AI assistant. Respond strictly in valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`OpenAI API HTTP ${response.status}: ${errorText.slice(0, 150)}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    let validPriority = (parsed.suggestedPriority || 'medium').toLowerCase();
    if (!['low', 'medium', 'high'].includes(validPriority)) {
      validPriority = 'medium';
    }

    return {
      title,
      suggestedDescription: parsed.suggestedDescription || `Execute deliverables for ${title}.`,
      suggestedPriority: validPriority,
      suggestedDeadline: parsed.suggestedDeadline || 'Within 3 days',
      subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks : ['Analyze scope', 'Implement', 'Verify'],
      reasoning: parsed.reasoning || 'Generated via OpenAI reasoning model.',
      disclaimer: AI_DISCLAIMER,
      provider: 'OpenAI (gpt-4o-mini)',
      isFallback: false,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Main AI suggestion entrypoint with graceful fallback
 */
async function generateTaskSuggestion(title, existingDesc = '') {
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new Error('Task title is required to generate AI suggestions.');
  }

  const cleanTitle = title.trim();
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // 1. Try Gemini API if key is configured
  if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
    try {
      return await callGeminiAPI(cleanTitle, existingDesc, geminiKey);
    } catch (err) {
      console.warn(`[AI Service] Gemini API call failed/timed out (${err.message}). Engaging graceful fallback.`);
      const fallback = generateContextualFallback(cleanTitle, existingDesc);
      fallback.warning = `Live Gemini API call failed (${err.message}). Graceful fallback suggestion applied.`;
      return fallback;
    }
  }

  // 2. Try OpenAI API if key is configured
  if (openaiKey && openaiKey !== 'your_openai_api_key_here') {
    try {
      return await callOpenAIAPI(cleanTitle, existingDesc, openaiKey);
    } catch (err) {
      console.warn(`[AI Service] OpenAI API call failed/timed out (${err.message}). Engaging graceful fallback.`);
      const fallback = generateContextualFallback(cleanTitle, existingDesc);
      fallback.warning = `Live OpenAI API call failed (${err.message}). Graceful fallback suggestion applied.`;
      return fallback;
    }
  }

  // 3. Graceful offline/local fallback engine when no cloud API keys are specified
  return generateContextualFallback(cleanTitle, existingDesc);
}

module.exports = {
  generateTaskSuggestion,
  generateContextualFallback,
  AI_DISCLAIMER,
};

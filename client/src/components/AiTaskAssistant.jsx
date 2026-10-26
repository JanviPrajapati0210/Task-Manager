import { useState, useEffect } from 'react';
import { getAiTaskSuggestion } from '../api';

/**
 * AI-Powered Task Assistant Component (Practical 11)
 *
 * Requirements:
 * - Auto-generates task description, suggests priority level, proposes deadline & subtasks based on title
 * - API key strictly on backend (.env)
 * - Graceful error handling (core application continues to work)
 * - Meaningfully formatted in React UI (NOT raw JSON)
 * - Loading state with animated spinner
 * - Rate limit handling (max 1 request per minute) with cooldown display
 * - Clear disclaimer banner that suggestion is AI-generated
 */
export default function AiTaskAssistant({ title, description, onApply, disabled }) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  // Manage cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleGenerate = async () => {
    if (!title || !title.trim()) {
      setError('Please enter a task title first so the AI has context to work with.');
      return;
    }

    if (cooldown > 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getAiTaskSuggestion(title.trim(), description || '');
      setSuggestion(data);
    } catch (err) {
      if (err.status === 429) {
        // Parse retry seconds if returned, otherwise default to 60s
        const match = err.message.match(/(\d+)\s*second/i);
        const seconds = match ? parseInt(match[1], 10) : 60;
        setCooldown(seconds);
        setError(`Rate limit active: ${err.message}`);
      } else {
        setError(err.message || 'Unable to generate AI suggestion. You can continue typing manually.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAll = () => {
    if (!suggestion || !onApply) return;
    onApply({
      description: suggestion.suggestedDescription || '',
      priority: suggestion.suggestedPriority || 'medium',
      deadline: suggestion.suggestedDeadline,
      subtasks: suggestion.subtasks || [],
    });
    setSuggestion(null);
  };

  const handleApplyDescriptionOnly = () => {
    if (!suggestion || !onApply) return;
    onApply({
      description: suggestion.suggestedDescription || '',
    });
  };

  const handleApplyPriorityOnly = () => {
    if (!suggestion || !onApply) return;
    onApply({
      priority: suggestion.suggestedPriority || 'medium',
    });
  };

  const priorityColor = (p) => {
    switch (p) {
      case 'high':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'medium':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
      case 'low':
      default:
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
    }
  };

  return (
    <div className="ai-assistant-wrapper" style={{ marginTop: '4px', marginBottom: '12px' }}>
      {/* Trigger Button Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={disabled || loading || cooldown > 0 || !title.trim()}
          className="ai-assist-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 14px',
            fontSize: '0.82rem',
            fontWeight: 600,
            borderRadius: '999px',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent)',
            cursor: disabled || loading || cooldown > 0 || !title.trim() ? 'not-allowed' : 'pointer',
            opacity: disabled || loading || cooldown > 0 || !title.trim() ? 0.6 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <span>
            {loading
              ? 'AI Assistant thinking...'
              : cooldown > 0
              ? `AI Cooldown (${cooldown}s)`
              : '✨ Auto-Enhance with AI'}
          </span>
        </button>

        {cooldown > 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>
            Rate limited: 1 req/min ({cooldown}s remaining)
          </span>
        )}
      </div>

      {/* Loading state indicator */}
      {loading && (
        <div
          style={{
            marginTop: '10px',
            padding: '14px',
            borderRadius: '12px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            className="ai-spinner"
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: '2px solid var(--accent-soft)',
              borderTopColor: 'var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ display: 'grid', gap: '2px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
              Consulting AI Assistant...
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              Analyzing title & generating description, priority, subtasks, and deadline
            </span>
          </div>
        </div>
      )}

      {/* Graceful error / rate limit notice */}
      {error && !loading && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>ℹ️</span>
          <span>{error}</span>
        </div>
      )}

      {/* AI Suggestion Presentation Card */}
      {suggestion && !loading && (
        <div
          className="ai-suggestion-card"
          style={{
            marginTop: '12px',
            padding: '16px',
            borderRadius: '14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent)',
            boxShadow: '0 8px 24px -10px var(--accent-soft)',
            display: 'grid',
            gap: '12px',
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem' }}>✨</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
                AI Recommendation
              </strong>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {suggestion.provider || 'Gemini 1.5 Flash'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSuggestion(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: '1rem',
                lineHeight: 1,
              }}
              title="Dismiss suggestion"
            >
              ✕
            </button>
          </div>

          {/* Mandatory AI Disclaimer Banner */}
          <div
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: '#fbbf24',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>⚠️</span>
            <span>{suggestion.disclaimer || 'AI-generated suggestion. Please review and verify accuracy before saving.'}</span>
          </div>

          {/* Priority & Deadline Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {suggestion.suggestedPriority && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: priorityColor(suggestion.suggestedPriority).bg,
                  color: priorityColor(suggestion.suggestedPriority).text,
                  border: `1px solid ${priorityColor(suggestion.suggestedPriority).border}`,
                }}
              >
                <span>Recommended Priority:</span>
                <strong style={{ textTransform: 'capitalize' }}>{suggestion.suggestedPriority}</strong>
              </span>
            )}

            {suggestion.suggestedDeadline && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  background: 'var(--accent-soft)',
                  color: 'var(--text)',
                  border: '1px solid var(--line)',
                }}
              >
                <span>📅 Proposed Target:</span>
                <strong>{suggestion.suggestedDeadline}</strong>
              </span>
            )}
          </div>

          {/* Description preview */}
          <div style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Suggested Description:
            </span>
            <p
              style={{
                margin: 0,
                fontSize: '0.85rem',
                lineHeight: 1.5,
                color: 'var(--text)',
                background: 'var(--bg)',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                whiteSpace: 'pre-line',
              }}
            >
              {suggestion.suggestedDescription}
            </p>
          </div>

          {/* Actionable Subtasks / Checklist */}
          {Array.isArray(suggestion.subtasks) && suggestion.subtasks.length > 0 && (
            <div style={{ display: 'grid', gap: '4px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Actionable Milestones / Subtasks:
              </span>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '4px' }}>
                {suggestion.subtasks.map((step, idx) => (
                  <li key={idx} style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reasoning */}
          {suggestion.reasoning && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', fontStyle: 'italic' }}>
              💡 {suggestion.reasoning}
            </p>
          )}

          {/* Action Buttons to populate form fields */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={handleApplyDescriptionOnly}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid var(--line)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              Insert Description Only
            </button>

            <button
              type="button"
              onClick={handleApplyPriorityOnly}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid var(--line)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              Apply Priority ({suggestion.suggestedPriority})
            </button>

            <button
              type="button"
              onClick={handleApplyAll}
              style={{
                padding: '6px 16px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '8px',
                background: 'var(--accent)',
                border: 'none',
                color: 'var(--on-accent)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>✓ Apply All to Task</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

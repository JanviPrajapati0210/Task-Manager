const sendEmail = require('./sendEmail');

// Escape user-supplied text before putting it into an HTML email
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Notifies the task owner that a task was completed.
// Uses the same SMTP setup as the password-reset email (prints to the console
// when SMTP is not configured).
async function sendTaskCompletedEmail(user, task) {
  if (!user || !user.email) return;

  const name = esc(user.username || user.name || 'there');
  const title = esc(task.title || 'Untitled Task');
  const priority = esc((task.priority || 'medium').toUpperCase());
  const completedAt = new Date().toLocaleString();
  const description = task.description
    ? `<p><strong>Description:</strong> ${esc(task.description)}</p>`
    : '';

  const html = `
    <div style="font-family: Segoe UI, Tahoma, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px;">Task Completed!</h1>
        <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Task Manager notification</p>
      </div>
      <div style="padding: 28px; color: #334155; line-height: 1.6;">
        <p style="margin-top: 0;">Hi <strong>${name}</strong>,</p>
        <p>Great job! The following task has been completed:</p>
        <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin: 0 0 8px; color: #1e293b;">${title}</h3>
          ${description}
          <p style="margin: 4px 0;"><strong>Priority:</strong> ${priority}</p>
          <p style="margin: 4px 0; font-size: 13px; color: #64748b;"><strong>Completed at:</strong> ${esc(completedAt)}</p>
        </div>
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">Task Manager &bull; Auto-generated email</p>
      </div>
    </div>`;

  const text =
    `Hi ${user.username || user.name || 'there'},\n\n` +
    `Your task "${task.title}" has been marked as completed!\n` +
    `Priority: ${(task.priority || 'medium').toUpperCase()}\n` +
    `Completed at: ${completedAt}\n\nTask Manager`;

  return sendEmail({
    to: user.email,
    subject: `Task Completed: "${task.title}"`,
    text,
    html,
  });
}

module.exports = { sendTaskCompletedEmail };
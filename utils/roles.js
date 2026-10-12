

const RANK = { user: 1, manager: 2, admin: 3 };

function parseList(value) {
  return (value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function configuredRoleForEmail(email) {
  const e = (email || '').toLowerCase();
  if (parseList(process.env.ADMIN_EMAILS).includes(e)) return 'admin';
  if (parseList(process.env.MANAGER_EMAILS).includes(e)) return 'manager';
  return null;
}

// Promotes (never demotes) a user document according to the .env lists.
// Returns true when the role was changed.
function applyConfiguredRole(user) {
  const configured = configuredRoleForEmail(user.email);
  const current = user.role || 'user';
  if (configured && RANK[configured] > RANK[current]) {
    user.role = configured;
    return true;
  }
  return false;
}

module.exports = { applyConfiguredRole, configuredRoleForEmail };
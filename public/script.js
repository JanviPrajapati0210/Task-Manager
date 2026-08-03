const API_BASE = '/tasks';

const entryForm = document.getElementById('entryForm');
const titleInput = document.getElementById('titleInput');
const completedInput = document.getElementById('completedInput');
const entryList = document.getElementById('entryList');
const emptyState = document.getElementById('emptyState');
const statusMsg = document.getElementById('statusMsg');
const refreshBtn = document.getElementById('refreshBtn');
const rowTemplate = document.getElementById('rowTemplate');

function showError(message) {
  statusMsg.textContent = message;
  statusMsg.hidden = false;
  clearTimeout(showError._t);
  showError._t = setTimeout(() => { statusMsg.hidden = true; }, 3500);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Something went wrong');
  }
  return data;
}

async function fetchTasks() {
  try {
    const tasks = await api(API_BASE);
    renderTasks(tasks);
  } catch (err) {
    showError(err.message);
  }
}

function renderTasks(tasks) {
  entryList.innerHTML = '';
  emptyState.hidden = tasks.length > 0;

  tasks.forEach((task) => entryList.appendChild(buildRow(task)));
}

function buildRow(task) {
  const node = rowTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.id = task.id;
  node.classList.toggle('is-done', Boolean(task.completed));

  node.querySelector('.entry__id').textContent = `#${String(task.id).padStart(3, '0')}`;

  const titleEl = node.querySelector('.entry__title');
  titleEl.textContent = task.title;

  // -- toggle done --
  node.querySelector('.entry__check').addEventListener('click', () => toggleDone(task.id, node));

  // -- inline edit --
  const editBtn = node.querySelector('.icon-btn--edit');
  editBtn.addEventListener('click', () => startEditing(titleEl, task.id));
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
    if (e.key === 'Escape') { titleEl.textContent = task.title; titleEl.blur(); }
  });

  // -- delete --
  node.querySelector('.icon-btn--delete').addEventListener('click', () => deleteTask(task.id, node));

  return node;
}

function startEditing(titleEl, id) {
  const original = titleEl.textContent;
  titleEl.setAttribute('contenteditable', 'true');
  titleEl.focus();
  placeCaretAtEnd(titleEl);

  const commit = async () => {
    titleEl.removeAttribute('contenteditable');
    titleEl.removeEventListener('blur', commit);
    const newTitle = titleEl.textContent.trim();

    if (!newTitle || newTitle === original) {
      titleEl.textContent = original;
      return;
    }
    try {
      await api(`${API_BASE}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: newTitle }),
      });
    } catch (err) {
      titleEl.textContent = original;
      showError(err.message);
    }
  };

  titleEl.addEventListener('blur', commit, { once: true });
}

function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

async function toggleDone(id, node) {
  const nowDone = !node.classList.contains('is-done');
  node.classList.toggle('is-done', nowDone); // optimistic

  try {
    await api(`${API_BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ completed: nowDone }),
    });
  } catch (err) {
    node.classList.toggle('is-done', !nowDone); // revert
    showError(err.message);
  }
}

async function deleteTask(id, node) {
  if (!confirm('Cross this entry off for good?')) return;

  node.classList.add('entry--removing');
  try {
    await api(`${API_BASE}/${id}`, { method: 'DELETE' });
    node.addEventListener('animationend', () => {
      node.remove();
      emptyState.hidden = entryList.children.length > 0;
    }, { once: true });
  } catch (err) {
    node.classList.remove('entry--removing');
    showError(err.message);
  }
}

entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  try {
    await api(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ title, completed: completedInput.checked }),
    });
    titleInput.value = '';
    completedInput.checked = false;
    await fetchTasks();
    titleInput.focus();
  } catch (err) {
    showError(err.message);
  }
});

refreshBtn.addEventListener('click', () => {
  refreshBtn.classList.add('spinning');
  fetchTasks().finally(() => {
    setTimeout(() => refreshBtn.classList.remove('spinning'), 400);
  });
});

fetchTasks();

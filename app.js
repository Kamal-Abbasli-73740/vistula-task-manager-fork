const form = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const descInput = document.getElementById('task-description');
const submitBtn = document.getElementById('task-submit');
const cancelBtn = document.getElementById('cancel-edit');
const listEl = document.getElementById('task-list');
const statusEl = document.getElementById('status-message');

let config = null;
let tasks = [];
let editingId = null;

function showMessage(text, type = 'ok') {
  statusEl.textContent = text;
  statusEl.className = type;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

function apiUrl(query = '') {
  return `${config.supabaseUrl}/rest/v1/${config.tableName}${query}`;
}

function apiHeaders() {
  return {
    'apikey': config.supabasePublishableKey,
    'Authorization': `Bearer ${config.supabasePublishableKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, { ...options, headers: apiHeaders() });
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body.message || '';
    } catch (_) {}
    throw new Error(`İşlem başarısız (${response.status}). ${detail}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

function renderTasks() {
  if (tasks.length === 0) {
    listEl.innerHTML = '<p>Henüz görev yok.</p>';
    return;
  }
  listEl.innerHTML = tasks.map(task => `
    <div class="task-item ${task.completed ? 'done' : ''}" data-id="${task.id}">
      <h3 class="task-title">${escapeHtml(task.title)}</h3>
      <p class="task-description">${escapeHtml(task.description)}</p>
      <p class="task-status">${task.completed ? 'Tamamlandı' : 'Tamamlanmadı'}</p>
      <button class="toggle-task">${task.completed ? 'Geri al' : 'Tamamla'}</button>
      <button class="edit-task">Düzenle</button>
      <button class="delete-task">Sil</button>
    </div>
  `).join('');
}

async function loadTasks() {
  tasks = await apiRequest(apiUrl('?select=*&order=id.asc'));
  renderTasks();
}

function resetForm() {
  editingId = null;
  form.reset();
  submitBtn.textContent = 'Ekle';
  cancelBtn.classList.add('hidden');
}

function startEdit(task) {
  editingId = task.id;
  titleInput.value = task.title;
  descInput.value = task.description || '';
  submitBtn.textContent = 'Kaydet';
  cancelBtn.classList.remove('hidden');
  titleInput.focus();
}

async function toggleTask(task) {
  const [updated] = await apiRequest(apiUrl(`?id=eq.${task.id}`), {
    method: 'PATCH',
    body: JSON.stringify({ completed: !task.completed })
  });
  Object.assign(task, updated);
  renderTasks();
  showMessage('Görev durumu güncellendi.');
}

async function deleteTask(task) {
  if (!confirm(`"${task.title}" silinsin mi?`)) return;
  await apiRequest(apiUrl(`?id=eq.${task.id}`), { method: 'DELETE' });
  tasks = tasks.filter(t => t.id !== task.id);
  renderTasks();
  showMessage('Görev silindi.');
}

listEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const item = button.closest('.task-item');
  const id = Number(item.dataset.id);
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  try {
    if (button.classList.contains('edit-task')) {
      startEdit(task);
    } else if (button.classList.contains('toggle-task')) {
      await toggleTask(task);
    } else if (button.classList.contains('delete-task')) {
      await deleteTask(task);
    }
  } catch (err) {
    showMessage(err.message, 'error');
  }
});

cancelBtn.addEventListener('click', resetForm);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const description = descInput.value.trim();

  if (!title) {
    showMessage('Başlık boş olamaz.', 'error');
    return;
  }

  try {
    if (editingId === null) {
      const [created] = await apiRequest(apiUrl(), {
        method: 'POST',
        body: JSON.stringify({ title, description, completed: false })
      });
      tasks.push(created);
      showMessage('Görev eklendi.');
    } else {
      const [updated] = await apiRequest(apiUrl(`?id=eq.${editingId}`), {
        method: 'PATCH',
        body: JSON.stringify({ title, description })
      });
      const index = tasks.findIndex(t => t.id === editingId);
      if (index !== -1) tasks[index] = updated;
      showMessage('Görev güncellendi.');
    }
    resetForm();
    renderTasks();
  } catch (err) {
    showMessage(err.message, 'error');
  }
});

async function init() {
  try {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error('config.json yüklenemedi.');
    config = await response.json();
    await loadTasks();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

init();

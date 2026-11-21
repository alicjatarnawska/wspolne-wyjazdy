<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  tripId: { type: [String, Number], required: true },
  members: { type: Array, default: () => [] },
  currentUserId: { type: [String, Number], default: null }
})

const tasks = ref([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const error = ref('')
const formError = ref('')
const success = ref('')
const showForm = ref(false)
const editingId = ref(null)
const deleteTarget = ref(null)
const form = ref({ name: '', assigned_user_id: '', due_date: '', status: 'TODO' })

//lista uczestnikow do przypisywania zadan
const memberOptions = computed(() => props.members.map(member => {
  const user = member.user || member
  return {
    id: String(member.user_id ?? user.id ?? ''),
    name: user.display_name || member.display_name || user.name || member.name || user.email || member.email || 'Uczestnik'
  }
}).filter(member => member.id))

//pobieranie identyfikatora zalogowanego uzytkownika z tokenu
function tokenUserId() {
  try {
    const payload = sessionStorage.getItem('token')?.split('.')[1]
    if (!payload) return ''
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    return String(decoded.id ?? decoded.userId ?? decoded.user_id ?? decoded.sub ?? '')
  } catch {
    return ''
  }
}

const myUserId = computed(() => String(props.currentUserId ?? tokenUserId()))
const taskFilter = ref('mine')
const filteredTasks = computed(() => taskFilter.value === 'all'
  ? tasks.value
  : tasks.value.filter(task => String(task.assigned_user_id) === myUserId.value))
const myPendingCount = computed(() => tasks.value.filter(task => task.status === 'TODO' && String(task.assigned_user_id) === myUserId.value).length)
const todoTasks = computed(() => filteredTasks.value.filter(task => task.status === 'TODO'))
const doneTasks = computed(() => filteredTasks.value.filter(task => task.status === 'DONE'))
const showCompleted = ref(false)
const changingStatusId = ref(null)
const progress = computed(() => filteredTasks.value.length ? Math.round(doneTasks.value.length / filteredTasks.value.length * 100) : 0)

//formatowanie daty 
function formatDate(value) {
  if (!value) return 'Bez terminu'
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/)
  if (!match) return 'Bez terminu'
  const [year, month, day] = match[0].split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

function dateOnly(value) {
  return String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || ''
}

//wysylanie zadan do api i odczytywanie komunikatow backendu
async function request(path, options = {}) {
  const token = sessionStorage.getItem('token')
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Błąd żądania (${response.status}).`)
  return data
}

//pobranie zadan przypisanych do wyjazdu
async function loadTasks() {
  if (!props.tripId) return
  loading.value = true
  error.value = ''
  try {
    const data = await request(`/api/trips/${props.tripId}/tasks`)
    tasks.value = Array.isArray(data.tasks) ? data.tasks : []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingId.value = null
  form.value = { name: '', assigned_user_id: '', due_date: '', status: 'TODO' }
  formError.value = ''
  showForm.value = true
}

function openEdit(task) {
  editingId.value = task.id
  form.value = {
    name: task.name || '',
    assigned_user_id: String(task.assigned_user_id || ''),
    due_date: dateOnly(task.due_date),
    status: task.status || 'TODO'
  }
  formError.value = ''
  showForm.value = true
}

function closeForm() {
  if (saving.value) return
  showForm.value = false
  formError.value = ''
}

//zapis zadania i wyswietlenie bledu
async function saveTask() {
  formError.value = ''
  saving.value = true
  try {
    const isEdit = editingId.value !== null
    const url = isEdit
      ? `/api/trips/${props.tripId}/tasks/${editingId.value}`
      : `/api/trips/${props.tripId}/tasks`
    const payload = {
      name: form.value.name,
      assigned_user_id: form.value.assigned_user_id,
      due_date: form.value.due_date || null,
      status: form.value.status
    }
    await request(url, { method: isEdit ? 'PATCH' : 'POST', body: JSON.stringify(payload) })
    showForm.value = false
    success.value = isEdit ? 'Zadanie zostało zaktualizowane.' : 'Zadanie zostało dodane.'
    await loadTasks()
  } catch (err) {
    formError.value = err.message
  } finally {
    saving.value = false
  }
}

//zmiana statusu bez otwierania formularza
async function toggleStatus(task) {
  error.value = ''
  success.value = ''
  if (changingStatusId.value !== null) return
  changingStatusId.value = task.id
  try {
    const status = task.status === 'DONE' ? 'TODO' : 'DONE'
    await request(`/api/trips/${props.tripId}/tasks/${task.id}`, {
      method: 'PATCH', body: JSON.stringify({ status })
    })
    await loadTasks()
  } catch (err) {
    error.value = err.message
  } finally {
    changingStatusId.value = null
  }
}

//usuwanie zadania po potwierdzeniu
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  error.value = ''
  try {
    await request(`/api/trips/${props.tripId}/tasks/${deleteTarget.value.id}`, { method: 'DELETE' })
    deleteTarget.value = null
    success.value = 'Zadanie zostało usunięte.'
    await loadTasks()
  } catch (err) {
    error.value = err.message
  } finally {
    deleting.value = false
  }
}

watch(() => props.tripId, loadTasks, { immediate: true })
</script>

<template>
  <section class="tasks-section">
    <header class="tasks-heading">
      <div>
        <p class="tasks-kicker">ORGANIZACJA WYJAZDU</p>
        <h2>Zadania</h2>
        <p class="tasks-subtitle">Zarządzaj zadaniami i kontroluj postępy.</p>
      </div>
      <button class="tasks-primary" type="button" @click="openAdd">+ Dodaj zadanie</button>
    </header>

    <p v-if="error && !deleteTarget" class="tasks-feedback tasks-error" role="alert">{{ error }}</p>
    <p v-if="success" class="tasks-feedback tasks-success" role="status">{{ success }}</p>

    <div v-if="loading" class="tasks-placeholder">Ładowanie zadań...</div>
    <template v-else>
      <div class="tasks-toolbar">
        <div class="tasks-filters" role="group" aria-label="Zakres zadań">
          <button type="button" :class="{ active: taskFilter === 'mine' }" :aria-pressed="taskFilter === 'mine'" @click="taskFilter = 'mine'">
            Moje zadania <span class="tasks-filter-count">{{ myPendingCount }}</span>
          </button>
          <button type="button" :class="{ active: taskFilter === 'all' }" :aria-pressed="taskFilter === 'all'" @click="taskFilter = 'all'">
            Wszystkie zadania <span class="tasks-filter-count">{{ tasks.length }}</span>
          </button>
        </div>
        <div class="tasks-mini-progress" :title="`${doneTasks.length} z ${filteredTasks.length} ukończonych`">
          <span>Ukończono <strong>{{ doneTasks.length }}/{{ filteredTasks.length }}</strong></span>
          <div class="tasks-mini-track" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" aria-label="Postęp zadań w wybranym widoku">
            <div :style="{ width: `${progress}%` }"></div>
          </div>
        </div>
      </div>

      <section class="tasks-active-section">
        <div class="tasks-list-heading">
          <div class="tasks-list-title">
            <span class="tasks-list-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg></span>
            <div><h3>Do zrobienia <span class="tasks-count">{{ todoTasks.length }}</span></h3><p>{{ taskFilter === 'mine' ? 'Zadania przypisane do Ciebie.' : 'Zadania wszystkich uczestników wyjazdu.' }}</p></div>
          </div>
        </div>
        <div v-if="!todoTasks.length" class="tasks-empty-active">
          <span class="tasks-empty-icon" aria-hidden="true">✓</span>
          <strong>Wszystko gotowe!</strong>
          <p>{{ taskFilter === 'mine' ? 'Nie masz obecnie zadań do wykonania.' : 'Wszystkie zadania zostały wykonane.' }}</p>
        </div>
        <div v-else class="tasks-active-list">
          <article v-for="task in todoTasks" :key="task.id" class="task-row">
            <button class="task-check" type="button" :disabled="changingStatusId !== null" :aria-label="`Oznacz jako wykonane: ${task.name}`" title="Oznacz jako wykonane" @click="toggleStatus(task)"><span></span></button>
            <div class="task-content">
              <h4>{{ task.name }}</h4>
              <div class="task-meta">
                <span class="task-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>{{ task.assigned_user_name || 'Uczestnik wyjazdu' }}</span>
                <span class="task-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>{{ formatDate(task.due_date) }}</span>
              </div>
            </div>
            <div class="task-actions">
              <button type="button" @click="openEdit(task)">Edytuj</button>
              <button type="button" class="task-danger" @click="deleteTarget = task; error = ''; success = ''">Usuń</button>
            </div>
          </article>
        </div>
      </section>

      <section class="tasks-completed-section tasks-active-section">
        <button type="button" class="tasks-completed-toggle" :aria-expanded="showCompleted" @click="showCompleted = !showCompleted">
          <span class="tasks-completed-label"><span class="tasks-completed-check" aria-hidden="true">✓</span><span><strong>Ukończone</strong><small>Kliknij, aby rozwinąć listę</small></span><span class="tasks-count">{{ doneTasks.length }}</span></span>
          <svg class="tasks-chevron" :class="{ expanded: showCompleted }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div v-if="showCompleted" class="tasks-completed-list tasks-active-list">
          <p v-if="!doneTasks.length" class="tasks-empty-completed">Nie ma jeszcze ukończonych zadań.</p>
          <article v-for="task in doneTasks" :key="task.id" class="task-row">
            <button class="task-check checked" type="button" :disabled="changingStatusId !== null" :aria-label="`Przywróć do zrobienia: ${task.name}`" title="Przywróć do zrobienia" @click="toggleStatus(task)">✓</button>
            <div class="task-content">
              <h4>{{ task.name }}</h4>
              <div class="task-meta"><span>{{ task.assigned_user_name || 'Uczestnik wyjazdu' }}</span><span>{{ formatDate(task.due_date) }}</span></div>
            </div>
            <div class="task-actions"><button type="button" @click="openEdit(task)">Edytuj</button><button type="button" class="task-danger" @click="deleteTarget = task; error = ''; success = ''">Usuń</button></div>
          </article>
        </div>
      </section>
    </template>

    <div v-if="showForm" class="tasks-backdrop" @click.self="closeForm">
      <section class="tasks-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <div class="tasks-modal-heading">
          <h2 id="task-modal-title">{{ editingId !== null ? 'Edytuj zadanie' : 'Dodaj zadanie' }}</h2>
          <button type="button" class="tasks-close" :disabled="saving" aria-label="Zamknij" @click="closeForm">×</button>
        </div>
        <form novalidate @submit.prevent="saveTask">
          <label for="task-name">Nazwa zadania</label>
          <input id="task-name" v-model="form.name" type="text" placeholder="Np. zarezerwować nocleg" />
          <label for="task-assignee">Osoba odpowiedzialna</label>
          <select id="task-assignee" v-model="form.assigned_user_id">
            <option value="">Wybierz uczestnika</option>
            <option v-for="member in memberOptions" :key="member.id" :value="member.id">{{ member.name }}</option>
          </select>
          <p v-if="!memberOptions.length" class="tasks-help">Lista uczestników jest pusta. Przekaż do komponentu uczestników wyjazdu przez właściwość members.</p>
          <label for="task-date">Termin wykonania (opcjonalnie)</label>
          <input id="task-date" v-model="form.due_date" type="date" />
          <label for="task-status">Status</label>
          <select id="task-status" v-model="form.status">
            <option value="TODO">Do zrobienia</option>
            <option value="DONE">Ukończone</option>
          </select>
          <p v-if="formError" class="tasks-feedback tasks-error" role="alert">{{ formError }}</p>
          <div class="tasks-modal-actions">
            <button type="button" class="tasks-secondary" :disabled="saving" @click="closeForm">Anuluj</button>
            <button type="submit" class="tasks-primary" :disabled="saving">{{ saving ? 'Zapisywanie...' : 'Zapisz zadanie' }}</button>
          </div>
        </form>
      </section>
    </div>

    <div v-if="deleteTarget" class="tasks-backdrop" @click.self="!deleting && (deleteTarget = null)">
      <section class="tasks-modal" role="dialog" aria-modal="true" aria-labelledby="task-delete-title">
        <h2 id="task-delete-title">Usunąć zadanie?</h2>
        <p>Czy na pewno chcesz usunąć „{{ deleteTarget.name }}”?</p>
        <p v-if="error" class="tasks-feedback tasks-error" role="alert">{{ error }}</p>
        <div class="tasks-modal-actions">
          <button type="button" class="tasks-secondary" :disabled="deleting" @click="deleteTarget = null">Anuluj</button>
          <button type="button" class="tasks-delete" :disabled="deleting" @click="confirmDelete">{{ deleting ? 'Usuwanie...' : 'Tak, usuń' }}</button>
        </div>
      </section>
    </div>
  </section>
</template>


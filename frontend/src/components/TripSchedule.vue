<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  tripId: { type: [String, Number], required: true },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' }
})

//zmienne przechowujace aktywnosci, stan formularza i operacji
const items = ref([])
const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const error = ref('')
const success = ref('')
const showForm = ref(false)
const editingId = ref(null)
const deleteTarget = ref(null)
const form = ref({ date: '', time: '', title: '', description: '' })

//pobranie samej daty bez godziny
function dateOnly(value) {
  if (!value) return ''
  const text = String(value)
  const match = text.match(/^\d{4}-\d{2}-\d{2}/)
  if (!match) return ''
  return match[0]
}

//utworzenie daty w lokalnej strefie czasowej
function localDate(value) {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

//formatowanie daty do polskiego zapisu
function formatDate(value) {
  const normalized = dateOnly(value)
  if (!normalized) return 'Nie podano'
  return localDate(normalized).toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

//tworzenie osobnej zakładki dla każdego dnia wyjazdu
const days = computed(() => {
  const start = dateOnly(props.startDate)
  const end = dateOnly(props.endDate)
  if (!start || !end || start > end) return []

  const result = []
  const current = localDate(start)
  const last = localDate(end)
  if (Number.isNaN(current.getTime()) || Number.isNaN(last.getTime())) return []
  while (current <= last && result.length < 366) {
    const date = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
    result.push({ date, number: result.length + 1 })
    current.setDate(current.getDate() + 1)
  }
  return result
})

//podział wyjazdu na kolejne tygodnie po maksymalnie siedem dni
const weeks = computed(() => {
  const result = []
  for (let i = 0; i < days.value.length; i += 7) {
    result.push({ number: result.length + 1, days: days.value.slice(i, i + 7) })
  }
  return result
})

const selectedWeek = ref(0)
const wholeWeek = ref(true)
const selectedDate = ref('')

const currentWeek = computed(() => weeks.value[selectedWeek.value] || null)
const visibleDays = computed(() => wholeWeek.value ? (currentWeek.value?.days || []) : days.value.filter(day => day.date === selectedDate.value))

function selectWeek(index) {
  selectedWeek.value = index
  selectedDate.value = weeks.value[index]?.days[0]?.date || ''
  wholeWeek.value = true
  error.value = ''
  success.value = ''
}

function selectDay(date) {
  selectedDate.value = date
  wholeWeek.value = false
  error.value = ''
  success.value = ''
}

function selectWholeWeek() {
  wholeWeek.value = true
  error.value = ''
  success.value = ''
}


watch(days, (value) => {
  if (!value.some(day => day.date === selectedDate.value)) {
    selectedDate.value = value[0]?.date || ''
  }
  const index = value.findIndex(day => day.date === selectedDate.value)
  selectedWeek.value = index >= 0 ? Math.floor(index / 7) : 0
}, { immediate: true })

//wyświetlanie aktywności wyłącznie dla wybranego dnia
const selectedItems = computed(() =>
  items.value
    .filter(item => dateOnly(item.date) === selectedDate.value)
    .sort((a, b) => {
      if (!a.time && b.time) return -1
      if (a.time && !b.time) return 1
      return String(a.time || '').localeCompare(String(b.time || '')) || Number(a.id) - Number(b.id)
    })
)

//sortowanie aktywności dla dowolnego dnia
function itemsForDay(date) {
  return items.value.filter(item => dateOnly(item.date) === date).sort((a, b) => {
    if (!a.time && b.time) return -1
    if (a.time && !b.time) return 1
    return String(a.time || '').localeCompare(String(b.time || '')) || Number(a.id) - Number(b.id)
  })
}

function shortDate(value) {
  return localDate(value).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

function monthName(value) {
  return localDate(value).toLocaleDateString('pl-PL', { month: 'long' })
}

//skrócone nazwy dni w przyciskach wyboru dnia
function shortWeekday(value) {
  const names = ['Niedz', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob']
  return names[localDate(value).getDay()]
}

function weekday(value) {
  return localDate(value).toLocaleDateString('pl-PL', { weekday: 'long' })
}

function activityCount(date) {
  return items.value.filter(item => dateOnly(item.date) === date).length
}

//żądania do api z tokenem zalogowanego użytkownika
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

//pobranie wszystkich punktów harmonogramu
async function loadPlan() {
  if (!props.tripId) return
  loading.value = true
  error.value = ''
  try {
    const data = await request(`/api/trips/${props.tripId}/plan`)
    items.value = data.items || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function openAdd(date = '') {
  editingId.value = null
  form.value = { date: date || (wholeWeek.value ? currentWeek.value?.days[0]?.date : selectedDate.value) || dateOnly(props.startDate), time: '', title: '', description: '' }
  error.value = ''
  success.value = ''
  showForm.value = true
}

function openEdit(item) {
  editingId.value = item.id
  form.value = {
    date: dateOnly(item.date),
    time: item.time || '',
    title: item.title || '',
    description: item.description || ''
  }
  error.value = ''
  success.value = ''
  showForm.value = true
}

function closeForm() {
  if (saving.value) return
  showForm.value = false
  editingId.value = null
}

//zapis nowej aktywności lub aktualizacja istniejącej
async function saveItem() {
  error.value = ''
  success.value = ''
  const payload = {
    date: form.value.date,
    time: form.value.time || null,
    title: form.value.title.trim(),
    description: form.value.description.trim() || null
  }
  if (!payload.title || !payload.date) {
    error.value = 'Uzupełnij tytuł i datę aktywności.'
    return
  }
  const min = dateOnly(props.startDate)
  const max = dateOnly(props.endDate)
  if ((min && payload.date < min) || (max && payload.date > max)) {
    error.value = 'Data aktywności musi mieścić się w terminie wyjazdu.'
    return
  }
  saving.value = true
  try {
    const isEdit = editingId.value !== null
    const url = isEdit
      ? `/api/trips/${props.tripId}/plan/${editingId.value}`
      : `/api/trips/${props.tripId}/plan`
    await request(url, {
      method: isEdit ? 'PATCH' : 'POST',
      body: JSON.stringify(payload)
    })
    showForm.value = false
    editingId.value = null

    //odswiezenie aktywnosci bez zmiany wybranego tygodnia i trybu widoku
    await loadPlan()
    success.value = isEdit ? 'Aktywność została zaktualizowana.' : 'Aktywność została dodana.'
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

//usunięcie punktu po potwierdzeniu
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  error.value = ''
  success.value = ''
  try {
    await request(`/api/trips/${props.tripId}/plan/${deleteTarget.value.id}`, { method: 'DELETE' })
    deleteTarget.value = null
    await loadPlan()
    success.value = 'Aktywność została usunięta.'
  } catch (err) {
    error.value = err.message
  } finally {
    deleting.value = false
  }
}

watch(() => props.tripId, loadPlan)
onMounted(loadPlan)
</script>

<template>
  <section class="schedule-section">
    <header class="schedule-heading">
      <div>
        <p class="schedule-kicker">PLAN PODRÓŻY</p>
        <h2>Harmonogram</h2>
        <p class="schedule-subtitle">Zaplanowane aktywności na każdy dzień.</p>
      </div>
      <button class="primary-button" type="button" :disabled="!days.length" @click="openAdd()">+ Dodaj aktywność</button>
    </header>

    <p v-if="error && !showForm && !deleteTarget" class="feedback error" role="alert">{{ error }}</p>
    <p v-if="success" class="feedback success" role="status">{{ success }}</p>
    <div v-if="loading" class="schedule-empty">Ładowanie harmonogramu...</div>
    <div v-else-if="!days.length" class="schedule-empty">Brak poprawnego zakresu dat wyjazdu.</div>
    <template v-else>
      <div class="schedule-toolbar">
        <nav class="week-navigation" aria-label="Tygodnie wyjazdu">
          <button class="week-arrow" type="button" aria-label="Poprzedni tydzień" :disabled="selectedWeek === 0" @click="selectWeek(selectedWeek - 1)">‹</button>
          <span class="week-current">Tydzień {{ selectedWeek + 1 }} <span class="week-total">z {{ weeks.length }}</span></span>
          <button class="week-arrow" type="button" aria-label="Następny tydzień" :disabled="selectedWeek >= weeks.length - 1" @click="selectWeek(selectedWeek + 1)">›</button>
        </nav>
        <div class="view-switch" aria-label="Tryb wyświetlania">
          <button type="button" :class="{ active: wholeWeek }" :aria-pressed="wholeWeek" @click="selectWholeWeek">Cały tydzień</button>
          <button type="button" :class="{ active: !wholeWeek }" :aria-pressed="!wholeWeek" @click="selectDay(selectedDate || currentWeek.days[0].date)">Jeden dzień</button>
        </div>
      </div>

      <div v-if="!wholeWeek" class="single-day-nav" aria-label="Wybór dnia">
        <button v-for="day in currentWeek.days" :key="day.date" type="button" :class="{ active: selectedDate === day.date }" @click="selectDay(day.date)">
          <span>{{ shortWeekday(day.date) }}</span><strong>{{ localDate(day.date).getDate() }}</strong>
        </button>
      </div>

      <div v-if="!wholeWeek && selectedDate" class="single-day-panel">
        <div class="single-day-heading">
          <div>
            <p class="single-day-eyebrow">PLAN NA WYBRANY DZIEŃ</p>
            <h3>{{ weekday(selectedDate) }}, {{ localDate(selectedDate).getDate() }} {{ monthName(selectedDate) }}</h3>
          </div>
          <button
            type="button"
            class="single-day-add-icon"
            aria-label="Dodaj aktywność do wybranego dnia"
            title="Dodaj aktywność"
            @click="openAdd(selectedDate)"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div v-if="!selectedItems.length" class="single-day-empty">Nie zaplanowano jeszcze żadnych aktywności na ten dzień.</div>
        <div v-else class="single-day-list">
          <article v-for="item in selectedItems" :key="item.id" class="single-day-activity">
            <div class="single-day-time">{{ item.time || 'Bez godziny' }}</div>
            <div class="single-day-content">
              <h4>{{ item.title }}</h4>
              <p v-if="item.description">{{ item.description }}</p>
            </div>
            <div class="single-day-actions">
              <button type="button" @click="openEdit(item)">Edytuj</button>
              <button type="button" class="danger-link" @click="deleteTarget = item; error = ''; success = ''">Usuń</button>
            </div>
          </article>
        </div>
      </div>
      <div v-else class="calendar-scroll week-mode">
        <div class="calendar-grid week-grid" :style="{ '--day-count': visibleDays.length }">
          <article v-for="day in visibleDays" :key="day.date" class="calendar-day">
            <header class="calendar-day-header">
              <div class="calendar-day-date">
                <span class="weekday">{{ weekday(day.date) }}</span>
                <div class="date-line">
                  <strong class="date-number">{{ localDate(day.date).getDate() }}</strong>
                  <span class="month">{{ localDate(day.date).toLocaleDateString('pl-PL', { month: 'long' }) }}</span>
                </div>
              </div>
            </header>
            <div class="calendar-day-body">
              <div v-if="!itemsForDay(day.date).length" class="empty-day">
                <span>Brak aktywności</span>
              </div>
              <div v-else class="activities">
                <div v-for="item in itemsForDay(day.date)" :key="item.id" class="activity-card">
                  <span class="activity-time">{{ item.time || 'Bez godziny' }}</span>
                  <h4>{{ item.title }}</h4>
                  <p v-if="item.description">{{ item.description }}</p>
                  <div class="activity-actions">
                    <button type="button" @click="openEdit(item)">Edytuj</button>
                    <button type="button" class="danger-link" @click="deleteTarget = item; error = ''; success = ''">Usuń</button>
                  </div>
                </div>
              </div>
              <button type="button" class="add-day" @click="openAdd(day.date)">+ Dodaj</button>
            </div>
          </article>
        </div>
      </div>
      <p v-if="wholeWeek" class="scroll-hint">Przewiń w bok, aby zobaczyć pozostałe dni tygodnia.</p>
    </template>

    <div v-if="showForm" class="modal-backdrop" @click.self="closeForm">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
        <div class="modal-heading"><h2 id="schedule-modal-title">{{ editingId !== null ? 'Edytuj aktywność' : 'Dodaj aktywność' }}</h2><button type="button" class="close-button" :disabled="saving" @click="closeForm">×</button></div>
        <form @submit.prevent="saveItem">
          <label for="activity-title">Tytuł aktywności</label>
          <input id="activity-title" v-model="form.title" type="text" maxlength="150" required placeholder="Np. spacer po centrum" />
          <div class="form-grid">
            <div><label for="activity-date">Data</label><input id="activity-date" v-model="form.date" type="date" :min="dateOnly(startDate) || undefined" :max="dateOnly(endDate) || undefined" required /></div>
            <div><label for="activity-time">Godzina (opcjonalnie)</label><input id="activity-time" v-model="form.time" type="time" /></div>
          </div>
          <label for="activity-description">Opis (opcjonalnie)</label>
          <textarea id="activity-description" v-model="form.description" rows="4" placeholder="Dodatkowe informacje o aktywności"></textarea>
          <p v-if="error" class="feedback error" role="alert">{{ error }}</p>
          <div class="modal-actions"><button type="button" class="secondary-button" :disabled="saving" @click="closeForm">Anuluj</button><button type="submit" class="primary-button" :disabled="saving">{{ saving ? 'Zapisywanie...' : 'Zapisz aktywność' }}</button></div>
        </form>
      </section>
    </div>

    <div v-if="deleteTarget" class="modal-backdrop" @click.self="!deleting && (deleteTarget = null)">
      <section class="modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-activity-title">
        <h2 id="delete-activity-title">Usunąć aktywność?</h2>
        <p>Czy na pewno chcesz usunąć „{{ deleteTarget.title }}” z harmonogramu?</p>
        <p v-if="error" class="feedback error" role="alert">{{ error }}</p>
        <div class="modal-actions"><button type="button" class="secondary-button" :disabled="deleting" @click="deleteTarget = null">Anuluj</button><button type="button" class="delete-button" :disabled="deleting" @click="confirmDelete">{{ deleting ? 'Usuwanie...' : 'Tak, usuń' }}</button></div>
      </section>
    </div>
  </section>
</template>



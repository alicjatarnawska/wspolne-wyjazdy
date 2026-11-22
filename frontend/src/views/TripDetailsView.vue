<script setup>
import { ref, computed, onMounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import TripSchedule from '../components/TripSchedule.vue' 
import TripTasks from '../components/TripTasks.vue'

//pobranie identyfikatora wyjazdu z adresu strony
const tripId = window.location.pathname.match(/^\/trips\/(\d+)\/?$/)?.[1]

//pobranie tokenu zalogowanego użytkownika
const token = sessionStorage.getItem('token')

//dane wyjazdu i lista jego uczestników
const trip = ref(null)
const members = ref([])

//stany ładowania oraz komunikaty o błędach i powodzeniu operacji
const loading = ref(true)
const error = ref('')
const actionError = ref('')
const actionSuccess = ref('')

//aktualnie wybrana zakładka szczegółów wyjazdu
const activeTab = ref('overview')

//dane formularza dodawania uczestnika
const email = ref('')
const inviting = ref(false)

//stany edycji roli i usuwania uczestnika
const changingRoleId = ref(null)
const editingMember = ref(null)
const selectedRole = ref('PARTICIPANT')
const confirmRemoval = ref(false)
const removingMember = ref(false)

//sprawdzenie uprawnień zalogowanego użytkownika
const isOrganizer = computed(() => trip.value?.my_role === 'ORGANIZER')

//sprawdzenie czy edytowana osoba jest jedynym organizatorem
const isLastOrganizer = computed(() =>
  editingMember.value?.role === 'ORGANIZER' &&
  members.value.filter(member => member.role === 'ORGANIZER').length === 1
)

//blokowanie zapisu przy braku zmian lub niedozwolonej zmianie roli
const cannotSaveRole = computed(() =>
  !editingMember.value ||
  selectedRole.value === editingMember.value.role ||
  (isLastOrganizer.value && selectedRole.value === 'PARTICIPANT') ||
  changingRoleId.value !== null || removingMember.value
)

//lista zakładek dostępnych w szczegółach wyjazdu
const tabs = [
  { id: 'overview', label: 'Przegląd' },
  { id: 'schedule', label: 'Harmonogram' },
  { id: 'members', label: 'Uczestnicy' },
  { id: 'tasks', label: 'Zadania' },
  { id: 'expenses', label: 'Wydatki' },
  { id: 'documents', label: 'Dokumenty' }
]
const selectedTab = computed(() => tabs.find(t => t.id === activeTab.value))

//formatowanie daty na dd.mm.rrrr
function formatDate(date) {
  if (!date) return 'Nie podano'
  const [year, month, day] = String(date).slice(0, 10).split('-')
  return `${day}.${month}.${year}`
}

//data słownie w podsumowaniu wyjazdu
function formatDateLong(date) {
  if (!date) return 'Nie podano'
  const [year, month, day] = String(date).slice(0, 10).split('-')
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

//edycja danych wyjazdu i operacje na wyjeździe
const tripAction = ref('')
const tripActionBusy = ref(false)
const tripActionError = ref('')
const editTripForm = ref({ name: '', destination: '', start_date: '', end_date: '', description: '' })

function openTripEdit() {
  editTripForm.value = {
    name: trip.value.name || '',
    destination: trip.value.destination || '',
    start_date: String(trip.value.start_date || '').slice(0, 10),
    end_date: String(trip.value.end_date || '').slice(0, 10),
    description: trip.value.description || ''
  }
  tripActionError.value = ''
  tripAction.value = 'edit'
}

function closeTripAction() {
  if (tripActionBusy.value) return
  tripAction.value = ''
  tripActionError.value = ''
}

async function saveTrip() {
  tripActionError.value = ''
  actionSuccess.value = ''
  actionError.value = ''
  const form = editTripForm.value
  if (!form.name.trim() || !form.destination.trim() || !form.start_date || !form.end_date) {
    tripActionError.value = 'Uzupełnij wszystkie wymagane pola.'
    return
  }
  if (form.end_date < form.start_date) {
    tripActionError.value = 'Data zakończenia nie może być wcześniejsza od daty rozpoczęcia.'
    return
  }
  tripActionBusy.value = true
  try {
    const updateResult = await api(`/api/trips/${tripId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: form.name.trim(), destination: form.destination.trim(),
        start_date: form.start_date, end_date: form.end_date,
        description: form.description.trim()
      })
    })
    const data = await api(`/api/trips/${tripId}`)
    trip.value = data.trip
    tripAction.value = ''
    actionError.value = ''
    actionSuccess.value = updateResult.message || 'Dane wyjazdu zostały zaktualizowane.'
  } catch (err) {
    tripActionError.value = err.message
  } finally {
    tripActionBusy.value = false
  }
}

async function deleteTrip() {
  tripActionBusy.value = true
  tripActionError.value = ''
  try {
    await api(`/api/trips/${tripId}`, { method: 'DELETE' })
    window.location.href = '/trips'
  } catch (err) {
    tripActionError.value = err.message
    tripActionBusy.value = false
  }
}

async function leaveTrip() {
  tripActionBusy.value = true
  tripActionError.value = ''
  try {
    await api(`/api/trips/${tripId}/leave`, { method: 'POST' })
    window.location.href = '/trips'
  } catch (err) {
    tripActionError.value = err.message
    tripActionBusy.value = false
  }
}

//wysyłanie żądań do backendu z tokenem autoryzacyjnym
async function api(path, options = {}) {
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

//pobranie aktualnej listy uczestników wyjazdu
async function loadMembers() {
  const data = await api(`/api/trips/${tripId}/members`)
  members.value = data.members || []
}

//pobranie szczegółów wyjazdu i sprawdzenie zalogowania
async function loadTrip() {
  loading.value = true
  error.value = ''
  if (!tripId) {
    error.value = 'Nieprawidłowy adres wyjazdu.'
    loading.value = false
    return
  }
  if (!token) {
    window.location.href = '/login'
    return
  }
  try {
    const data = await api(`/api/trips/${tripId}`)
    trip.value = data.trip
    await loadMembers()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

//dodanie uczestnika do wyjazdu na podstawie adresu e-mail
async function inviteMember() {
  actionError.value = ''
  actionSuccess.value = ''
  if (!email.value.trim()) return
  inviting.value = true
  try {
    const result = await api(`/api/trips/${tripId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email: email.value.trim() })
    })
    email.value = ''
    actionSuccess.value = result.message || 'Uczestnik został dodany do wyjazdu.'
    await loadMembers()
  } catch (err) {
    actionError.value = err.message
  } finally {
    inviting.value = false
  }
}

//otwarcie okna edycji wybranego uczestnika
function openMemberEditor(member) {
  editingMember.value = member
  selectedRole.value = member.role
  confirmRemoval.value = false
  actionError.value = ''
  actionSuccess.value = ''
}

//zamknięcie okna edycji uczestnika
function closeMemberEditor() {
  if (changingRoleId.value || removingMember.value) return
  editingMember.value = null
  confirmRemoval.value = false
}

//zapisanie nowej roli uczestnika i odświeżenie danych
async function saveMemberRole() {
  if (!editingMember.value || selectedRole.value === editingMember.value.role) {
    closeMemberEditor()
    return
  }
  if (isLastOrganizer.value && selectedRole.value === 'PARTICIPANT') {
    actionError.value = 'Wyjazd musi mieć przynajmniej jednego organizatora.'
    return
  }
  const memberId = editingMember.value.id
  actionError.value = ''
  actionSuccess.value = ''
  changingRoleId.value = memberId
  try {
    const result = await api(`/api/trips/${tripId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: selectedRole.value })
    })
    await loadMembers()
    const data = await api(`/api/trips/${tripId}`)
    trip.value = data.trip
    actionSuccess.value = result.message || 'Uprawnienia uczestnika zostały zapisane.'
    editingMember.value = null
  } catch (err) {
    actionError.value = err.message
  } finally {
    changingRoleId.value = null
  }
}

//usunięcie uczestnika z wyjazdu z wyjątkiem ostatniego organizatora
async function removeMember() {
  if (!editingMember.value) return
  if (isLastOrganizer.value) {
    actionError.value = 'Nie można usunąć ostatniego organizatora wyjazdu.'
    confirmRemoval.value = false
    return
  }
  const memberId = editingMember.value.id
  actionError.value = ''
  actionSuccess.value = ''
  removingMember.value = true
  try {
    const result = await api(`/api/trips/${tripId}/members/${memberId}`, { method: 'DELETE' })
    await loadMembers()
    actionSuccess.value = result.message || 'Uczestnik został usunięty z wyjazdu.'
    editingMember.value = null
    confirmRemoval.value = false
  } catch (err) {
    actionError.value = err.message
  } finally {
    removingMember.value = false
  }
}

//zmiana aktywnej zakładki i wyczyszczenie komunikatów
function changeTab(id) {
  activeTab.value = id
  actionError.value = ''
  actionSuccess.value = ''
}

//pobranie danych po otwarciu widoku
onMounted(loadTrip)
</script>

<template>
  <div class="trip-details-page">
    <Sidebar />
    <main class="trip-details-main">
      <p v-if="loading" class="trip-info-message">Ładowanie szczegółów wyjazdu...</p>
      <div v-else-if="error" class="trip-info-message trip-error" role="alert">
        {{ error }}
        <button type="button" @click="loadTrip">Spróbuj ponownie</button>
      </div>

      <template v-else-if="trip">
        <header class="trip-details-header">
          <div class="trip-heading-copy">
            <p class="trip-eyebrow">TWÓJ WYJAZD</p>
            <h1>{{ trip.name }}</h1>
            <div class="trip-meta">
              <span class="trip-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>{{ trip.destination }}</span>
              <span class="trip-meta-dot">·</span>
              <span class="trip-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>{{ formatDate(trip.start_date) }} – {{ formatDate(trip.end_date) }}</span>
            </div>
          </div>
        </header>

        <nav class="trip-details-tabs" aria-label="Sekcje wyjazdu">
          <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" :aria-current="activeTab === tab.id ? 'page' : undefined" @click="changeTab(tab.id)">{{ tab.label }}</button>
        </nav>
        
        <div v-if="actionSuccess || actionError" class="trip-feedback-area">
          <p v-if="actionSuccess" class="trip-feedback success" role="status">{{ actionSuccess }}</p>
          <p v-if="actionError" class="trip-feedback error" role="alert">{{ actionError }}</p>
        </div>

        <section v-if="activeTab === 'overview'" class="trip-overview">
          <div class="trip-section-heading trip-overview-heading"><div><p class="trip-kicker">PODSUMOWANIE</p><h2>Informacje o wyjeździe</h2></div>
          <details class="trip-management-menu">
            <summary class="trip-management-toggle" aria-label="Ustawienia wyjazdu" title="Ustawienia wyjazdu"><svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.8 1.8-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.06 1.57V20h-2.55v-.09a1.7 1.7 0 0 0-1.06-1.57 1.7 1.7 0 0 0-1.88.34l-.06.06-1.8-1.8.06-.06A1.7 1.7 0 0 0 8.05 15a1.7 1.7 0 0 0-1.57-1.06H6.4v-2.55h.08a1.7 1.7 0 0 0 1.57-1.06 1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.8-1.8.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.06-1.57V5.4H15v.08a1.7 1.7 0 0 0 1.06 1.57 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.8 1.8-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.57 1.06h.09V14h-.09A1.7 1.7 0 0 0 19.4 15Z" transform="translate(-1 -1)"/></svg></summary>
            <div class="trip-management-actions">
              <button v-if="isOrganizer" type="button" class="trip-manage-button" @click="openTripEdit">Edytuj wyjazd</button>
              <button v-if="isOrganizer" type="button" class="trip-manage-button danger" @click="tripActionError = ''; tripAction = 'delete'">Usuń wyjazd</button>
              <button type="button" class="trip-manage-button danger" @click="tripActionError = ''; tripAction = 'leave'">Opuść wyjazd</button>
            </div>
          </details>
          </div>
          <div class="trip-summary-grid">
            <article class="trip-summary-item"><div class="trip-summary-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></div><span>Miejsce docelowe</span><strong>{{ trip.destination }}</strong></article>
            <article class="trip-summary-item"><div class="trip-summary-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg></div><span>Rozpoczęcie</span><strong>{{ formatDateLong(trip.start_date) }}</strong></article>
            <article class="trip-summary-item"><div class="trip-summary-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg></div><span>Zakończenie</span><strong>{{ formatDateLong(trip.end_date) }}</strong></article>
            <article class="trip-summary-item"><div class="trip-summary-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/></svg></div><span>Uczestnicy</span><strong>{{ members.length }}</strong></article>
          </div>
          <article class="trip-description-card"><div class="trip-description-heading"><h2>Opis wyjazdu</h2></div><p class="trip-description">{{ trip.description || 'Nie dodano jeszcze opisu wyjazdu.' }}</p></article>
        </section>

        <section v-else-if="activeTab === 'schedule'" class="trip-schedule">
          <TripSchedule
            :trip-id="tripId"
            :start-date="trip.start_date"
            :end-date="trip.end_date"
          />
        </section>

        <section v-else-if="activeTab === 'members'" class="trip-panel">
          <div class="trip-section-heading"><div><p class="trip-kicker">WSPÓLNE PLANOWANIE</p><h2>Uczestnicy wyjazdu</h2></div></div>
          <div v-if="isOrganizer" class="trip-invite-box"><h3>Dodaj uczestnika</h3><p>Zaproś osobę, która ma już konto w TravelTogether.</p><form class="trip-invite-form" @submit.prevent="inviteMember"><input v-model="email" type="email" required placeholder="Adres e-mail użytkownika" aria-label="Adres e-mail użytkownika"/><button type="submit" :disabled="inviting">{{ inviting ? 'Dodawanie...' : '+ Dodaj uczestnika' }}</button></form></div>
          <div v-if="!members.length" class="trip-empty">Brak uczestników do wyświetlenia.</div>
          <div v-else class="trip-member-list"><div v-for="member in members" :key="member.id" class="trip-member"><div class="trip-member-avatar">{{ (member.display_name || member.email || '?').charAt(0).toUpperCase() }}</div><div class="trip-member-info"><strong>{{ member.display_name || member.email }}</strong><span>{{ member.email }}</span></div><span class="trip-member-role" :class="member.role === 'ORGANIZER' ? 'organizer' : 'participant'">{{ member.role === 'ORGANIZER' ? 'Organizator' : 'Uczestnik' }}</span><button v-if="isOrganizer" type="button" class="trip-role-button" @click="openMemberEditor(member)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/></svg>Edytuj</button></div></div>
        </section>

        <section v-else-if="activeTab === 'tasks'" class="trip-tasks">
          <TripTasks
            :trip-id="tripId"
            :members="members"
          />
        </section>
       
      </template>

      <!--okno edycji, usuwania lub opuszczania wyjazdu-->
      <div v-if="tripAction" class="trip-modal-backdrop" @click.self="closeTripAction">
        <section class="trip-management-modal" role="dialog" aria-modal="true" aria-labelledby="trip-management-title">
          <div class="trip-modal-heading">
            <h2 id="trip-management-title">{{ tripAction === 'edit' ? 'Edytuj wyjazd' : tripAction === 'delete' ? 'Usuń wyjazd' : 'Opuść wyjazd' }}</h2>
            <button type="button" class="trip-modal-close" :disabled="tripActionBusy" @click="closeTripAction">×</button>
          </div>
          <form v-if="tripAction === 'edit'" class="trip-management-form" @submit.prevent="saveTrip">
            <label>Nazwa wyjazdu <input v-model="editTripForm.name" required maxlength="100" /></label>
            <label>Miejsce docelowe <input v-model="editTripForm.destination" required maxlength="100" /></label>
            <div class="trip-management-dates">
              <label>Data rozpoczęcia <input v-model="editTripForm.start_date" type="date" required /></label>
              <label>Data zakończenia <input v-model="editTripForm.end_date" type="date" :min="editTripForm.start_date" required /></label>
            </div>
            <label>Opis wyjazdu <textarea v-model="editTripForm.description" rows="4" maxlength="500"></textarea></label>
            <p v-if="tripActionError" class="trip-feedback error" role="alert">{{ tripActionError }}</p>
            <div class="trip-management-footer">
              <button type="button" class="trip-cancel-btn" :disabled="tripActionBusy" @click="closeTripAction">Anuluj</button>
              <button type="submit" class="trip-save-btn" :disabled="tripActionBusy">{{ tripActionBusy ? 'Zapisywanie...' : 'Zapisz zmiany' }}</button>
            </div>
          </form>
          <div v-else class="trip-management-confirm">
            <p v-if="tripAction === 'delete'">Czy na pewno chcesz trwale usunąć ten wyjazd? Ta operacja może usunąć również jego harmonogram, zadania i pozostałe dane.</p>
            <p v-else>Czy na pewno chcesz opuścić wyjazd? Utracisz do niego dostęp. Jeśli jesteś jedynym organizatorem, najpierw nadaj tę rolę innej osobie.</p>
            <p v-if="tripActionError" class="trip-feedback error" role="alert">{{ tripActionError }}</p>
            <div class="trip-management-footer">
              <button type="button" class="trip-cancel-btn" :disabled="tripActionBusy" @click="closeTripAction">Anuluj</button>
              <button type="button" class="trip-delete-confirm-btn" :disabled="tripActionBusy" @click="tripAction === 'delete' ? deleteTrip() : leaveTrip()">{{ tripActionBusy ? 'Przetwarzanie...' : tripAction === 'delete' ? 'Tak, usuń wyjazd' : 'Tak, opuść wyjazd' }}</button>
            </div>
          </div>
        </section>
      </div>

      <div v-if="editingMember" class="trip-modal-backdrop" @click.self="closeMemberEditor">
        <section class="trip-member-modal" role="dialog" aria-modal="true" aria-labelledby="member-modal-title">
          <div class="trip-modal-heading">
            <div>
              <p class="trip-kicker">ZARZĄDZANIE UCZESTNIKIEM</p>
              <h2 id="member-modal-title">Edytuj uczestnika</h2>
            </div>
            <button type="button" class="trip-modal-close" aria-label="Zamknij" :disabled="!!changingRoleId || removingMember" @click="closeMemberEditor">×</button>
          </div>
          <div class="trip-modal-person">
            <div class="trip-member-avatar">{{ (editingMember.display_name || editingMember.email || '?').charAt(0).toUpperCase() }}</div>
            <div class="trip-member-info"><strong>{{ editingMember.display_name || editingMember.email }}</strong><span>{{ editingMember.email }}</span></div>
          </div>

          <template v-if="!confirmRemoval">
            <p class="trip-modal-label">Uprawnienia w wyjeździe</p>
            <div class="trip-role-options">
              <label class="trip-role-option" :class="{ selected: selectedRole === 'ORGANIZER' }">
                <input v-model="selectedRole" type="radio" value="ORGANIZER" name="member-role" />
                <span><strong>Organizator</strong><small>   Posiada wszystkie uprawnienia uczestnika. Dodatkowo może edytować szczegóły wyjazdu, zapraszać i usuwać uczestników oraz zarządzać ich uprawnieniami.</small></span>
              </label>
              <label class="trip-role-option" :class="{ selected: selectedRole === 'PARTICIPANT', disabled: isLastOrganizer }">
                <input v-model="selectedRole" type="radio" value="PARTICIPANT" name="member-role" :disabled="isLastOrganizer" />
                <span><strong>Uczestnik</strong><small>  Może współtworzyć plan wyjazdu, dodawać punkty do harmonogramu, zarządzać zadaniami oraz dodawać wydatki.</small></span>
              </label>
            </div>
            <div v-if="isLastOrganizer" class="trip-organizer-notice" role="note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
              <span>Każdy wyjazd musi mieć przynajmniej jednego organizatora.<template v-if="isLastOrganizer"> Aby zmienić swoją rolę lub usunąć się z wyjazdu, najpierw nadaj innej osobie uprawnienia organizatora.</template></span>
            </div>
            <p v-if="actionError" class="trip-feedback error" role="alert">{{ actionError }}</p>
            <div class="trip-modal-actions">
              <button type="button" class="trip-delete-btn" :disabled="isLastOrganizer" :title="isLastOrganizer ? 'Nie można usunąć ostatniego organizatora' : undefined" @click="confirmRemoval = true; actionError = ''">Usuń z wyjazdu</button>
              <div class="trip-modal-actions-right">
                <button type="button" class="trip-cancel-btn" @click="closeMemberEditor">Anuluj</button>
                <button type="button" class="trip-save-btn" :disabled="cannotSaveRole" @click="saveMemberRole">{{ changingRoleId ? 'Zapisywanie...' : 'Zapisz zmiany' }}</button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="trip-removal-warning"><strong>Usunąć uczestnika z wyjazdu?</strong><p>Ta osoba straci dostęp do wyjazdu. Można ją później zaprosić ponownie.</p></div>
            <p v-if="actionError" class="trip-feedback error" role="alert">{{ actionError }}</p>
            <div class="trip-modal-actions trip-modal-actions-right">
              <button type="button" class="trip-cancel-btn" :disabled="removingMember" @click="confirmRemoval = false">Wróć do edycji</button>
              <button type="button" class="trip-delete-confirm-btn" :disabled="removingMember" @click="removeMember">{{ removingMember ? 'Usuwanie...' : 'Tak, usuń uczestnika' }}</button>
            </div>
          </template>
        </section>
      </div>
    </main>
  </div>
</template>

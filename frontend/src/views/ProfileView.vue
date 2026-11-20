
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Sidebar from '../components/Sidebar.vue'

//aktualnie wybrana zakładka profilu: dane użytkownika lub bezpieczeństwo
const activeTab = ref('profile')

//dane zalogowanego użytkownika odczytane z pamięci sesji
const user = ref(
  JSON.parse(sessionStorage.getItem('user') || '{}')
)

//statystyki wyjazdów wyświetlane na profilu
const stats = ref({
  total_trips: 0,
  organized_trips: 0,
  participant_trips: 0
})


const upcomingTrips = ref([])
const loading = ref(true)
const error = ref('')
const success = ref('')

const emailError = ref('')
const emailSuccess = ref('')

const passwordError = ref('')
const passwordSuccess = ref('')
const deleteError = ref('')

const editingName = ref(false)
const displayName = ref('')

const editingEmail = ref(false)
const email = ref('')

const editingPassword = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const showDeleteModal = ref(false)
const deletePassword = ref('')
const deleting = ref(false)
const accountDeleted = ref(false)
let redirectTimer = null

//blokuje przyciski podczas zapisywania zmian
const saving = ref(false)

//wspólny adres bazowy endpointów obsługujących użytkowników
const API_URL = '/api/users'

//przygotowuje nagłówki JSON i token JWT wymagany przez chronione endpointy
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem('token')}`
  }
}

//pobiera profil, statystyki i nadchodzące wyjazdy z backendu
async function fetchProfile() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_URL}/profile`, {
      headers: authHeaders()
    })

    if (!response.ok) {
      throw new Error('Nie udało się pobrać profilu.')
    }

    const data = await response.json()

    user.value = data.user
    stats.value = data.stats
    upcomingTrips.value = data.upcoming_trips || []

    //odświeżenie lokalnych danych użytkownika bez ponownego logowania
    sessionStorage.setItem('user', JSON.stringify(data.user))

    displayName.value = data.user.display_name || ''
    email.value = data.user.email || ''
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

//po otwarciu widoku sprawdza zalogowanie i pobiera aktualne dane
onMounted(() => {
  const token = sessionStorage.getItem('token')

  if (!token) {
    window.location.href = '/login'
    return
  }

  fetchProfile()
})

function formatDate(date) {
  if (!date) return 'Brak danych'

  return new Date(date).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

//przełącza zakładkę i czyści komunikaty z poprzedniego widoku
function changeTab(tab) {
  activeTab.value = tab
  error.value = ''
  success.value = ''
}

//sprawdza nazwę, wysyła żądanie PATCH i aktualizuje dane sesji
async function updateDisplayName() {
  error.value = ''
  success.value = ''
  const newName = displayName.value.trim()

  if (!newName) {
    error.value = 'Nazwa użytkownika nie może być pusta.'
    return
  }
  if (newName.length > 50) {
    error.value = 'Nazwa użytkownika może mieć maksymalnie 50 znaków.'
    return
  }

  saving.value = true
  try {
    const response = await fetch(`${API_URL}/profile/display-name`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ display_name: newName })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Nie udało się zmienić nazwy użytkownika.')

    user.value = data.user
    sessionStorage.setItem('user', JSON.stringify(data.user))
    if (data.token) sessionStorage.setItem('token', data.token)
    displayName.value = data.user.display_name || ''
    editingName.value = false
    success.value = data.message || 'Nazwa użytkownika została zmieniona.'
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

async function updateEmail() {
  emailError.value = ''
  emailSuccess.value = ''
  const newEmail = email.value.trim()

  if (!newEmail) {
    emailError.value = 'Adres e-mail nie może być pusty.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) || newEmail.length > 255) {
    emailError.value = 'Podaj poprawny adres e-mail.'
    return
  }

  saving.value = true
  try {
    const response = await fetch(`${API_URL}/profile/email`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ email: newEmail })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Nie udało się zmienić adresu e-mail.')

    user.value = data.user
    sessionStorage.setItem('user', JSON.stringify(data.user))
    if (data.token) sessionStorage.setItem('token', data.token)
    email.value = data.user.email || ''
    editingEmail.value = false
    emailSuccess.value = data.message || 'Adres e-mail został zmieniony.'
  } catch (err) {
    emailError.value = err.message
  } finally {
    saving.value = false
  }
}

function cancelName() {
  displayName.value = user.value.display_name || ''
  editingName.value = false
  error.value = ''
}

function cancelEmail() {
  email.value = user.value.email || ''
  editingEmail.value = false
  emailError.value = ''
  emailSuccess.value = ''
}


async function changePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    passwordError.value = 'Wypełnij wszystkie pola.'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Nowe hasła nie są identyczne.'
    return
  }

  if (newPassword.value.length < 6) {
    passwordError.value = 'Nowe hasło musi mieć co najmniej 6 znaków.'
    return
  }

  saving.value = true

  try {
    const response = await fetch(`${API_URL}/profile/password`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Nie udało się zmienić hasła.')
    }

    passwordSuccess.value = 'Hasło zostało pomyślnie zmienione.'

    editingPassword.value = false
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''

  } catch (err) {
    passwordError.value = err.message
  } finally {
    saving.value = false
  }
}


function cancelPassword() {
  editingPassword.value = false
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordSuccess.value = ''
}

async function deleteAccount() {
  if (!deletePassword.value) {
    deleteError.value = 'Podaj hasło, aby potwierdzić usunięcie konta.'
    return
  }

  deleting.value = true
  deleteError.value = ''

  try {
    const response = await fetch(`${API_URL}/profile`, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({
        password: deletePassword.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Nie udało się usunąć konta.')
    }

    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')

    showDeleteModal.value = false
    deletePassword.value = ''

    //wyświetlenie potwierdzenia przed automatycznym przejściem do logowania
    accountDeleted.value = true
    redirectTimer = setTimeout(goToLogin, 3000)
  } catch (err) {
    deleteError.value = err.message
  } finally {
    deleting.value = false
  }
}

//zamyka okno usuwania konta
function closeDeleteModal() {
  if (deleting.value) return
  showDeleteModal.value = false
  deletePassword.value = ''
  deleteError.value = ''
}

//przekierowuje do logowania i zatrzymuje oczekujący licznik
function goToLogin() {
  if (redirectTimer) clearTimeout(redirectTimer)
  window.location.href = '/login'
}

//czyści licznik przekierowania po opuszczeniu komponentu
onUnmounted(() => {
  if (redirectTimer) clearTimeout(redirectTimer)
})
</script>

<template>
  <div class="trips-page">

    <header class="trips-header">
      <div class="trips-logo">TravelTogether</div>
    </header>

    <div class="trips-layout">
      <Sidebar />

      <main class="trips-content">

        
        <div class="profile-tabs">
          <button
            class="profile-tab"
            :class="{ active: activeTab === 'profile' }"
            @click="changeTab('profile')"
          >
            Mój profil
          </button>

          <button
            class="profile-tab"
            :class="{ active: activeTab === 'security' }"
            @click="changeTab('security')"
          >
            Bezpieczeństwo
          </button>
        </div>

        
        <div class="profile-card profile-tab-card">

          
          <p v-if="error" class="profile-alert profile-alert-error">
            {{ error }}
          </p>

          <p v-if="success" class="profile-alert profile-alert-success">
            {{ success }}
          </p>

          <p v-if="loading" class="profile-loading">
            Ładowanie profilu...
          </p>

          <template v-else>

            
            
            
            <div v-if="activeTab === 'profile'">

              
              <div class="profile-user">

                <div class="profile-avatar">
                  <img src="/icons/profile.svg" alt="" />
                </div>

                <div class="profile-user-info">

                  <div v-if="!editingName" class="profile-name-row">
                    <h2>{{ user.display_name || 'Użytkownik' }}</h2>

                    <button
                      class="profile-pencil-btn"
                      title="Edytuj nazwę użytkownika"
                      aria-label="Edytuj nazwę użytkownika"
                      @click="editingName = true"
                    >
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                  </div>

                  
                  <div v-else class="profile-name-edit">
                    <input
                      v-model="displayName"
                      type="text"
                      maxlength="50"
                      class="profile-input"
                      placeholder="Nazwa użytkownika"
                    />

                    <button
                      class="profile-save-btn"
                      :disabled="saving"
                      @click="updateDisplayName"
                    >
                      Zapisz
                    </button>

                    <button
                      class="profile-cancel-btn"
                      @click="cancelName"
                    >
                      Anuluj
                    </button>
                  </div>

                  <p>{{ user.role || 'Użytkownik' }}</p>

                  <p class="profile-member-since">
                    Podróżnik od: {{ formatDate(user.created_at) }}
                  </p>

                </div>
              </div>

              
              <div class="profile-stats-section">

                <h3>Moje statystyki</h3>

                <div class="profile-stats-grid">

                  <div class="profile-stat-card">
                    <span class="profile-stat-number">
                      {{ stats.total_trips }}
                    </span>
                    <span class="profile-stat-label">
                      Wszystkie wyjazdy
                    </span>
                  </div>

                  <div class="profile-stat-card">
                    <span class="profile-stat-number">
                      {{ stats.organized_trips }}
                    </span>
                    <span class="profile-stat-label">
                      Organizowane wyjazdy
                    </span>
                  </div>

                  <div class="profile-stat-card">
                    <span class="profile-stat-number">
                      {{ stats.participant_trips }}
                    </span>
                    <span class="profile-stat-label">
                      Wyjazdy jako uczestnik
                    </span>
                  </div>

                </div>
              </div>

              
              <div class="profile-upcoming-section">

                <h3>Nadchodzące wyjazdy</h3>

                <p class="profile-upcoming-description">
                  Wyjazdy rozpoczynające się w ciągu najbliższych 7 dni.
                </p>

                <div
                  v-if="upcomingTrips.length === 0"
                  class="profile-upcoming-empty"
                >
                  Nie masz wyjazdów rozpoczynających się w najbliższych 7 dniach.
                </div>

                <div v-else class="profile-upcoming-list">

                  <div
                    v-for="trip in upcomingTrips"
                    :key="trip.id"
                    class="profile-upcoming-trip"
                  >
                    <div>
                      <h4>{{ trip.name }}</h4>

                      <p>
                        {{ trip.destination || 'Nie podano miejsca' }}
                      </p>

                      <span>
                        {{ formatDate(trip.start_date) }}
                        –
                        {{ formatDate(trip.end_date) }}
                      </span>
                    </div>

                    <span class="profile-days-badge">
                      {{ trip.days_left === 0
                        ? 'Dzisiaj!'
                        : `Za ${trip.days_left} dni` }}
                    </span>
                  </div>

                </div>

              </div>

            </div>

            
            
            
            <div v-else class="profile-security">

              
              <div class="profile-security-section">

                <h3>Adres e-mail</h3>

                <div v-if="!editingEmail" class="profile-email-row">

                  <div class="profile-field">
                    <div class="profile-field-value">
                      {{ user.email || 'Brak danych' }}
                    </div>
                  </div>

                  <button
                    class="profile-edit-btn"
                    @click="editingEmail = true; emailError = ''; emailSuccess = ''"
                  >
                    Edytuj
                  </button>
                </div>

                <div v-else class="profile-edit-form">

                  <div class="profile-field">
                    <label for="new-email">Nowy adres e-mail</label>
                    <input
                      id="new-email"
                      v-model="email"
                      type="email"
                      class="profile-input"
                      placeholder="Nowy adres e-mail"
                    />
                  </div>

                  <div class="profile-form-actions">
                    <button
                      class="profile-cancel-btn"
                      @click="cancelEmail"
                    >
                      Anuluj
                    </button>

                    <button
                      class="profile-save-btn"
                      :disabled="saving"
                      @click="updateEmail"
                    >
                      Zapisz zmiany
                    </button>
                  </div>

                </div>

                <p v-if="emailError || emailSuccess"
                   class="profile-inline-message"
                   :class="emailError ? 'profile-inline-error' : 'profile-inline-success'"
                   :role="emailError ? 'alert' : 'status'">
                  {{ emailError || emailSuccess }}
                </p>
              </div>

              
              <div class="profile-security-section">

                <h3>Hasło</h3>

                <p
                  v-if="passwordSuccess"
                  class="profile-inline-message profile-inline-success"
                >
                  {{ passwordSuccess }}
                </p>

                <button
                  v-if="!editingPassword"
                  class="profile-edit-btn"
                  @click="editingPassword = true"
                >
                  Zmień hasło
                </button>

                <div v-else class="profile-edit-form">

                  <div class="profile-field">
                    <label for="current-password">Aktualne hasło</label>
                    <input
                      id="current-password"
                      v-model="currentPassword"
                      type="password"
                      class="profile-input"
                      placeholder="Aktualne hasło"
                    />
                  </div>

                  <div class="profile-field">
                    <label for="new-password">Nowe hasło</label>
                    <input
                      id="new-password"
                      v-model="newPassword"
                      type="password"
                      class="profile-input"
                      placeholder="Nowe hasło"
                    />
                  </div>

                  <div class="profile-field">
                    <label for="confirm-password">Potwierdź nowe hasło</label>
                    <input
                      id="confirm-password"
                      v-model="confirmPassword"
                      type="password"
                      class="profile-input"
                      placeholder="Potwierdź nowe hasło"
                    />
                  </div>

                  <p
                    v-if="passwordError"
                    class="profile-inline-message profile-inline-error"
                    role="alert"
                  >
                    {{ passwordError }}
                  </p>

                  <div class="profile-form-actions">
                    <button
                      class="profile-cancel-btn"
                      @click="cancelPassword"
                    >
                      Anuluj
                    </button>

                    <button
                      class="profile-save-btn"
                      :disabled="saving"
                      @click="changePassword"
                    >
                      Zapisz zmiany
                    </button>
                  </div>

                </div>

              </div>

              
              <div class="profile-danger-zone">

                <h3>Strefa niebezpieczna</h3>

                <p>
                  Usunięcie konta jest nieodwracalne.
                  Utracisz dostęp do swojego profilu oraz
                  powiązanych z nim danych.
                </p>

                <button
                  class="profile-delete-btn"
                  @click="showDeleteModal = true"
                >
                  Usuń konto
                </button>

              </div>

            </div>

          </template>

        </div>

      </main>
    </div>

    
    <div
      v-if="showDeleteModal"
      class="profile-modal-overlay"
      @click.self="!deleting && closeDeleteModal()"
    >
      <div
        class="profile-modal profile-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
      >
        <button
          type="button"
          class="profile-dialog-close"
          aria-label="Zamknij okno"
          :disabled="deleting"
          @click="closeDeleteModal"
        >
          &times;
        </button>

        <h2 id="delete-account-title">Czy na pewno chcesz usunąć konto?</h2>
        <p id="delete-account-description" class="profile-delete-description">
          Ta decyzja jest nieodwracalna. Stracisz dostęp do swojego profilu
          i powiązanych z nim danych.
        </p>

        <div class="profile-delete-notice">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>Aby potwierdzić usunięcie, wpisz swoje aktualne hasło.</span>
        </div>

        <form class="profile-delete-form" @submit.prevent="deleteAccount">
          <label for="delete-password">Aktualne hasło</label>
          <input
            id="delete-password"
            v-model="deletePassword"
            type="password"
            class="profile-input"
            placeholder="Wpisz aktualne hasło"
            autocomplete="current-password"
            :disabled="deleting"
            required
          />

          <p v-if="deleteError" class="profile-delete-error" role="alert">
            {{ deleteError }}
          </p>

          <div class="profile-delete-actions">
            <button type="button" class="profile-keep-account-btn" :disabled="deleting" @click="closeDeleteModal">
              Zachowaj konto
            </button>
            <button type="submit" class="profile-delete-confirm-btn" :disabled="deleting || !deletePassword">
              {{ deleting ? 'Usuwanie...' : 'Usuń konto na stałe' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="accountDeleted" class="profile-modal-overlay">
      <div class="profile-modal profile-deleted-modal" role="dialog" aria-modal="true" aria-labelledby="account-deleted-title">
        <div class="profile-deleted-icon" aria-hidden="true">✓</div>
        <h2 id="account-deleted-title">Konto zostało usunięte</h2>
        <p>Twoje konto zostało pomyślnie usunięte. Za chwilę nastąpi przekierowanie do strony logowania.</p>
        <button class="profile-save-btn" @click="goToLogin">Przejdź do logowania</button>
      </div>
    </div>

  </div>
</template>

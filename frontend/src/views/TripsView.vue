<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Sidebar from '../components/Sidebar.vue'

//lista wyjazdow pobranych z backendu
const trips = ref([])
const loading = ref(true)
const error = ref('')

//ustawienia wyszukiwania, filtrowania i paginacji
const activeTab = ref('upcoming')
const searchQuery = ref('')
const roleFilter = ref('ALL')
const sortOrder = ref('nearest')
const currentPage = ref(1)
const pageSize = 6

//kolory tla miniatur wyjazdow
const colors = ['#b9dce7', '#d8e6f1', '#e5d6c2']

//zamiana daty na czytelny format
function formatDate(date) {
  if (!date) return 'Nie podano'
  const [year, month, day] = String(date).slice(0, 10).split('-')
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

//pobranie lokalnej daty w formacie RRRR-MM-DD
function todayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

//sprawdzenie, czy wyjazd juz sie zakonczyl
function isArchived(trip) {
  return Boolean(trip.end_date && String(trip.end_date).slice(0, 10) < todayDate())
}

//liczba nadchodzacych i zakonczonych wyjazdow
const upcomingCount = computed(() => trips.value.filter(trip => !isArchived(trip)).length)
const archivedCount = computed(() => trips.value.filter(isArchived).length)

//filtrowanie wyjazdow wedlug zakladki, wyszukiwania i roli
const filteredTrips = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('pl-PL')

  const result = trips.value.filter(trip => {
    const archived = isArchived(trip)
    if (activeTab.value === 'archive' ? !archived : archived) return false
    if (roleFilter.value !== 'ALL' && trip.role !== roleFilter.value) return false

    const name = String(trip.name ?? '').toLocaleLowerCase('pl-PL')
    const destination = String(trip.destination ?? '').toLocaleLowerCase('pl-PL')
    return !query || name.includes(query) || destination.includes(query)
  })

  result.sort((a, b) => {
    const aDate = String(a.start_date ?? '').slice(0, 10)
    const bDate = String(b.start_date ?? '').slice(0, 10)

    if (sortOrder.value === 'name') {
      return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pl')
    }

    //brak daty umieszczamy na koncu listy
    if (!aDate) return bDate ? 1 : 0
    if (!bDate) return -1

    return sortOrder.value === 'latest'
      ? bDate.localeCompare(aDate)
      : aDate.localeCompare(bDate)
  })

  return result
})

//wyjazdy wyswietlane na aktualnej stronie
const totalPages = computed(() => Math.max(1, Math.ceil(filteredTrips.value.length / pageSize)))
const paginatedTrips = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredTrips.value.slice(start, start + pageSize)
})

//reset strony po zmianie filtrow
watch([activeTab, searchQuery, roleFilter, sortOrder], () => {
  currentPage.value = 1
})

//zabezpieczenie numeru strony po zmianie liczby wyjazdow
watch(totalPages, pages => {
  if (currentPage.value > pages) currentPage.value = pages
})

//pobieranie wyjazdow zalogowanego uzytkownika
async function loadTrips() {
  loading.value = true
  error.value = ''

  try {
    const token = sessionStorage.getItem('token')
    if (!token) {
      window.location.href = '/login'
      return
    }

    const response = await fetch('/api/trips', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Nie udało się pobrać wyjazdów.')
    }

    trips.value = Array.isArray(data.trips) ? data.trips : []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function createTrip() {
  window.location.href = '/trips/create'
}

function openTrip(tripId) {
  window.location.href = `/trips/${tripId}`
}

onMounted(loadTrips)
</script>

<template>
  <div class="trips-page">
    <header class="trips-header">
      <div class="trips-logo">TravelTogether</div>
    </header>

    <div class="trips-layout">
      <Sidebar />

      <main class="trips-content">
        <div class="trips-heading">
          <div>
            <h1>Moje wyjazdy</h1>
          </div>
          <button class="trips-create-btn" @click="createTrip">+ Utwórz wyjazd</button>
        </div>

        <p v-if="loading" class="trips-message">Ładowanie wyjazdów...</p>
        <p v-else-if="error" class="trips-error">{{ error }}</p>

        <template v-else>
          <!--przelaczanie pomiedzy nadchodzacymi i zakonczonymi wyjazdami-->
          <div class="trips-tabs" role="tablist" aria-label="Rodzaj wyjazdów">
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'upcoming'"
              :class="{ active: activeTab === 'upcoming' }"
              @click="activeTab = 'upcoming'"
            >
              Nadchodzące <span>{{ upcomingCount }}</span>
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'archive'"
              :class="{ active: activeTab === 'archive' }"
              @click="activeTab = 'archive'"
            >
              Archiwum <span>{{ archivedCount }}</span>
            </button>
          </div>

          <!--wyszukiwarka i filtry listy wyjazdow-->
          <div class="trips-toolbar">
            <label class="trips-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <circle cx="10.8" cy="10.8" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Szukaj nazwy lub miejsca..."
                aria-label="Szukaj wyjazdów"
              />
            </label>

            <div class="trips-toolbar-selects">
              <label class="trips-select-wrap">
                <span>Rola</span>
                <select v-model="roleFilter" aria-label="Filtruj według roli">
                  <option value="ALL">Wszystkie role</option>
                  <option value="ORGANIZER">Organizator</option>
                  <option value="PARTICIPANT">Uczestnik</option>
                </select>
              </label>
              <label class="trips-select-wrap">
                <span>Sortuj</span>
                <select v-model="sortOrder" aria-label="Sortowanie wyjazdów">
                  <option value="nearest">Od najwcześniejszych</option>
                  <option value="latest">Od najpóźniejszych</option>
                  <option value="name">Alfabetycznie</option>
                </select>
              </label>
            </div>
          </div>

          <!--lista wyjazdow po zastosowaniu filtrow-->
          <div v-if="filteredTrips.length === 0" class="trips-empty">
            <template v-if="trips.length === 0">
              <h3>Nie masz jeszcze żadnych wyjazdów</h3>
              <p>Kliknij „Utwórz wyjazd”, aby rozpocząć planowanie.</p>
            </template>
            <template v-else-if="searchQuery || roleFilter !== 'ALL'">
              <h3>Nie znaleziono wyjazdów</h3>
              <p>Spróbuj zmienić wyszukiwaną frazę lub wybrane filtry.</p>
              <button class="trips-clear-btn" @click="searchQuery = ''; roleFilter = 'ALL'">Wyczyść filtry</button>
            </template>
            <template v-else-if="activeTab === 'archive'">
              <h3>Archiwum jest puste</h3>
              <p>Zakończone wyjazdy będą pojawiać się tutaj automatycznie.</p>
            </template>
            <template v-else>
              <h3>Brak nadchodzących wyjazdów</h3>
              <p>Utwórz nowy wyjazd lub zajrzyj do archiwum.</p>
            </template>
          </div>

          <template v-else>
            <div class="trips-cards">
              <div
                v-for="(trip, index) in paginatedTrips"
                :key="trip.id"
                class="trips-card"
                role="link"
                tabindex="0"
                @click="openTrip(trip.id)"
                @keydown.enter="openTrip(trip.id)"
                @keydown.space.prevent="openTrip(trip.id)"
              >
                <div
                  class="trips-card-image"
                  :style="{ backgroundColor: colors[((currentPage - 1) * pageSize + index) % colors.length] }"
                ></div>

                <div class="trips-card-details">
                  <h3>{{ trip.name }}</h3>
                  <p class="trips-card-date">
                    {{ formatDate(trip.start_date) }} – {{ formatDate(trip.end_date) }}
                  </p>
                  <p class="trips-card-destination">{{ trip.destination }}</p>
                </div>

                <span
                  class="trips-role"
                  :class="trip.role === 'ORGANIZER' ? 'trips-role-organizer' : 'trips-role-participant'"
                >
                  {{ trip.role === 'ORGANIZER' ? 'Organizator' : 'Uczestnik' }}
                </span>
              </div>
            </div>

            <!--paginacja listy wyjazdow-->
            <nav v-if="totalPages > 1" class="trips-pagination" aria-label="Strony wyjazdów">
              <button
                type="button"
                :disabled="currentPage === 1"
                @click="currentPage--"
              >Poprzednia</button>
              <span>Strona {{ currentPage }} z {{ totalPages }}</span>
              <button
                type="button"
                :disabled="currentPage === totalPages"
                @click="currentPage++"
              >Następna</button>
            </nav>
          </template>
        </template>
      </main>
    </div>
  </div>
</template>

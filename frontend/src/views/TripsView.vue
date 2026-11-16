<script setup>
import { ref, onMounted } from 'vue'

//import komponent menu bocznego
import Sidebar from '../components/Sidebar.vue'

//lista wyjazdów pobranych z backendu
const trips = ref([])

//informacja, czy trwa pobieranie wyjazdów
const loading = ref(true)

//komunikat o błędzie podczas pobierania danyc
const error = ref('')

//pobranie danych zalogowanego użytkownika z pamięci sesji
//jeśli nie ma zapisanych danych, tworzony jest pusty obiekt
const user = JSON.parse(sessionStorage.getItem('user') || '{}')

//kolory tła miniatur wyjazdów
const colors = ['#b9dce7', '#d8e6f1', '#e5d6c2']

//funkcja zamieniająca datę na czytelny format po polsku
function formatDate(date) {
  //jeśli nie ma daty, zwracany jest pusty tekst
  if (!date) return ''

  const [year, month, day] = String(date).slice(0, 10).split('-')

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  ).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

//funkcja pobierająca wyjazdy zalogowanego użytkownika
async function loadTrips() {
  //ustawienie stanu ładowania i usunięcie poprzedniego błędu
  loading.value = true
  error.value = ''

  try {
     //pobranie tokenu zapisanego podczas logowania
    const token = sessionStorage.getItem('token')

    //jeśli nie ma tokenu, przekierowanie na stronę logowania
    if (!token) {
      window.location.href = '/login'
      return
    }

    //wysłanie żądania GET do backendu, aby pobrać wyjazdy
    const response = await fetch('/api/trips', {
      headers: {
        //przekazanie tokenu do backendu w celu rozpoznania użytkownika
        Authorization: `Bearer ${token}`
      }
    })

    const data = await response.json()

    //jeśli serwer zwrócił błąd, przerwanie pobieranie
    if (!response.ok) {
      throw new Error(data.error || 'Nie udało się pobrać wyjazdów.')
    }

    //zapisanie pobranych wyjazdów do zmiennej reaktywnej
    //Vue automatycznie zaktualizuje listę na stronie
    trips.value = data.trips
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

//funkcja przenosząca użytkownika do formularza tworzenia wyjazdu
function createTrip() {
  window.location.href = '/trips/create'
}

//po zamontowaniu komponentu automatycznie pobierane są wyjazdy
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
          <h1>Moje wyjazdy</h1>

        <!-- po kliknięciu uruchamiana jest funkcja createTrip -->
          <button class="trips-create-btn" @click="createTrip">
            + Utwórz wyjazd
          </button>
        </div>

        <p v-if="loading" class="trips-message">
          Ładowanie wyjazdów...
        </p>

        <p v-else-if="error" class="trips-error">
          {{ error }}
        </p>

        <!-- komunikat wyświetlany, gdy użytkownik nie ma wyjazdów -->
        <div v-else-if="trips.length === 0" class="trips-empty">
          <h3>Nie masz jeszcze żadnych wyjazdów</h3>
          <p>Kliknij „Utwórz wyjazd”, aby rozpocząć planowanie.</p>
        </div>

        <div v-else class="trips-cards">


    <!-- v-for tworzy osobną kartę dla każdego wyjazdu -->
    <!-- index oznacza pozycję wyjazdu na liście -->
    <!-- :key pomaga Vue rozpoznawać poszczególne karty -->
    <div
    v-for="(trip, index) in trips"
    :key="trip.id"
    class="trips-card"
    >
  

    <!-- miniatura wyjazdu -->
    <!-- :style ustawia kolor na podstawie pozycji wyjazdu -->
    <!-- operator % pozwala powtarzać kolory z tablicy -->
    <div
      class="trips-card-image"
      :style="{ backgroundColor: colors[index % colors.length] }"
    ></div>

    <div class="trips-card-details">
      <h3>{{ trip.name }}</h3>

      <p class="trips-card-date">
        {{ formatDate(trip.start_date) }}
        –
        {{ formatDate(trip.end_date) }}
      </p>

      <p class="trips-card-destination">
        {{ trip.destination }}
      </p>
    </div>


    <!-- oznaczenie roli użytkownika w wyjeździe -->
    <!-- :class wybiera odpowiedni kolor na podstawie roli -->
    <span
      class="trips-role"
      :class="trip.role === 'ORGANIZER'
        ? 'trips-role-organizer'
        : 'trips-role-participant'"
    >
      {{ trip.role === 'ORGANIZER'
        ? 'Organizator'
        : 'Uczestnik' }}
    </span>
  </div>
</div>
      </main>
    </div>
  </div>
</template>

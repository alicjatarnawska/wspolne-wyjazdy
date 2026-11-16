<script setup>
import { ref } from 'vue'
import Sidebar from '../components/Sidebar.vue'

//zmienne przechowujące dane wpisywane w formularzu
const name = ref('')
const destination = ref('')
const startDate = ref('')
const endDate = ref('')
const description = ref('')

const loading = ref(false)
const error = ref('')

const user = JSON.parse(sessionStorage.getItem('user') || '{}')

//funkcja obsługująca tworzenie nowego wyjazdu
async function createTrip() {
  error.value = ''

  if (!name.value || !destination.value || !startDate.value || !endDate.value) {
    error.value = 'Uzupełnij wszystkie wymagane pola.'
    return
  }

  if (endDate.value < startDate.value) {
    error.value = 'Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.'
    return
  }

  loading.value = true

  try {
    const token = sessionStorage.getItem('token')

    if (!token) {
      window.location.href = '/login'
      return
    }

    //wysłanie danych nowego wyjazdu do backendu
    const response = await fetch('/api/trips', {
      //POST służy tutaj do tworzenia nowego wyjazdu
      method: 'POST',
      headers: {
        //informujemy serwer, że wysyłamy dane w formacie JSON
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      //nazwy pól odpowiadają tym oczekiwanym przez backend
      body: JSON.stringify({
        name: name.value,
        destination: destination.value,
        start_date: startDate.value,
        end_date: endDate.value,
        description: description.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Nie udało się utworzyć wyjazdu.')
    }

    window.location.href = '/trips'
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

//funkcja obsługująca anulowanie tworzenia wyjazdu
function cancel() {
  //powrót do listy wyjazdów bez zapisywania formularza
  window.location.href = '/trips'
}
</script>

<template>
  <div class="create-trip-page">
    <header class="create-trip-header">
      <div class="create-trip-logo">TravelTogether</div>
    </header>

    <Sidebar />

    <main class="create-trip-content">
      <h1>Utwórz wyjazd</h1>

      <form class="create-trip-form" @submit.prevent="createTrip">
        <div class="form-group">
          <label for="trip-name">Nazwa wyjazdu</label>
          <input
            id="trip-name"
            v-model="name"
            type="text"
            placeholder="Wyjazd do Barcelony"
            required
          />
        </div>

        <div class="form-group">
          <label for="trip-destination">Miejsce docelowe</label>
          <input
            id="trip-destination"
            v-model="destination"
            type="text"
            placeholder="Barcelona, Hiszpania"
            required
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="start-date">Data rozpoczęcia</label>
            <input
              id="start-date"
              v-model="startDate"
              type="date"
              required
            />
          </div>

          <div class="form-group">
            <label for="end-date">Data zakończenia</label>
            <input
              id="end-date"
              v-model="endDate"
              type="date"
              :min="startDate"
              required
            />
          </div>
        </div>

        <div class="form-group">
          <label for="trip-description">Opis (opcjonalnie)</label>
          <textarea
            id="trip-description"
            v-model="description"
            rows="2"
            placeholder="Wspólny wyjazd do Barcelony – zwiedzanie, plaża"
          ></textarea>
        </div>

        <p v-if="error" class="create-trip-error">{{ error }}</p>

        <div class="create-trip-actions">
          <button
            type="submit"
            class="create-trip-submit"
            :disabled="loading"
          >
            {{ loading ? 'Tworzenie...' : 'Utwórz wyjazd' }}
          </button>

          <button
            type="button"
            class="create-trip-cancel"
            @click="cancel"
          >
            Anuluj
          </button>
        </div>
      </form>
    </main>
  </div>
</template>



<script setup>
// import ref do tworzenia zmiennych reaktywnych
// computed do obliczania wartości na podstawie innych zmiennych
// onMounted wykonuje kod po zamontowaniu komponentu
// onUnmounted wykonuje kod po usunięciu komponentu
import { ref, computed, onMounted, onUnmounted } from 'vue'

// import widoków poszczególnych stron aplikacji
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import TripsView from './views/TripsView.vue'
import CreateTripView from './views/CreateTripView.vue'
import ProfileView from './views/ProfileView.vue'
import TripDetailsView from './views/TripDetailsView.vue'

// pobranie aktualnej ścieżki z adresu URL
const currentPath = ref(window.location.pathname)

// funkcja aktualizująca ścieżkę po zmianie adresu
function updatePath() {
  currentPath.value = window.location.pathname
}

// sprawdzenie, czy użytkownik znajduje się
// na stronie szczegółów konkretnego wyjazdu
const isTripDetails = computed(() => {
  return /^\/trips\/\d+\/?$/.test(currentPath.value)
})

// pobranie ID wyjazdu z adresu URL
// np. /trips/5 -> tripId = 5
const tripId = computed(() => {
  if (!isTripDetails.value) return null

  return Number(currentPath.value.split('/')[2])
})

// nasłuchiwanie zmian historii przeglądarki
onMounted(() => {
  window.addEventListener('popstate', updatePath)
})

// usunięcie nasłuchiwania po odmontowaniu komponentu
onUnmounted(() => {
  window.removeEventListener('popstate', updatePath)
})
</script>

<template>
  <!-- rejestracja -->
  <RegisterView v-if="currentPath === '/register'" />

  <!-- tworzenie nowego wyjazdu -->
  <CreateTripView v-else-if="currentPath === '/trips/create'" />

  <!-- szczegóły konkretnego wyjazdu -->
  <TripDetailsView
    v-else-if="isTripDetails"
    :key="tripId"
    :trip-id="tripId"
  />

  <!-- lista wyjazdów -->
  <TripsView v-else-if="currentPath === '/trips'" />

  <!-- profil użytkownika -->
  <ProfileView v-else-if="currentPath === '/profile'" />

  <!-- pozostałe adresy -->
  <LoginView v-else />
</template>

<script setup>
//import ref do tworzenia zmiennych reaktywnych
//onMounted wykonuje kod po zamontowaniu komponentu
//onUnmounted wykonuje kod po usunięciu komponentu
import { ref, onMounted, onUnmounted } from 'vue'

//import widoków poszczególnych stron aplikacji
import LoginView from './views/LoginView.vue'
import RegisterView from './views/RegisterView.vue'
import TripsView from './views/TripsView.vue'
import CreateTripView from './views/CreateTripView.vue'
import ProfileView from './views/ProfileView.vue'

//pobranie aktualnej ścieżki z adresu URL
// np. /login, /register lub /trips
const currentPath = ref(window.location.pathname)

//funkcja aktualizująca ścieżkę po zmianie adresu
function updatePath() {
  currentPath.value = window.location.pathname
}

//po zamontowaniu komponentu rozpoczęcie nasłuchiwania
//zmian historii przeglądarki, np. kliknięcia przycisku Wstecz
onMounted(() => {
  window.addEventListener('popstate', updatePath)
})

//po usunięciu komponentu zaprzestanie nasłuchiwania
onUnmounted(() => {
  window.removeEventListener('popstate', updatePath)
})
</script>

<template>
 <!-- wyświetlenie odpowiedniej strony po adresie -->
  <RegisterView v-if="currentPath === '/register'" />
  <CreateTripView v-else-if="currentPath === '/trips/create'" />
  <TripsView v-else-if="currentPath === '/trips'" />
  <ProfileView v-else-if="currentPath === '/profile'" />
   <!-- dla pozostałych adresów wyświetlana jest strona logowania -->
  <LoginView v-else />
</template>
<script setup>
// pobranie aktualnego adresu strony
const currentPath = window.location.pathname

// sprawdzenie aktywnej zakładki
const isHomeActive = currentPath === '/'
const isTripsActive = currentPath === '/trips' || currentPath.startsWith('/trips/')
const isProfileActive = currentPath === '/profile'

// wylogowanie użytkownika
function logout() {
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user')

  window.location.href = '/login'
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1 class="brand-title">TravelTogether</h1>
    </div>

    <nav class="sidebar-nav">

      <!-- strona główna -->
      <a href="/" class="nav-item" :class="{ active: isHomeActive }">
        <svg
          class="nav-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v12h14V9" />
          <path d="M9 21v-8h6v8" />
        </svg>

        <span>Strona główna</span>
      </a>

      <!-- moje wyjazdy -->
      <a href="/trips" class="nav-item" :class="{ active: isTripsActive }">
        <svg
          class="nav-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="7" width="18" height="14" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
        </svg>

        <span>Moje wyjazdy</span>
      </a>

      <!-- profil -->
      <a href="/profile" class="nav-item" :class="{ active: isProfileActive }">
        <svg
          class="nav-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>

        <span>Profil</span>
      </a>
    </nav>

    <!-- przycisk wylogowania -->
    <div class="sidebar-footer">
      <button class="logout-btn" type="button" @click="logout">
        <svg
          class="nav-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>

        <span>Wyloguj się</span>
      </button>
    </div>
  </aside>
</template>
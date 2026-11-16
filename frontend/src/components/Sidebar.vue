<script setup>
//funkcja wylogowująca użytkownika
function logout() {

  //usunięcie tokenu i danych zapisanych podczas logowania
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('user')

  //przeniesienie do strony logowania
  window.location.href = '/login'
}

</script>
<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1 class="brand-title">TravelTogether</h1>
    </div>

    <nav class="sidebar-nav">
  <a href="/trips" class="nav-item">
    <img src="/icons/home.svg" class="nav-icon" alt="" />
    <span>Strona główna</span>
  </a>

    <!-- odnośnik do listy wyjazdów -->
    <!-- klasa active oznacza aktualnie zaznaczoną pozycję menu -->
    <a href="/trips" class="nav-item active">
    <img src="/icons/trips.svg" class="nav-icon" alt="" />
    <span>Moje wyjazdy</span>
  </a>

     <div class="nav-item">
    <img src="/icons/profile.svg" class="nav-icon" alt="" />
    <span>Profil</span>
  </div>
</nav>

 <!-- dolna część menu z przyciskiem wylogowania -->
<div class="sidebar-footer">
  <button class="logout-btn" type="button" @click="logout">

  <!-- ikona wylogowania narysowana za pomocą SVG -->
  <!-- viewBox określa układ współrzędnych grafiki -->
  <!-- fill="none" oznacza brak wypełnienia -->
  <!-- stroke określa kolor linii ikony -->
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

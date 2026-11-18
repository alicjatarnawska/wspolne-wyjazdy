<script setup>
//import ref w celu przechowywania danych, które mogą się zmieniać
import { ref } from 'vue'

//import komponentu wyświetlającego grafikę gór
import MountainPanel from '../components/MountainPanel.vue'

//dane wpisywane przez użytkownika w formularzu logowania
const email = ref('')
const password = ref('')

//zmienna przechowująca komunikat o błędzie
const error = ref('')

//informacja, czy trwa logowanie
const loading = ref(false)

//funkcja obsługująca logowanie użytkownika
async function login() {
  error.value = ''

  try {
    //wysłanie danych logowania do backendu
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      //zamiana e-maila i hasła na format JSON
      body: JSON.stringify({
        email: email.value,
        password: password.value
      })
    })

    //odczytanie odpowiedzi otrzymanej z serwera
    const data = await response.json()

    //jeśli logowanie się nie powiodło, wyświetlany jest błąd
    if (!response.ok) {
      error.value = data.error || 'Nie udało się zalogować.'
      return
    }

    //zapisanie tokenu i danych zalogowanego użytkownika w pamięci sesji przeglądarki
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('user', JSON.stringify(data.user))

    //po poprawnym zalogowania przeniesienie do listy wyjazdów
    window.location.href = '/trips'

    //wyświetlenie błędu, jeśli nie udało się połączyć z serwerem
  } catch (err) {
    error.value = 'Nie można połączyć się z serwerem.'
  }
}

</script>


<template>
  <!-- główny kontener strony logowania -->
  <main class="login-page">
    <div class="login-card">
    <!-- lewa część strony z grafiką gór -->
      <MountainPanel />

      <!-- prawa część strony z formularzem logowania -->
      <section class="login-form">
        <div class="form-content">
          <h2>Zaloguj się</h2>

          <!-- formularz uruchamia funkcję login po wysłaniu -->
          <!-- prevent zapobiega przeładowaniu strony -->
          <form @submit.prevent="login">
            <input
              v-model="email"
              type="email"
              placeholder="E-mail"
              autocomplete="email"
              required
            />

            <input
              v-model="password"
              type="password"
              placeholder="Hasło"
              autocomplete="current-password"
              required
            />

            <!-- komunikat o błędzie wyświetlany tylko wtedy, gdy zmienna error zawiera tekst -->
            <p v-if="error" class="error">{{ error }}</p>

            <button type="submit" :disabled="loading">
              {{ loading ? 'Logowanie...' : 'Zaloguj się' }}
            </button>
          </form>

          <!-- link do strony rejestracji dla nowych użytkowników -->
          <p class="register-text">
            Nie masz konta?
            <a href="/register">Zarejestruj się</a>
          </p>
        </div>
      </section>
    </div>
  </main>
</template>



<script setup>
//import ref w celu przechowywania danych, które mogą się zmieniać
import { ref } from 'vue'
//import komponentu wyświetlającego grafikę gór
import MountainPanel from '../components/MountainPanel.vue'

//dane wpisywane przez użytkownika w formularzu rejestracji
const displayName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

//komunikaty o błędzie i powodzeniu rejestracji
const error = ref('')
const success = ref('')
const loading = ref(false)

//funkcja obsługująca rejestrację użytkownika
async function register() {
  //czyszczenie wcześniejszych komunikatów
  error.value = ''
  success.value = ''

//sprawdzenie, czy wszystkie pola zostały wypełnione
  if (!displayName.value.trim() || !email.value || !password.value || !confirmPassword.value) {
    error.value = 'Wypełnij wszystkie pola.'
    return
  }

  if (displayName.value.trim().length > 50) {
    error.value = 'Nazwa użytkownika może mieć maksymalnie 50 znaków.'
    return
  }

  if (password.value.length < 6) {
    error.value = 'Hasło musi mieć co najmniej 6 znaków.'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = 'Podane hasła nie są identyczne.'
    return
  }

//ustawienie informacji, że rozpoczęło się tworzenie konta
  loading.value = true

  try {
    //wysłanie danych rejestracji do backendu
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        //trim() usuwa zbędne spacje na początku i końcu e-maila
        display_name: displayName.value.trim(),
        email: email.value.trim(),
        password: password.value
      })
    })

    //odczytanie odpowiedzi JSON otrzymanej z serwera
    const data = await response.json()

  //jeśli rejestracja sie nie powiodła, wyświetlenie błędu
    if (!response.ok) {
      error.value = data.error || 'Nie udało się utworzyć konta.'
      return
    }

    success.value = 'Konto zostało utworzone! Możesz się zalogować.'
    displayName.value = ''
    password.value = ''
    confirmPassword.value = ''
  } catch (err) {
    error.value = 'Nie można połączyć się z serwerem.'
  } finally {
    //koniec stanu ładowania niezależnie od wyniku rejestracji
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <MountainPanel />

      <div class="login-form">
        <div class="form-content">
          <h2>Zarejestruj się</h2>

          <form @submit.prevent="register">
            <input
              v-model="displayName"
              type="text"
              placeholder="Nazwa użytkownika"
              autocomplete="username"
              maxlength="50"
              required
            />

            <input
              v-model="email"
              type="email"
              placeholder="Adres e-mail"
              autocomplete="email"
              required
            />

            <input
              v-model="password"
              type="password"
              placeholder="Hasło"
              autocomplete="new-password"
              required
              minlength="6"
            />

            <input
              v-model="confirmPassword"
              type="password"
              placeholder="Powtórz hasło"
              autocomplete="new-password"
              required
            />

            <p v-if="error" class="auth-error">{{ error }}</p>
            <p v-if="success" class="auth-success">{{ success }}</p>

            <button type="submit" :disabled="loading">
              {{ loading ? 'Tworzenie konta...' : 'Zarejestruj się' }}
            </button>
          </form>

          <p class="auth-switch">
            Masz już konto?
            <a href="/login">Zaloguj się</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

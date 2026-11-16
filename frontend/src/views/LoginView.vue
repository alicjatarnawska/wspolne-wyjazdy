
<script setup>
import { ref } from 'vue'
import MountainPanel from '../components/MountainPanel.vue'

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)


async function login() {
  error.value = ''

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email.value,
        password: password.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      error.value = data.error || 'Nie udało się zalogować.'
      return
    }

    // Na tym etapie przechowujemy token w pamięci sesji.
    sessionStorage.setItem('token', data.token)
    sessionStorage.setItem('user', JSON.stringify(data.user))

    window.location.href = '/trips'
  } catch (err) {
    error.value = 'Nie można połączyć się z serwerem.'
  }
}

</script>


<template>
  <main class="login-page">
    <div class="login-card">
      <!-- Lewa część z górami -->
      <MountainPanel />

      <!-- Prawa część z formularzem -->
      <section class="login-form">
        <div class="form-content">
          <h2>Zaloguj się</h2>

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

            <p v-if="error" class="error">{{ error }}</p>

            <button type="submit" :disabled="loading">
              {{ loading ? 'Logowanie...' : 'Zaloguj się' }}
            </button>
          </form>

          <p class="register-text">
            Nie masz konta?
            <a href="/register">Zarejestruj się</a>
          </p>
        </div>
      </section>
    </div>
  </main>
</template>


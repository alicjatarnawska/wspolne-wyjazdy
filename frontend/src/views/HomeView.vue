<script setup>
import Sidebar from '../components/Sidebar.vue'

const steps = [
  { number: '01', title: 'Utwórz wyjazd', text: 'Wybierz kierunek, termin i nadaj podróży nazwę.' },
  { number: '02', title: 'Zaproś znajomych', text: 'Dodaj osoby, z którymi chcesz podróżować.' },
  { number: '03', title: 'Działajcie razem', text: 'Wspólnie ustalajcie szczegóły w jednym miejscu.' }
]

const features = [
  { icon: 'calendar', title: 'Harmonogram', text: 'Rozpisz każdy dzień podróży.', tag: 'PLAN PODRÓŻY' },
  { icon: 'check', title: 'Zadania', text: 'Przypisuj zadania konkretnym osobom i oznaczaj je jako wykonane.', tag: 'ORGANIZACJA' },
  { icon: 'users', title: 'Uczestnicy', text: 'Dodawaj znajomych do wyjazdu.', tag: 'WSPÓŁPRACA' },
  { icon: 'wallet', title: 'Wydatki', text: 'Zapisuj koszty, żeby wspólny budżet był przejrzysty.', tag: 'FINANSE' },
  { icon: 'file', title: 'Dokumenty', text: 'Przechowuj bilety, potwierdzenia rezerwacji i ważne pliki wyjazdu.', tag: 'PLIKI' },
  { icon: 'image', title: 'Galeria wyjazdu', text: 'Dodawaj zdjęcia z podróży i zachowuj wspólne wspomnienia.', tag: 'WSPOMNIENIA' }
]

const icons = {
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  check: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m14-14a4 4 0 0 1 0 8m6 6v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  wallet: 'M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h15a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a3 3 0 0 1-3-3m20 8h-6a2 2 0 0 0 0 4h6',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8',
  image: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM3 17l5-5 4 4 3-3 6 6'
}
</script>

<template>
  <div class="home-page">
    <Sidebar />
    <main class="home-main">
      <div class="home-content">
        <header class="home-hero">
          <div class="home-hero-text">
            <h1>Podróże łatwiej planuje się razem.</h1>
            <p>Od pierwszego pomysłu po wspólny wyjazd - wszystkie ustalenia i plany w jednej aplikacji.</p>
          </div>
        </header>

        <section class="how-section" aria-labelledby="how-title">
          <div class="section-heading">
            <div>
              <span class="eyebrow">PIERWSZE KROKI</span>
              <h2 id="how-title">Od pomysłu do wyjazdu</h2>
            </div>
          </div>
          <div class="step-line">
            <div v-for="(step, index) in steps" :key="step.number" class="step-item">
              <div class="step-top">
                <span class="step-number">{{ step.number }}</span>
                <span v-if="index < steps.length - 1" class="step-connector" aria-hidden="true"></span>
              </div>
              <h3>{{ step.title }}</h3>
              <p>{{ step.text }}</p>
            </div>
          </div>
        </section>

        <section class="features-section" aria-labelledby="features-title">
          <div class="section-heading">
            <div>
              <span class="eyebrow">NARZĘDZIA</span>
              <h2 id="features-title">Co znajdziesz w TravelTogether?</h2>
            </div>
          </div>
          <div class="feature-layout">
            <article v-for="feature in features" :key="feature.title" class="feature-item">
              <div class="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <path :d="icons[feature.icon]" />
                </svg>
              </div>
              <div class="feature-copy">
                <span class="feature-tag">{{ feature.tag }}</span>
                <h3>{{ feature.title }}</h3>
                <p>{{ feature.text }}</p>
              </div>
            </article>
          </div>
        </section>

        <aside class="travel-tip" aria-label="Wskazówka przed podróżą">
          <div class="tip-label"><span class="tip-dot" aria-hidden="true"></span> WARTO PAMIĘTAĆ</div>
          <p>Dobra organizacja to nie tylko planowanie, ale też elastyczność. Zostawcie trochę miejsca na spontaniczność.</p>
        </aside>
      </div>
    </main>
  </div>
</template>

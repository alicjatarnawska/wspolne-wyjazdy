<template>
  <div class="mountain-panel">

    <!-- SVG służy do rysowania grafiki za pomocą figur i ścieżek -->
    <!-- viewBox określa rozmiar układu współrzędnych rysunku -->
    <!-- preserveAspectRatio="none" pozwala dopasować grafikę do rozmiaru panelu -->
    <!-- aria-hidden="true" ukrywa dekoracyjną grafikę przed czytnikami ekranu -->
    
    <svg
      class="mountains"
      viewBox="0 0 255 345"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <!-- tło -->
      <rect width="255" height="345" fill="#80a8cc" />

      <!-- góry -->
      <!-- path rysuje kształt na podstawie podanych współrzędnych -->
      <path
        d="M0 250 L44 133 L84 218 L150 58 L208 194 L255 154 L255 345 L0 345 Z"
        fill="#365e85"
      />

      <!-- śnieg -->
      <path
        d="M150 58 L114 143 L150 105 L187 143 Z"
        fill="#e6f0f7"
      />

      <!-- pagórki -->
      <path
        d="M0 305 L65 245 L116 290 L200 215 L255 268 L255 345 L0 345 Z"
        fill="#244e4b"
      />

      <!-- pagórki -->
      <path
        d="M0 345 L67 289 L149 317 L255 280 L255 345 Z"
        fill="#37695d"
      />
    </svg>

    <div class="mountain-content">
      <h1>TravelTogether</h1>
      <p>
        Planuj i organizuj<br />
        wspólne podróże
      </p>
    </div>
  </div>
</template>


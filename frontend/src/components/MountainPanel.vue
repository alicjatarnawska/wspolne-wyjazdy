

<template>
  <div class="mountain-panel">
    <svg
      class="mountains"
      viewBox="0 0 255 345"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <!-- Tło -->
      <rect width="255" height="345" fill="#80a8cc" />

      <!-- Główne góry -->
      <path
        d="M0 250 L44 133 L84 218 L150 58 L208 194 L255 154 L255 345 L0 345 Z"
        fill="#365e85"
      />

      <!-- Śnieg na szczycie -->
      <path
        d="M150 58 L114 143 L150 105 L187 143 Z"
        fill="#e6f0f7"
      />

      <!-- Ciemnozielone góry -->
      <path
        d="M0 305 L65 245 L116 290 L200 215 L255 268 L255 345 L0 345 Z"
        fill="#244e4b"
      />

      <!-- Góry na pierwszym planie -->
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


<style scoped>
.mountain-panel {
  position: relative;
  width: 45%;
  min-height: 440px;
  overflow: hidden;
  border-radius: 16px 0 0 16px;
  background: #80a8cc;
}

.mountains {
  position: absolute;
  width: 100%;
  height: 100%;
}

.mountain-content {
  position: absolute;
  top: 71%;
  left: 0;
  right: 0;
  text-align: center;
  color: white;
}

.mountain-content h1 {
  font-size: 48px; /* większy napis TravelTogether */
  font-weight: 650;
  letter-spacing: 1px;
  margin: 0 0 35px;
}

.mountain-content p {
  font-size: 27px; /* większy napis pod spodem */
  line-height: 1.5;
  letter-spacing: 1.5px;
  margin: 0;
}

@media (max-width: 600px) {
  .mountain-panel {
    width: 100%;
    min-height: 180px;
    border-radius: 16px 16px 0 0;
  }

  .mountain-content {
    top: 35%;
  }

  .mountain-content h1 {
    font-size: 23px;
    margin-bottom: 8px;
  }
}
</style>

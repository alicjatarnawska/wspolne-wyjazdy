// wykrywanie potencjalnie niebezpiecznych znaczników HTML/JS (ochrona przed XSS)
const containsScriptOrHtml = (text) =>
  /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|base|form|input|svg|math|img|video|audio|frame|frameset|applet)\b/i.test(text) ||
  /<\s*[a-zA-Z][^>]*\bon[a-z]{2,}\s*=/i.test(text) ||
  /(javascript|vbscript)\s*:/i.test(text);

// walidacja identyfikatorów np. wyjazdu, użytkownika, zadania - muszą być liczbami całkowitymi dodatnimi
const parsePositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

// sprawdzenie, czy ciąg "YYYY-MM-DD" jest poprawną datą kalendarzową
const isValidDateString = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

// walidacja adresu e-mail (format, długość, brak pustego ciągu)
const normalizeAndValidateEmail = (email, emptyMsg = 'Adres e-mail jest wymagany.') => {
  if (typeof email !== 'string' || !email.trim()) {
    return { error: emptyMsg };
  }
  const trimmed = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed) || trimmed.length > 255) {
    return { error: 'Podaj poprawny adres e-mail.' };
  }
  return { value: trimmed };
};

// uniwersalna walidacja pól tekstowych (czy wymagane, długość, typ, ochrona przed XSS)
const validateTextField = (
  value,
  { required = true, requiredMsg, typeMsg, maxLength, maxLengthMsg, xssMsg }
) => {
  if (value === undefined || value === null || value === '') {
    return required ? { error: requiredMsg } : { value: null };
  }
  if (typeof value !== 'string') {
    return { error: typeMsg || requiredMsg };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return required ? { error: requiredMsg } : { value: null };
  }
  if (maxLength && trimmed.length > maxLength) {
    return { error: maxLengthMsg };
  }
  if (xssMsg && containsScriptOrHtml(trimmed)) {
    return { error: xssMsg };
  }
  return { value: trimmed };
};

module.exports = {
  containsScriptOrHtml,
  parsePositiveInt,
  isValidDateString,
  normalizeAndValidateEmail,
  validateTextField,
};
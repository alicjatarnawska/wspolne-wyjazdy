const request = require('supertest');

const api = request('http://localhost:5000');

// inny e-mail przy kazdym uruchomieniu, zeby test nie trafial na zajete konto
function uniqueEmail() {
  return `test_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
}

function register(email, displayName) {
  return api
    .post('/api/auth/register')
    .send({ email, password: 'haslo123', display_name: displayName });
}

describe('Rejestracja z nickiem', () => {
  test('TC-26 rejestracja z nickiem', async () => {
    const res = await register(uniqueEmail(), 'Zuza');

    expect(res.status).toBe(201);
    expect(res.body.user.display_name).toBe('Zuza');
  });

  test('TC-27 nick zwracany po zalogowaniu', async () => {
    const email = uniqueEmail();
    await register(email, 'Zuza');

    const res = await api
        .post('/api/auth/login')
        .send({ email, password: 'haslo123' });

    expect(res.status).toBe(200);
    expect(res.body.user.display_name).toBe('Zuza');
  });

  test('TC-28 nick z polskimi znakami', async () => {
    const res = await register(uniqueEmail(), 'Łucja Żak');

    expect(res.status).toBe(201);
    expect(res.body.user.display_name).toBe('Łucja Żak');
  });

  test('TC-29 spacje na poczatku i koncu nicku', async () => {
    const res = await register(uniqueEmail(), ' Zuza ');

    expect(res.status).toBe(201);
    expect(res.body.user.display_name).toBe('Zuza');
  });

  test('TC-30 nick o długości 50 znaków', async () => {
    const res = await register(uniqueEmail(), 'A'.repeat(50));

    expect(res.status).toBe(201);
    expect(res.body.user.display_name).toBe('A'.repeat(50));
  });

  test('TC-31 brak nicku', async () => {
    const res = await register(uniqueEmail(), undefined);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('TC-32 nick z samych spacji', async () => {
    const res = await register(uniqueEmail(), '        ');

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('TC-33 za długi nick', async () => {
    const res = await register(uniqueEmail(), 'A'.repeat(51));

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('TC-34 nick zajęty przez inną osobę', async () => {
    const res = await register(uniqueEmail(), 'Kasia');

    expect(res.status).toBe(201);
    expect(res.body.user.display_name).toBe('Kasia');
  });
});
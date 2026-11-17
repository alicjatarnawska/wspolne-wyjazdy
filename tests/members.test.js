const request = require('supertest');

const api = request('http://localhost:5000');

// funkcje pomocnicze
async function login(email) {
  const res = await api
    .post('/api/auth/login')
    .send({ email, password: 'haslo123' });
  return res.body.token;
}

async function createTrip(token) {
  const res = await api
    .post('/api/trips')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Test zaproszenia',
      destination: 'Gizycko',
      start_date: '2027-05-14',
      end_date: '2027-05-16',
    });
  return res.body.trip.id;
}

function invite(token, tripId, email) {
  const req = api.post(`/api/trips/${tripId}/members`);
  if (token) req.set('Authorization', `Bearer ${token}`);
  return req.send({ email });
}

let tokenOli;
let tokenKasi;
let tokenAlicji;
let tripId;

beforeAll(async () => {
  tokenOli = await login('ola@example.com');
  tokenKasi = await login('kasia@example.com');
  tokenAlicji = await login('alicja@example.com');
});

// kazdy test dostaje nowy wyjazd Oli, zeby testy nie wplywaly na siebie
beforeEach(async () => {
  tripId = await createTrip(tokenOli);
});

describe('Zapraszanie uczestnika (WF-04)', () => {
  test('TC-14 organizator zaprasza uczestnika', async () => {
    const res = await invite(tokenOli, tripId, 'kasia@example.com');

    expect(res.status).toBe(201);
    expect(res.body.member.role).toBe('PARTICIPANT');
    expect(res.body.member.display_name).toBe('Kasia');
  });

  test('TC-15 zaproszona osoba widzi wyjazd', async () => {
    await invite(tokenOli, tripId, 'kasia@example.com');

    const res = await api
      .get('/api/trips')
      .set('Authorization', `Bearer ${tokenKasi}`);

    const trip = res.body.trips.find(t => t.id === tripId);
    expect(trip).toBeDefined();
    expect(trip.role).toBe('PARTICIPANT');
  });

  test('TC-16 wielkosc liter w e-mailu nie ma znaczenia', async () => {
    const res = await invite(tokenOli, tripId, 'ALICJA@Example.com');

    expect(res.status).toBe(201);
    expect(res.body.member.email).toBe('alicja@example.com');
  });

  test('TC-17 brak konta o podanym e-mailu', async () => {
    const res = await invite(tokenOli, tripId, 'nieistnieje@example.com');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('TC-18 osoba jest juz uczestnikiem', async () => {
    await invite(tokenOli, tripId, 'kasia@example.com');
    const res = await invite(tokenOli, tripId, 'kasia@example.com');

    expect(res.status).toBe(409);
  });

  test('TC-19 organizator zaprasza samego siebie', async () => {
    const res = await invite(tokenOli, tripId, 'ola@example.com');

    expect(res.status).toBe(409);
  });

  test('TC-20 brak e-maila', async () => {
    const res = await invite(tokenOli, tripId, '');

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('Zapraszanie - uprawnienia (WF-05)', () => {
  test('TC-21 uczestnik nie moze zapraszac', async () => {
    await invite(tokenOli, tripId, 'kasia@example.com');
    const res = await invite(tokenKasi, tripId, 'alicja@example.com');

    expect(res.status).toBe(403);
  });

  test('TC-22 osoba spoza wyjazdu nie moze zapraszac', async () => {
    const res = await invite(tokenAlicji, tripId, 'kasia@example.com');

    expect(res.status).toBe(403);
  });

  test('TC-23 uzytkownik niezalogowany', async () => {
    const res = await invite(null, tripId, 'kasia@example.com');

    expect(res.status).toBe(401);
  });

  test('TC-24 wyjazd nie istnieje', async () => {
    const res = await invite(tokenOli, 999999, 'kasia@example.com');

    // kod do ustalenia z backendem (teraz 403, moze lepiej 404)
    expect([403, 404]).toContain(res.status);
  });
});
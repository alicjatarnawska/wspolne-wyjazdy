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

//---------------------------------------------ETAP 3 --------------------------------------------------------------//

// logowanie, ktore zwraca tez id uzytkownika
async function loginWithId(email) {
  const res = await api
    .post('/api/auth/login')
    .send({ email, password: 'haslo123' });
  return res.body.user.id;
}

function getMembers(token, tripId) {
  return api
    .get(`/api/trips/${tripId}/members`)
    .set('Authorization', `Bearer ${token}`);
}

function changeRole(token, tripId, userId, role) {
  return api
    .patch(`/api/trips/${tripId}/members/${userId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ role });
}

let olaId;
let kasiaId;
let alicjaId;

beforeAll(async () => {
  olaId = await loginWithId('ola@example.com');
  kasiaId = await loginWithId('kasia@example.com');
  alicjaId = await loginWithId('alicja@example.com');
});

describe('Lista uczestnikow (WF-04, WF-05)', () => {
  test('TC-46 lista uczestnikow z nickami', async () => {
    await invite(tokenOli, tripId, 'kasia@example.com');

    const res = await getMembers(tokenOli, tripId);

    expect(res.status).toBe(200);
    expect(res.body.members.length).toBe(2);
    // organizator na poczatku listy
    expect(res.body.members[0].display_name).toBe('Ola');
    expect(res.body.members[0].role).toBe('ORGANIZER');

    const kasia = res.body.members.find(m => m.id === kasiaId);
    expect(kasia.display_name).toBe('Kasia');
    expect(kasia.role).toBe('PARTICIPANT');
  });

  test('TC-47 osoba spoza wyjazdu nie widzi listy uczestnikow', async () => {
    const res = await getMembers(tokenAlicji, tripId);

    expect(res.status).toBe(403);
  });
});

describe('Zmiana roli uczestnika', () => {
  test('TC-48 organizator nadaje role organizatora', async () => {
    await invite(tokenOli, tripId, 'kasia@example.com');

    const res = await changeRole(tokenOli, tripId, kasiaId, 'ORGANIZER');

    expect(res.status).toBe(200);
    expect(res.body.member.role).toBe('ORGANIZER');
  });

  test('TC-49 uczestnik nie moze zmieniac rol', async () => {
    await invite(tokenOli, tripId, 'kasia@example.com');

    const res = await changeRole(tokenKasi, tripId, kasiaId, 'ORGANIZER');

    expect(res.status).toBe(403);
  });

  test('TC-50 jedyny organizator nie moze oddac roli', async () => {
    const res = await changeRole(tokenOli, tripId, olaId, 'PARTICIPANT');

    expect(res.status).toBe(409);
  });

  test('TC-51 organizator oddaje role, gdy jest drugi organizator', async () => {
    await invite(tokenOli, tripId, 'kasia@example.com');
    await changeRole(tokenOli, tripId, kasiaId, 'ORGANIZER');

    const res = await changeRole(tokenOli, tripId, olaId, 'PARTICIPANT');

    expect(res.status).toBe(200);
    expect(res.body.member.role).toBe('PARTICIPANT');
  });

  test('TC-52 nieprawidlowa rola', async () => {
    await invite(tokenOli, tripId, 'kasia@example.com');

    const res = await changeRole(tokenOli, tripId, kasiaId, 'ADMIN');

    expect(res.status).toBe(400);
  });

  test('TC-53 zmiana roli osoby spoza wyjazdu', async () => {
    const res = await changeRole(tokenOli, tripId, alicjaId, 'ORGANIZER');

    expect(res.status).toBe(404);
  });
});
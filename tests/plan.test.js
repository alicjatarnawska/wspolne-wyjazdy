const request = require('supertest');

const api = request('http://localhost:5000');

async function login(email) {
  const res = await api
    .post('/api/auth/login')
    .send({ email, password: 'haslo123' });
  return res.body.token;
}

function auth(req, token) {
  return req.set('Authorization', `Bearer ${token}`);
}

// wyjazd Oli 14.05 - 16.05 z Kasia jako uczestniczka
async function createTripWithKasia() {
  const res = await auth(api.post('/api/trips'), tokenOli).send({
    name: 'Test harmonogram',
    destination: 'Gizycko',
    start_date: '2027-05-14',
    end_date: '2027-05-16',
  });
  const id = res.body.trip.id;
  await auth(api.post(`/api/trips/${id}/members`), tokenOli).send({ email: 'kasia@example.com' });
  return id;
}

function addItem(token, tripId, body) {
  return auth(api.post(`/api/trips/${tripId}/plan`), token).send(body);
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

beforeEach(async () => {
  tripId = await createTripWithKasia();
});

describe('Dodawanie aktywnosci (WF-06)', () => {
  test('TC-87 dodanie aktywnosci', async () => {
    const res = await addItem(tokenKasi, tripId, { date: '2027-05-15', time: '11:00', title: 'Kajaki' });

    expect(res.status).toBe(201);
    expect(res.body.item.title).toBe('Kajaki');
    expect(res.body.item.time).toBe('11:00');
  });

  test('TC-88 aktywnosc bez godziny', async () => {
    const res = await addItem(tokenKasi, tripId, { date: '2027-05-15', title: 'Ognisko' });

    expect(res.status).toBe(201);
    expect(res.body.item.time).toBeNull();
  });

  test('TC-89 data poza terminem wyjazdu', async () => {
    const res = await addItem(tokenKasi, tripId, { date: '2027-05-17', title: 'Kajaki' });
    expect(res.status).toBe(400);
  });

  test('TC-90 nieistniejaca data', async () => {
    const res = await addItem(tokenKasi, tripId, { date: '2027-02-30', title: 'Kajaki' });
    expect(res.status).toBe(400);
  });

  test('TC-91 nieprawidlowa godzina', async () => {
    const res = await addItem(tokenKasi, tripId, { date: '2027-05-15', time: '25:00', title: 'Kajaki' });
    expect(res.status).toBe(400);
  });

  test('TC-92 brak tytulu', async () => {
    const res = await addItem(tokenKasi, tripId, { date: '2027-05-15', title: '' });
    expect(res.status).toBe(400);
  });

  test('TC-93 za dlugi tytul', async () => {
    const res = await addItem(tokenKasi, tripId, { date: '2027-05-15', title: 'a'.repeat(151) });
    expect(res.status).toBe(400);
  });

  test('TC-94 osoba spoza wyjazdu nie moze dodac aktywnosci', async () => {
    const res = await addItem(tokenAlicji, tripId, { date: '2027-05-15', title: 'Kajaki' });
    expect(res.status).toBe(403);
  });
});

describe('Edycja i usuwanie aktywnosci (WF-06)', () => {
  let itemId;

  beforeEach(async () => {
    const res = await addItem(tokenOli, tripId, { date: '2027-05-15', time: '11:00', title: 'Kajaki' });
    itemId = res.body.item.id;
  });

  test('TC-95 edycja aktywnosci', async () => {
    const res = await auth(api.patch(`/api/trips/${tripId}/plan/${itemId}`), tokenKasi)
      .send({ time: '12:00' });

    expect(res.status).toBe(200);
    expect(res.body.item.time).toBe('12:00');
    expect(res.body.item.title).toBe('Kajaki');
  });

  test('TC-96 usuniecie aktywnosci', async () => {
    const res = await auth(api.delete(`/api/trips/${tripId}/plan/${itemId}`), tokenKasi);
    expect(res.status).toBe(200);

    const plan = await auth(api.get(`/api/trips/${tripId}/plan`), tokenKasi);
    expect(plan.body.items.find(i => i.id === itemId)).toBeUndefined();
  });

  test('TC-97 aktywnosc z innego wyjazdu', async () => {
    const otherTripId = await createTripWithKasia();

    const res = await auth(api.patch(`/api/trips/${otherTripId}/plan/${itemId}`), tokenOli)
      .send({ time: '12:00' });

    expect(res.status).toBe(404);
  });
});

describe('Bezpieczenstwo i limity aktywnosci', () => {
  test('TC-98 kod HTML w tytule aktywnosci', async () => {
    const res = await addItem(tokenKasi, tripId, { date: '2027-05-15', title: '<img src=x onerror="alert(1)">' });
    expect(res.status).toBe(400);
  });

  test('TC-99 bardzo dlugi opis aktywnosci', async () => {
    const res = await addItem(tokenKasi, tripId, { date: '2027-05-15', title: 'Kajaki', description: 'a'.repeat(501) });
    expect(res.status).toBe(400);
  });
});
const request = require('supertest');

const api = request('http://localhost:5000');

async function login(email) {
  const res = await api
    .post('/api/auth/login')
    .send({ email, password: 'haslo123' });
  return { token: res.body.token, id: res.body.user.id };
}

function auth(req, token) {
  return req.set('Authorization', `Bearer ${token}`);
}

// wyjazd Oli z Kasia jako uczestniczka
async function createTripWithKasia() {
  const res = await auth(api.post('/api/trips'), ola.token).send({
    name: 'Test zadania',
    destination: 'Gizycko',
    start_date: '2027-05-14',
    end_date: '2027-05-16',
  });
  const id = res.body.trip.id;
  await auth(api.post(`/api/trips/${id}/members`), ola.token).send({ email: 'kasia@example.com' });
  return id;
}

function addTask(token, tripId, body) {
  return auth(api.post(`/api/trips/${tripId}/tasks`), token).send(body);
}

let ola;
let kasia;
let alicja;
let tripId;

beforeAll(async () => {
  ola = await login('ola@example.com');
  kasia = await login('kasia@example.com');
  alicja = await login('alicja@example.com');
});

beforeEach(async () => {
  tripId = await createTripWithKasia();
});

describe('Dodawanie zadan (WF-07)', () => {
  test('TC-100 zadanie bez przypisanej osoby', async () => {
    const res = await addTask(kasia.token, tripId, { name: 'Kupic bilety' });

    expect(res.status).toBe(201);
    expect(res.body.task.assigned_user_id).toBeNull();
    expect(res.body.task.status).toBe('TODO');
  });

  test('TC-101 zadanie przypisane uczestnikowi', async () => {
    const res = await addTask(ola.token, tripId, { name: 'Kupic bilety', assigned_user_id: kasia.id });

    expect(res.status).toBe(201);
    expect(res.body.task.assigned_user_name).toBe('Kasia');
  });

  test('TC-102 przypisanie osoby spoza wyjazdu', async () => {
    const res = await addTask(ola.token, tripId, { name: 'Kupic bilety', assigned_user_id: alicja.id });
    expect(res.status).toBe(400);
  });

  test('TC-105 brak nazwy lub za dluga nazwa zadania', async () => {
    const empty = await addTask(kasia.token, tripId, { name: '' });
    const tooLong = await addTask(kasia.token, tripId, { name: 'a'.repeat(151) });

    expect(empty.status).toBe(400);
    expect(tooLong.status).toBe(400);
  });

  test('TC-106 osoba spoza wyjazdu nie moze dodac zadania', async () => {
    const res = await addTask(alicja.token, tripId, { name: 'Kupic bilety' });
    expect(res.status).toBe(403);
  });

  test('TC-109 nieprawidlowy termin zadania', async () => {
    const res = await addTask(kasia.token, tripId, { name: 'Kupic bilety', due_date: 'jutro' });
    expect(res.status).toBe(400);
  });
});

describe('Edycja i usuwanie zadan (WF-07)', () => {
  let taskId;

  beforeEach(async () => {
    const res = await addTask(ola.token, tripId, { name: 'Kupic bilety' });
    taskId = res.body.task.id;
  });

  test('TC-103 oznaczenie zadania jako zrobione', async () => {
    const res = await auth(api.patch(`/api/trips/${tripId}/tasks/${taskId}`), kasia.token)
      .send({ status: 'DONE' });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('DONE');
  });

  test('TC-104 nieprawidlowy status', async () => {
    const res = await auth(api.patch(`/api/trips/${tripId}/tasks/${taskId}`), kasia.token)
      .send({ status: 'MAYBE' });

    expect(res.status).toBe(400);
  });

  test('TC-107 usuniecie zadania', async () => {
    const res = await auth(api.delete(`/api/trips/${tripId}/tasks/${taskId}`), kasia.token);
    expect(res.status).toBe(200);

    const list = await auth(api.get(`/api/trips/${tripId}/tasks`), kasia.token);
    expect(list.body.tasks.find(t => t.id === taskId)).toBeUndefined();
  });

  test('TC-108 zadanie z innego wyjazdu', async () => {
    const otherTripId = await createTripWithKasia();

    const res = await auth(api.patch(`/api/trips/${otherTripId}/tasks/${taskId}`), ola.token)
      .send({ status: 'DONE' });

    expect(res.status).toBe(404);
  });
});

describe('Bezpieczenstwo zadan', () => {
  test('TC-110 kod HTML w nazwie zadania', async () => {
    const res = await addTask(kasia.token, tripId, { name: '<script>alert(1)</script>' });
    expect(res.status).toBe(400);
  });
});
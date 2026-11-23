const request = require('supertest');

const api = request('http://localhost:5000');

let token;
let tokenKasi;

beforeAll(async () => {
  const res = await api
    .post('/api/auth/login')
    .send({ email: 'ola@example.com', password: 'haslo123' });
  token = res.body.token;

  const resKasi = await api
    .post('/api/auth/login')
    .send({ email: 'kasia@example.com', password: 'haslo123' });
  tokenKasi = resKasi.body.token;
});

describe('Tworzenie wyjazdu (WF-03)', () => {
  test('TC-01 poprawne dane tworza wyjazd', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Mazury',
        destination: 'Gizycko',
        start_date: '2027-05-14',
        end_date: '2027-05-16',
        description: 'Wyjazd testowy',
      });

    expect(res.status).toBe(201);
    expect(res.body.trip.name).toBe('Test Mazury');
    expect(res.body.trip.role).toBe('ORGANIZER'); // TC-02
  });

  test('TC-03 dane bez description', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Mazury',
        destination: 'Gizycko',
        start_date: '2027-05-14',
        end_date: '2027-05-16',
      });

    expect(res.status).toBe(201);
    expect(res.body.trip.name).toBe('Test Mazury');
    expect(res.body.trip.role).toBe('ORGANIZER');
  });

  test('TC-04 start_date i end_date takie same', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Mazury',
        destination: 'Gizycko',
        start_date: '2027-05-14',
        end_date: '2027-05-14',
        description: 'Wyjazd testowy',
      });

    expect(res.status).toBe(201);
    expect(res.body.trip.name).toBe('Test Mazury');
    expect(res.body.trip.role).toBe('ORGANIZER');
  });

  test('TC-05 utworzony wyjazd jest na liscie wyjazdow', async () => {
    // tworzymy wyjazd i zapamietujemy jego id
    const created = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test lista',
        destination: 'Gizycko',
        start_date: '2027-05-14',
        end_date: '2027-05-16',
      });
    const tripId = created.body.trip.id;

    // pobieramy liste wyjazdow tego samego uzytkownika
    const res = await api
      .get('/api/trips')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const found = res.body.trips.some(t => t.id === tripId);
    expect(found).toBe(true);

    const trip = res.body.trips.find(t => t.id === tripId);
    expect(trip.role).toBe('ORGANIZER'); // TC-02
  });

  test('TC-06 dane bez name', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destination: 'Gizycko',
        start_date: '2027-05-14',
        end_date: '2027-05-16',
        description: 'Wyjazd testowy',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('TC-07 dane bez destination', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Mazury',
        start_date: '2027-05-14',
        end_date: '2027-05-16',
        description: 'Wyjazd testowy',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('TC-08 end_date wczesniejsza niz start_date', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Mazury',
        destination: 'Gizycko',
        start_date: '2027-05-14',
        end_date: '2027-05-13',
        description: 'Wyjazd testowy',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('TC-09 nazwa dluzsza niz 100 znakow', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'a'.repeat(101),
        destination: 'Gizycko',
        start_date: '2027-05-14',
        end_date: '2027-05-16',
        description: 'Wyjazd testowy',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('TC-10 niezalogowany uzytkownik nie moze utworzyc wyjazdu', async () => {
    const res = await api
      .post('/api/trips')
      .send({
        name: 'Test',
        destination: 'Gizycko',
        start_date: '2027-05-14',
        end_date: '2027-05-16',
      });

    expect(res.status).toBe(401);
  });

  test('TC-13 nazwa z samych spacji', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '   ',
        destination: 'Gizycko',
        start_date: '2027-05-14',
        end_date: '2027-05-16',
        description: 'Wyjazd testowy',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
describe('Uprawnienia (WF-05)', () => {
  test('TC-11 cudzy wyjazd nie jest widoczny na liscie', async () => {
    // Ola tworzy wyjazd
    const created = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Wyjazd Oli',
        destination: 'Gizycko',
        start_date: '2027-05-14',
        end_date: '2027-05-16',
      });
    const tripId = created.body.trip.id;

    // Kasia pobiera swoja liste wyjazdow
    const res = await api
      .get('/api/trips')
      .set('Authorization', `Bearer ${tokenKasi}`);

    expect(res.status).toBe(200);
    const found = res.body.trips.some(t => t.id === tripId);
    expect(found).toBe(false);
  });
});


//---------------------------------------------ETAP 3 --------------------------------------------------------------//

describe('Opis wyjazdu (WF-03)', () => {
  // dane wyjazdu z wybranym opisem
  function tripWithDescription(description) {
    return {
      name: 'Test opis',
      destination: 'Gizycko',
      start_date: '2027-05-14',
      end_date: '2027-05-16',
      description,
    };
  }

  test('TC-37 opis ze skryptem', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send(tripWithDescription("<script>alert('test')</script>"));

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('TC-38 znaki < i > w zwyklym tekscie', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send(tripWithDescription('budzet < 200 zl, dzieci > 5 lat'));

    expect(res.status).toBe(201);
  });

  test('TC-39 opis o dlugosci 500 znakow', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send(tripWithDescription('a'.repeat(500)));

    expect(res.status).toBe(201);
  });

  test('TC-40 opis za dlugi', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send(tripWithDescription('a'.repeat(501)));

    expect(res.status).toBe(400);
  });

  test('TC-41 opis nie jest tekstem', async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send(tripWithDescription(123));

    expect(res.status).toBe(400);
  });
});

describe('Szczegoly wyjazdu (WF-05)', () => {
  let tripId;

  beforeAll(async () => {
    const res = await api
      .post('/api/trips')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test szczegoly',
        destination: 'Gizycko',
        start_date: '2027-05-14',
        end_date: '2027-05-16',
      });
    tripId = res.body.trip.id;
  });

  test('TC-42 uczestnik widzi szczegoly wyjazdu', async () => {
    const res = await api
      .get(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.trip.name).toBe('Test szczegoly');
    expect(res.body.trip.my_role).toBe('ORGANIZER');
  });

  test('TC-43 osoba spoza wyjazdu nie widzi szczegolow', async () => {
    const res = await api
      .get(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${tokenKasi}`);

    expect(res.status).toBe(403);
  });

  test('TC-44 wyjazd nie istnieje', async () => {
    const res = await api
      .get('/api/trips/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('TC-45 nieprawidlowy numer wyjazdu', async () => {
    const res = await api
      .get('/api/trips/abc')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

//---------------------------------------------ETAP 4 --------------------------------------------------------------//

function auth(req, t) {
  return req.set('Authorization', `Bearer ${t}`);
}

async function createTestTrip() {
  const res = await auth(api.post('/api/trips'), token).send({
    name: 'Test edycja',
    destination: 'Gizycko',
    start_date: '2027-05-14',
    end_date: '2027-05-16',
  });
  return res.body.trip.id;
}

function inviteKasia(tripId) {
  return auth(api.post(`/api/trips/${tripId}/members`), token).send({ email: 'kasia@example.com' });
}

describe('Edycja wyjazdu', () => {
  let tripId;

  beforeEach(async () => {
    tripId = await createTestTrip();
  });

  test('TC-72 organizator edytuje wyjazd', async () => {
    const res = await auth(api.patch(`/api/trips/${tripId}`), token).send({ name: 'Mazury 2027' });

    expect(res.status).toBe(200);
    expect(res.body.trip.name).toBe('Mazury 2027');
  });

  test('TC-73 uczestnik nie moze edytowac wyjazdu', async () => {
    await inviteKasia(tripId);

    const res = await auth(api.patch(`/api/trips/${tripId}`), tokenKasi).send({ name: 'Zmiana Kasi' });

    expect(res.status).toBe(403);
  });

  test('TC-74 edycja z data koncowa przed poczatkowa', async () => {
    const res = await auth(api.patch(`/api/trips/${tripId}`), token).send({ end_date: '2027-05-10' });

    expect(res.status).toBe(400);
  });

  test('TC-75 skrocenie terminu, gdy w harmonogramie sa aktywnosci poza nowymi datami', async () => {
    // aktywnosc w ostatnim dniu wyjazdu
    await auth(api.post(`/api/trips/${tripId}/plan`), token)
      .send({ date: '2027-05-16', title: 'Powrot' });

    const res = await auth(api.patch(`/api/trips/${tripId}`), token).send({ end_date: '2027-05-15' });

    expect(res.status).toBe(409);
  });

    test('TC-76 edycja opisu z niebezpiecznym kodem HTML', async () => {
    const res = await auth(api.patch(`/api/trips/${tripId}`), token)
      .send({ description: '<img src=x onerror="alert(1)">' });

    expect(res.status).toBe(400);
  });
});

describe('Usuwanie wyjazdu', () => {
  let tripId;

  beforeEach(async () => {
    tripId = await createTestTrip();
  });

  test('TC-77 organizator usuwa wyjazd', async () => {
    const res = await auth(api.delete(`/api/trips/${tripId}`), token);
    expect(res.status).toBe(200);

    const details = await auth(api.get(`/api/trips/${tripId}`), token);
    expect(details.status).toBe(404);
  });

  test('TC-78 uczestnik nie moze usunac wyjazdu', async () => {
    await inviteKasia(tripId);

    const res = await auth(api.delete(`/api/trips/${tripId}`), tokenKasi);

    expect(res.status).toBe(403);
  });
  
    test('TC-79 usuniecie wyjazdu usuwa jego harmonogram i zadania', async () => {
    await auth(api.post(`/api/trips/${tripId}/plan`), token)
      .send({ date: '2027-05-15', title: 'Kajaki' });
    await auth(api.post(`/api/trips/${tripId}/tasks`), token)
      .send({ name: 'Kupic bilety' });

    const res = await auth(api.delete(`/api/trips/${tripId}`), token);
    expect(res.status).toBe(200);

    // numer wyjazdu do sprawdzenia w pgAdmin
    console.log('TC-79 numer usunietego wyjazdu:', tripId);
  });
});
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
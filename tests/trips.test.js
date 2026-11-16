const request = require('supertest');

const api = request('http://localhost:5000');

let token;

beforeAll(async () => {
  const res = await api
    .post('/api/auth/login')
    .send({ email: 'ola@example.com', password: 'haslo123' });
  token = res.body.token;
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
});
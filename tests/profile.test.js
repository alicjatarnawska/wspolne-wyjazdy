const request = require('supertest');

const api = request('http://localhost:5000');

function uniqueEmail() {
  return `test_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
}

// nowe konto dla kazdego testu, zeby nie zmieniac danych kont testowych
async function createUser(displayName = 'Zuza') {
  const email = uniqueEmail();
  const reg = await api
    .post('/api/auth/register')
    .send({ email, password: 'haslo123', display_name: displayName });

  const res = await api
    .post('/api/auth/login')
    .send({ email, password: 'haslo123' });

  return { email, id: reg.body.user.id, token: res.body.token };
}

function patchProfile(token, field, body) {
  return api
    .patch(`/api/users/profile/${field}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

let user;

beforeEach(async () => {
  user = await createUser();
});

describe('Profil uzytkownika', () => {
  test('TC-54 podglad profilu', async () => {
    const res = await api
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.display_name).toBe('Zuza');
  });

  test('TC-55 zmiana nicku', async () => {
    const res = await patchProfile(user.token, 'display-name', { display_name: 'Nowy nick' });

    expect(res.status).toBe(200);
  });

  test('TC-56 nick taki sam jak obecny', async () => {
    const res = await patchProfile(user.token, 'display-name', { display_name: 'Zuza' });

    expect(res.status).toBe(400);
  });

  test('TC-57 nieprawidlowy nick przy zmianie', async () => {
    const spaces = await patchProfile(user.token, 'display-name', { display_name: '   ' });
    const tooLong = await patchProfile(user.token, 'display-name', { display_name: 'a'.repeat(51) });

    expect(spaces.status).toBe(400);
    expect(tooLong.status).toBe(400);
  });

  test('TC-58 zmiana e-maila', async () => {
    const newEmail = uniqueEmail();
    const res = await patchProfile(user.token, 'email', { email: newEmail });

    expect(res.status).toBe(200);

    // logowanie nowym adresem
    const login = await api
      .post('/api/auth/login')
      .send({ email: newEmail, password: 'haslo123' });
    expect(login.status).toBe(200);
  });

  test('TC-59 e-mail zajety', async () => {
    const res = await patchProfile(user.token, 'email', { email: 'kasia@example.com' });

    expect(res.status).toBe(409);
  });

  test('TC-60 nieprawidlowy format e-maila', async () => {
    const res = await patchProfile(user.token, 'email', { email: 'abc' });

    expect(res.status).toBe(400);
  });

  test('TC-61 zmiana hasla', async () => {
    const res = await patchProfile(user.token, 'password', {
      currentPassword: 'haslo123',
      newPassword: 'noweHaslo123',
    });

    expect(res.status).toBe(200);

    // logowanie nowym haslem
    const login = await api
      .post('/api/auth/login')
      .send({ email: user.email, password: 'noweHaslo123' });
    expect(login.status).toBe(200);
  });

  test('TC-62 bledne obecne haslo', async () => {
    const res = await patchProfile(user.token, 'password', {
      currentPassword: 'zlehaslo',
      newPassword: 'noweHaslo123',
    });

    expect(res.status).toBe(401);
  });

  test('TC-63 za krotkie nowe haslo', async () => {
    const res = await patchProfile(user.token, 'password', {
      currentPassword: 'haslo123',
      newPassword: '12345',
    });

    expect(res.status).toBe(400);
  });

  test('TC-64 nowe haslo takie samo jak obecne', async () => {
    const res = await patchProfile(user.token, 'password', {
      currentPassword: 'haslo123',
      newPassword: 'haslo123',
    });

    expect(res.status).toBe(400);
  });
});

//--------------------------------------------- USUWANIE KONTA --------------------------------------------------------------//

function auth(req, token) {
  return req.set('Authorization', `Bearer ${token}`);
}

async function createTrip(token) {
  const res = await auth(api.post('/api/trips'), token).send({
    name: 'Test usuwanie konta',
    destination: 'Gizycko',
    start_date: '2027-05-14',
    end_date: '2027-05-16',
  });
  return res.body.trip.id;
}

function deleteAccount(token, password) {
  return auth(api.delete('/api/users/profile'), token).send({ password });
}

describe('Usuwanie konta', () => {
  test('TC-65 usuniecie konta bez hasla', async () => {
    const res = await deleteAccount(user.token, undefined);

    expect(res.status).toBe(400);
  });

  test('TC-66 usuniecie konta z blednym haslem', async () => {
    const res = await deleteAccount(user.token, 'zlehaslo');

    expect(res.status).toBe(401);
  });

  test('TC-67 jedyny organizator nie moze usunac konta', async () => {
    const other = await createUser('Kasia');
    const tripId = await createTrip(user.token);
    await auth(api.post(`/api/trips/${tripId}/members`), user.token).send({ email: other.email });

    const res = await deleteAccount(user.token, 'haslo123');

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Test usuwanie konta'); // nazwa wyjazdu w komunikacie
  });

  test('TC-68 poprawne usuniecie konta', async () => {
    const res = await deleteAccount(user.token, 'haslo123');
    expect(res.status).toBe(200);

    const login = await api
      .post('/api/auth/login')
      .send({ email: user.email, password: 'haslo123' });
    expect(login.status).toBe(401);
  });

  test('TC-69 wyjazd bez innych uczestnikow usuwa sie razem z kontem', async () => {
    const tripId = await createTrip(user.token);
    await deleteAccount(user.token, 'haslo123');

    // 404 = wyjazd nie istnieje (gdyby istnial, obca osoba dostalaby 403)
    const other = await createUser();
    const res = await auth(api.get(`/api/trips/${tripId}`), other.token);
    expect(res.status).toBe(404);
  });

  test('TC-70 mozna usunac konto po przekazaniu roli organizatora', async () => {
    const other = await createUser('Kasia');
    const tripId = await createTrip(user.token);
    await auth(api.post(`/api/trips/${tripId}/members`), user.token).send({ email: other.email });
    await auth(api.patch(`/api/trips/${tripId}/members/${other.id}`), user.token).send({ role: 'ORGANIZER' });

    const res = await deleteAccount(user.token, 'haslo123');
    expect(res.status).toBe(200);

    // wyjazd zostaje, a Kasia jest w nim organizatorem
    const trip = await auth(api.get(`/api/trips/${tripId}`), other.token);
    expect(trip.status).toBe(200);
    expect(trip.body.trip.my_role).toBe('ORGANIZER');
  });

  test('TC-71 zadania usunietego uzytkownika zostaja bez przypisania', async () => {
    const participant = await createUser('Kasia');
    const tripId = await createTrip(user.token);
    await auth(api.post(`/api/trips/${tripId}/members`), user.token).send({ email: participant.email });

    // zadanie przypisane uczestniczce
    const created = await auth(api.post(`/api/trips/${tripId}/tasks`), user.token)
      .send({ name: 'Kupic bilety', assigned_user_id: participant.id });
    const taskId = created.body.task.id;

    // uczestniczka usuwa konto
    await deleteAccount(participant.token, 'haslo123');

    const res = await auth(api.get(`/api/trips/${tripId}/tasks`), user.token);
    const task = res.body.tasks.find(t => t.id === taskId);
    expect(task).toBeDefined();               // zadanie zostalo
    expect(task.assigned_user_id).toBeNull(); // ale bez osoby
  });
});
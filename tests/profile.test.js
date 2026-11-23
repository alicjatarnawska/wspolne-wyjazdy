const request = require('supertest');

const api = request('http://localhost:5000');

function uniqueEmail() {
  return `test_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
}

// nowe konto dla kazdego testu, zeby nie zmieniac danych kont testowych
async function createUser(displayName = 'Zuza') {
  const email = uniqueEmail();
  await api
    .post('/api/auth/register')
    .send({ email, password: 'haslo123', display_name: displayName });

  const res = await api
    .post('/api/auth/login')
    .send({ email, password: 'haslo123' });

  return { email, token: res.body.token };
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
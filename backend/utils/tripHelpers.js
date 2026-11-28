const pool = require('../config/db');

// pobranie danych wyjazdu oraz roli zalogowanego użytkownika
const getTripWithRole = async (tripId, userId, extraColumns = '', dbClient = pool) => {
  const selectCols = extraColumns
    ? `${extraColumns}, tm.role AS my_role`
    : 't.id, tm.role AS my_role';

  const result = await dbClient.query(
    `SELECT ${selectCols}
     FROM trips t
     LEFT JOIN trip_members tm
       ON t.id = tm.trip_id AND tm.user_id = $2
     WHERE t.id = $1`,
    [tripId, userId]
  );
  return result.rows[0] || null;
};

// sprawdzenie, czy dany użytkownik jest członkiem wyjazdu i pobranie jego danych
const getTripMemberInfo = async (tripId, memberUserId, dbClient = pool) => {
  const result = await dbClient.query(
    `SELECT u.id, u.display_name, u.email, tm.role
     FROM trip_members tm
     JOIN users u ON tm.user_id = u.id
     WHERE tm.trip_id = $1 AND tm.user_id = $2`,
    [tripId, memberUserId]
  );
  return result.rows[0] || null;
};

// pobranie posortowanej listy wszystkich uczestników wyjazdu
const getTripMembersList = async (tripId, dbClient = pool) => {
  const result = await dbClient.query(
    `SELECT
       u.id,
       u.email,
       u.display_name,
       tm.role,
       tm.joined_at
     FROM trip_members tm
     JOIN users u ON tm.user_id = u.id
     WHERE tm.trip_id = $1
     ORDER BY
       CASE WHEN tm.role = 'ORGANIZER' THEN 0 ELSE 1 END,
       tm.joined_at ASC`,
    [tripId]
  );
  return result.rows;
};

module.exports = {
  getTripWithRole,
  getTripMemberInfo,
  getTripMembersList,
};
const pool = require('../config/db');
const { parsePositiveInt, validateTextField } = require('../utils/validators');
const { getTripWithRole, getTripMemberInfo } = require('../utils/tripHelpers');

// Wspólna walidacja pól zadania dla tworzenia i edycji
const validateTaskData = ({ name, assigned_user_id, due_date, status }) => {
  const nameCheck = validateTextField(name, {
    requiredMsg: 'Nazwa zadania jest wymagana.',
    maxLength: 150,
    maxLengthMsg: 'Nazwa zadania może mieć maksymalnie 150 znaków.',
    xssMsg: 'Nazwa zadania nie może zawierać niebezpiecznego kodu HTML ani skryptów.',
  });
  if (nameCheck.error) return { error: nameCheck.error };

  let normalizedAssignedUserId = null;
  if (assigned_user_id !== undefined && assigned_user_id !== null && assigned_user_id !== '') {
    const parsedId = parsePositiveInt(assigned_user_id);
    if (!parsedId) {
      return { error: 'Wybierz poprawną osobę odpowiedzialną za zadanie.' };
    }
    normalizedAssignedUserId = parsedId;
  }

  const normalizedDueDate =
    typeof due_date === 'string' && due_date.trim() ? due_date.trim() : null;

  const normalizedStatus = status !== undefined ? status : 'TODO';
  if (normalizedStatus !== 'TODO' && normalizedStatus !== 'DONE') {
    return { error: 'Nieprawidłowy status zadania. Dozwolone wartości: TODO lub DONE.' };
  }

  return {
    data: {
      name: nameCheck.value,
      assigned_user_id: normalizedAssignedUserId,
      due_date: normalizedDueDate,
      status: normalizedStatus,
    },
  };
};

// POBRANIE LISTY ZADAŃ WYJAZDU
// GET /api/trips/:tripId/tasks
exports.getTripTasks = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const userId = req.user.id;

  if (!tripId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const tasksResult = await pool.query(
      `SELECT
         t.id,
         t.trip_id,
         t.assigned_user_id,
         u.display_name AS assigned_user_name,
         u.email AS assigned_user_email,
         t.name,
         t.due_date,
         t.status
       FROM tasks t
       LEFT JOIN users u ON t.assigned_user_id = u.id
       WHERE t.trip_id = $1
       ORDER BY
         CASE WHEN t.status = 'TODO' THEN 0 ELSE 1 END ASC,
         t.due_date ASC NULLS LAST,
         t.id ASC`,
      [tripId]
    );

    res.status(200).json({
      my_role: trip.my_role,
      tasks: tasksResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania listy zadań.' });
  }
};

// DODANIE NOWEGO ZADANIA
// POST /api/trips/:tripId/tasks
exports.addTask = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const userId = req.user.id;

  if (!tripId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  const { error, data } = validateTaskData(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    let assignee = null;
    if (data.assigned_user_id !== null) {
      assignee = await getTripMemberInfo(tripId, data.assigned_user_id);
      if (!assignee) {
        return res.status(400).json({
          error: 'Wybrany użytkownik nie jest uczestnikiem tego wyjazdu.',
        });
      }
    }

    const insertResult = await pool.query(
      `INSERT INTO tasks (trip_id, assigned_user_id, name, due_date, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, trip_id, assigned_user_id, name, due_date, status`,
      [tripId, data.assigned_user_id, data.name, data.due_date, data.status]
    );

    res.status(201).json({
      message: 'Zadanie zostało dodane.',
      task: {
        ...insertResult.rows[0],
        assigned_user_name: assignee?.display_name || null,
        assigned_user_email: assignee?.email || null,
      },
    });
  } catch (err) {
    if (err.code === '22007' || err.code === '22008') {
      return res.status(400).json({ error: 'Nieprawidłowy format daty terminu zadania.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas dodawania zadania.' });
  }
};

// EDYCJA ZADANIA LUB ZMIANA STATUSU (TODO / DONE)
// PATCH /api/trips/:tripId/tasks/:taskId
exports.updateTask = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const taskId = parsePositiveInt(req.params.taskId);
  const userId = req.user.id;

  if (!tripId || !taskId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu lub zadania.' });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const existingResult = await pool.query(
      `SELECT id, assigned_user_id, name, due_date, status
       FROM tasks
       WHERE id = $1 AND trip_id = $2`,
      [taskId, tripId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono zadania w tym wyjeździe.' });
    }

    const current = existingResult.rows[0];
    const mergedInput = {
      name: req.body.name !== undefined ? req.body.name : current.name,
      assigned_user_id:
        req.body.assigned_user_id !== undefined
          ? req.body.assigned_user_id
          : current.assigned_user_id,
      due_date: req.body.due_date !== undefined ? req.body.due_date : current.due_date,
      status: req.body.status !== undefined ? req.body.status : current.status,
    };

    const { error, data } = validateTaskData(mergedInput);
    if (error) {
      return res.status(400).json({ error });
    }

    let assignee = null;
    if (data.assigned_user_id !== null) {
      assignee = await getTripMemberInfo(tripId, data.assigned_user_id);
      if (!assignee) {
        return res.status(400).json({
          error: 'Wybrany użytkownik nie jest uczestnikiem tego wyjazdu.',
        });
      }
    }

    const updateResult = await pool.query(
      `UPDATE tasks
       SET name = $1, assigned_user_id = $2, due_date = $3, status = $4
       WHERE id = $5 AND trip_id = $6
       RETURNING id, trip_id, assigned_user_id, name, due_date, status`,
      [data.name, data.assigned_user_id, data.due_date, data.status, taskId, tripId]
    );

    res.status(200).json({
      message: 'Zadanie zostało zaktualizowane.',
      task: {
        ...updateResult.rows[0],
        assigned_user_name: assignee?.display_name || null,
        assigned_user_email: assignee?.email || null,
      },
    });
  } catch (err) {
    if (err.code === '22007' || err.code === '22008') {
      return res.status(400).json({ error: 'Nieprawidłowy format daty terminu zadania.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas aktualizacji zadania.' });
  }
};

// USUNIĘCIE ZADANIA
// DELETE /api/trips/:tripId/tasks/:taskId
exports.deleteTask = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const taskId = parsePositiveInt(req.params.taskId);
  const userId = req.user.id;

  if (!tripId || !taskId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu lub zadania.' });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const deleteResult = await pool.query(
      `DELETE FROM tasks
       WHERE id = $1 AND trip_id = $2
       RETURNING id`,
      [taskId, tripId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono zadania w tym wyjeździe.' });
    }

    res.status(200).json({
      message: 'Zadanie zostało usunięte.',
      deletedId: taskId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas usuwania zadania.' });
  }
};
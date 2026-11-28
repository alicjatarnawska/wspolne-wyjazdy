const pool = require('../config/db');
const { parsePositiveInt, validateTextField } = require('../utils/validators');
const { getTripWithRole, getTripMembersList } = require('../utils/tripHelpers');

// konwersja kwoty (PLN) na całkowite grosze, aby uniknąć błędów zaokrągleń
const toGrosze = (value) => {
  const num = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
};

// konwersja groszy na kwotę z dokładnością do 2 miejsc po przecinku
const fromGrosze = (grosze) => Number((grosze / 100).toFixed(2));

// sprawdzenie, czy wartość ma maksymalnie 2 miejsca po przecinku
const hasMaxTwoDecimals = (value) => /^\d+(\.\d{1,2})?$/.test(String(value).trim());

// równoległe pobranie roli zalogowanego użytkownika oraz listy uczestników wyjazdu
const getTripContext = async (tripId, userId) => {
  const [trip, members] = await Promise.all([
    getTripWithRole(tripId, userId),
    getTripMembersList(tripId),
  ]);

  if (!trip) {
    return { trip: null, members: [] };
  }
  return { trip, members };
};

// walidacja danych wydatku oraz wyliczenie długów użytkowników w groszach
const validateAndBuildShares = (
  { name, amount, paid_by_user_id, shares, participant_ids },
  { defaultPayerId, members, existingSharesMap = new Map() }
) => {
  const nameCheck = validateTextField(name, {
    requiredMsg: 'Nazwa wydatku jest wymagana.',
    maxLength: 150,
    maxLengthMsg: 'Nazwa wydatku może mieć maksymalnie 150 znaków.',
    xssMsg: 'Nazwa wydatku nie może zawierać niebezpiecznego kodu HTML ani skryptów.',
  });
  if (nameCheck.error) return { error: nameCheck.error };

  if (amount === undefined || amount === null || amount === '' || !hasMaxTwoDecimals(amount)) {
    return { error: 'Podaj poprawną kwotę wydatku (maksymalnie dwa miejsca po przecinku).' };
  }
  const amountGrosze = toGrosze(amount);
  if (amountGrosze === null || amountGrosze <= 0 || amountGrosze > 9999999999) {
    return { error: 'Kwota wydatku musi być większa od 0.' };
  }

  let normalizedPaidByUserId = defaultPayerId;
  if (paid_by_user_id !== undefined) {
    if (paid_by_user_id === null || paid_by_user_id === '') {
      normalizedPaidByUserId = null;
    } else {
      const parsedPayerId = parsePositiveInt(paid_by_user_id);
      if (!parsedPayerId) {
        return { error: 'Wybierz poprawną osobę płacącą za wydatek.' };
      }
      normalizedPaidByUserId = parsedPayerId;
    }
  }

  const memberIdsSet = new Set(members.map((m) => m.id));
  if (normalizedPaidByUserId !== null && !memberIdsSet.has(normalizedPaidByUserId)) {
    return { error: 'Osoba płacąca musi być uczestnikiem tego wyjazdu.' };
  }

  let normalizedShares = [];

  // TRYB 1: Podano jawną tablicę udziałów [{ user_id, share_amount, is_paid? }]
  if (Array.isArray(shares)) {
    if (shares.length === 0) {
      return { error: 'Wydatek musi być przypisany do co najmniej jednego uczestnika.' };
    }

    const seenUsers = new Set();
    let sumGrosze = 0;

    for (const item of shares) {
      const targetUserId = parsePositiveInt(item?.user_id);
      if (!targetUserId || !memberIdsSet.has(targetUserId)) {
        return { error: 'Każdy udział musi dotyczyć aktywnego uczestnika tego wyjazdu.' };
      }
      if (seenUsers.has(targetUserId)) {
        return { error: 'Ten sam uczestnik nie może wystąpić dwukrotnie w podziale jednego wydatku.' };
      }
      seenUsers.add(targetUserId);

      if (
        item.share_amount === undefined ||
        item.share_amount === null ||
        item.share_amount === '' ||
        !hasMaxTwoDecimals(item.share_amount)
      ) {
        return { error: 'Podaj poprawną kwotę udziału dla każdego uczestnika.' };
      }

      const shareGrosze = toGrosze(item.share_amount);
      if (shareGrosze === null || shareGrosze < 0) {
        return { error: 'Kwota udziału nie może być ujemna.' };
      }

      sumGrosze += shareGrosze;

      const defaultPaidStatus =
        targetUserId === normalizedPaidByUserId
          ? true
          : existingSharesMap.get(targetUserId) ?? false;

      normalizedShares.push({
        user_id: targetUserId,
        share_amount: fromGrosze(shareGrosze),
        is_paid: typeof item.is_paid === 'boolean' ? item.is_paid : defaultPaidStatus,
      });
    }

    if (sumGrosze !== amountGrosze) {
      return {
        error: `Suma udziałów (${fromGrosze(sumGrosze).toFixed(2)}) musi być równa kwocie wydatku (${fromGrosze(amountGrosze).toFixed(2)}).`,
      };
    }
  } else {
    // TRYB 2: Automatyczny podział równy (dla wybranych participant_ids lub wszystkich uczestników)
    let targetIds = members.map((m) => m.id);

    if (Array.isArray(participant_ids)) {
      if (participant_ids.length === 0) {
        return { error: 'Wybierz co najmniej jedną osobę do podziału wydatku.' };
      }
      const uniqueIds = [...new Set(participant_ids.map(parsePositiveInt))];
      if (uniqueIds.some((id) => !id || !memberIdsSet.has(id))) {
        return { error: 'Wszyscy wybrani uczestnicy muszą należeć do tego wyjazdu.' };
      }
      targetIds = uniqueIds;
    }

    const count = targetIds.length;
    const baseShare = Math.floor(amountGrosze / count);
    const remainder = amountGrosze % count;

    normalizedShares = targetIds.map((targetUserId, index) => {
      const shareGrosze = baseShare + (index < remainder ? 1 : 0);
      const defaultPaidStatus =
        targetUserId === normalizedPaidByUserId
          ? true
          : existingSharesMap.get(targetUserId) ?? false;

      return {
        user_id: targetUserId,
        share_amount: fromGrosze(shareGrosze),
        is_paid: defaultPaidStatus,
      };
    });
  }

  return {
    data: {
      name: nameCheck.value,
      amount: fromGrosze(amountGrosze),
      paid_by_user_id: normalizedPaidByUserId,
      shares: normalizedShares,
    },
  };
};

// Pobranie pojedynczego wydatku wraz z listą jego udziałów
const getFullExpenseById = async (expenseId, tripId, dbClient = pool) => {
  const [expenseResult, sharesResult] = await Promise.all([
    dbClient.query(
      `SELECT
         e.id,
         e.trip_id,
         e.paid_by_user_id,
         u.display_name AS paid_by_name,
         u.email AS paid_by_email,
         e.name,
         e.amount,
         e.created_at
       FROM expenses e
       LEFT JOIN users u ON e.paid_by_user_id = u.id
       WHERE e.id = $1 AND e.trip_id = $2`,
      [expenseId, tripId]
    ),
    dbClient.query(
      `SELECT
         es.expense_id,
         es.user_id,
         u.display_name,
         u.email,
         es.share_amount,
         es.is_paid
       FROM expense_shares es
       JOIN users u ON es.user_id = u.id
       WHERE es.expense_id = $1
       ORDER BY u.display_name ASC, es.user_id ASC`,
      [expenseId]
    ),
  ]);

  if (expenseResult.rows.length === 0) {
    return null;
  }

  const row = expenseResult.rows[0];
  return {
    ...row,
    amount: Number(row.amount),
    shares: sharesResult.rows.map((s) => ({
      ...s,
      share_amount: Number(s.share_amount),
    })),
  };
};

// POBRANIE LISTY WYDATKÓW WYJAZDU ORAZ PODSUMOWANIA SALD
// GET /api/trips/:tripId/expenses
exports.getTripExpenses = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const userId = req.user.id;

  if (!tripId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  try {
    const { trip, members } = await getTripContext(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const [expensesResult, sharesResult] = await Promise.all([
      pool.query(
        `SELECT
           e.id,
           e.trip_id,
           e.paid_by_user_id,
           u.display_name AS paid_by_name,
           u.email AS paid_by_email,
           e.name,
           e.amount,
           e.created_at
         FROM expenses e
         LEFT JOIN users u ON e.paid_by_user_id = u.id
         WHERE e.trip_id = $1
         ORDER BY e.created_at DESC, e.id DESC`,
        [tripId]
      ),
      pool.query(
        `SELECT
           es.expense_id,
           es.user_id,
           u.display_name,
           u.email,
           es.share_amount,
           es.is_paid
         FROM expense_shares es
         JOIN expenses e ON es.expense_id = e.id
         JOIN users u ON es.user_id = u.id
         WHERE e.trip_id = $1
         ORDER BY u.display_name ASC, es.user_id ASC`,
        [tripId]
      ),
    ]);

    const sharesByExpense = new Map();
    for (const share of sharesResult.rows) {
      if (!sharesByExpense.has(share.expense_id)) {
        sharesByExpense.set(share.expense_id, []);
      }
      sharesByExpense.get(share.expense_id).push({
        ...share,
        share_amount: Number(share.share_amount),
      });
    }

    const balanceMap = new Map();
    for (const member of members) {
      balanceMap.set(member.id, {
        user_id: member.id,
        display_name: member.display_name,
        email: member.email,
        total_paid_grosze: 0,
        total_share_grosze: 0,
        unpaid_owed_grosze: 0,
        unpaid_to_receive_grosze: 0,
      });
    }

    let totalTripAmountGrosze = 0;

    const expenses = expensesResult.rows.map((exp) => {
      const amountGrosze = toGrosze(exp.amount);
      totalTripAmountGrosze += amountGrosze;

      const expShares = sharesByExpense.get(exp.id) || [];

      if (exp.paid_by_user_id && balanceMap.has(exp.paid_by_user_id)) {
        balanceMap.get(exp.paid_by_user_id).total_paid_grosze += amountGrosze;
      }

      for (const s of expShares) {
        const shareGrosze = toGrosze(s.share_amount);
        if (balanceMap.has(s.user_id)) {
          const debtor = balanceMap.get(s.user_id);
          debtor.total_share_grosze += shareGrosze;
          if (!s.is_paid && s.user_id !== exp.paid_by_user_id) {
            debtor.unpaid_owed_grosze += shareGrosze;
          }
        }
        if (
          !s.is_paid &&
          exp.paid_by_user_id &&
          s.user_id !== exp.paid_by_user_id &&
          balanceMap.has(exp.paid_by_user_id)
        ) {
          balanceMap.get(exp.paid_by_user_id).unpaid_to_receive_grosze += shareGrosze;
        }
      }

      return {
        ...exp,
        amount: Number(exp.amount),
        shares: expShares,
      };
    });

    const balances = Array.from(balanceMap.values()).map((b) => ({
      user_id: b.user_id,
      display_name: b.display_name,
      email: b.email,
      total_paid: fromGrosze(b.total_paid_grosze),
      total_share: fromGrosze(b.total_share_grosze),
      unpaid_owed: fromGrosze(b.unpaid_owed_grosze),
      unpaid_to_receive: fromGrosze(b.unpaid_to_receive_grosze),
      net_balance: fromGrosze(b.unpaid_to_receive_grosze - b.unpaid_owed_grosze),
    }));

    res.status(200).json({
      my_role: trip.my_role,
      total_amount: fromGrosze(totalTripAmountGrosze),
      expenses,
      balances,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas pobierania listy wydatków.' });
  }
};

// DODANIE NOWEGO WYDATKU WRAZ Z PODZIAŁEM NA UCZESTNIKÓW
// POST /api/trips/:tripId/expenses
exports.addExpense = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const userId = req.user.id;

  if (!tripId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu.' });
  }

  let client;
  try {
    const { trip, members } = await getTripContext(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const { error, data } = validateAndBuildShares(req.body, {
      defaultPayerId: userId,
      members,
    });
    if (error) {
      return res.status(400).json({ error });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const insertExpenseResult = await client.query(
      `INSERT INTO expenses (trip_id, paid_by_user_id, name, amount)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [tripId, data.paid_by_user_id, data.name, data.amount]
    );
    const newExpenseId = insertExpenseResult.rows[0].id;

    for (const share of data.shares) {
      await client.query(
        `INSERT INTO expense_shares (expense_id, user_id, share_amount, is_paid)
         VALUES ($1, $2, $3, $4)`,
        [newExpenseId, share.user_id, share.share_amount, share.is_paid]
      );
    }

    await client.query('COMMIT');

    const createdExpense = await getFullExpenseById(newExpenseId, tripId);

    res.status(201).json({
      message: 'Wydatek został dodany.',
      expense: createdExpense,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas dodawania wydatku.' });
  } finally {
    if (client) client.release();
  }
};

// EDYCJA WYDATKU I JEGO PODZIAŁU
// PATCH /api/trips/:tripId/expenses/:expenseId
exports.updateExpense = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const expenseId = parsePositiveInt(req.params.expenseId);
  const userId = req.user.id;

  if (!tripId || !expenseId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu lub wydatku.' });
  }

  let client;
  try {
    const [{ trip, members }, currentExpense] = await Promise.all([
      getTripContext(tripId, userId),
      getFullExpenseById(expenseId, tripId),
    ]);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }
    if (!currentExpense) {
      return res.status(404).json({ error: 'Nie znaleziono wydatku w tym wyjeździe.' });
    }

    if (currentExpense.paid_by_user_id !== userId && trip.my_role !== 'ORGANIZER') {
      return res.status(403).json({
        error: 'Tylko osoba płacąca za wydatek lub organizator może go edytować.',
      });
    }

    const existingSharesMap = new Map(
      currentExpense.shares.map((s) => [s.user_id, s.is_paid])
    );

    const mergedInput = {
      name: req.body.name !== undefined ? req.body.name : currentExpense.name,
      amount: req.body.amount !== undefined ? req.body.amount : currentExpense.amount,
      paid_by_user_id:
        req.body.paid_by_user_id !== undefined
          ? req.body.paid_by_user_id
          : currentExpense.paid_by_user_id,
      shares:
        req.body.shares !== undefined
          ? req.body.shares
          : req.body.participant_ids !== undefined
          ? undefined
          : currentExpense.shares.map((s) => ({
              user_id: s.user_id,
              share_amount: s.share_amount,
              is_paid: s.is_paid,
            })),
      participant_ids: req.body.participant_ids,
    };

    const { error, data } = validateAndBuildShares(mergedInput, {
      defaultPayerId: currentExpense.paid_by_user_id,
      members,
      existingSharesMap,
    });
    if (error) {
      return res.status(400).json({ error });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    await client.query(
      `UPDATE expenses
       SET name = $1, amount = $2, paid_by_user_id = $3
       WHERE id = $4 AND trip_id = $5`,
      [data.name, data.amount, data.paid_by_user_id, expenseId, tripId]
    );

    await client.query('DELETE FROM expense_shares WHERE expense_id = $1', [expenseId]);
    for (const share of data.shares) {
      await client.query(
        `INSERT INTO expense_shares (expense_id, user_id, share_amount, is_paid)
         VALUES ($1, $2, $3, $4)`,
        [expenseId, share.user_id, share.share_amount, share.is_paid]
      );
    }

    await client.query('COMMIT');

    const updatedExpense = await getFullExpenseById(expenseId, tripId);

    res.status(200).json({
      message: 'Wydatek został zaktualizowany.',
      expense: updatedExpense,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas aktualizacji wydatku.' });
  } finally {
    if (client) client.release();
  }
};

// OZNACZENIE CZĘŚCI WYDATKU JAKO OPŁACONEJ / NIEOPŁACONEJ
// PATCH /api/trips/:tripId/expenses/:expenseId/shares/:userId
exports.updateExpenseShareStatus = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const expenseId = parsePositiveInt(req.params.expenseId);
  const targetUserId = parsePositiveInt(req.params.userId);
  const requesterId = req.user.id;

  if (!tripId || !expenseId || !targetUserId) {
    return res.status(400).json({ error: 'Nieprawidłowe parametry identyfikujące udział.' });
  }

  try {
    const trip = await getTripWithRole(tripId, requesterId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const expenseResult = await pool.query(
      'SELECT id, paid_by_user_id FROM expenses WHERE id = $1 AND trip_id = $2',
      [expenseId, tripId]
    );

    if (expenseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono wydatku w tym wyjeździe.' });
    }

    const expense = expenseResult.rows[0];

    const canChangeStatus =
      requesterId === targetUserId ||
      requesterId === expense.paid_by_user_id ||
      trip.my_role === 'ORGANIZER';

    if (!canChangeStatus) {
      return res.status(403).json({
        error: 'Nie masz uprawnień do zmiany statusu rozliczenia tego udziału.',
      });
    }

    const currentShareResult = await pool.query(
      'SELECT is_paid FROM expense_shares WHERE expense_id = $1 AND user_id = $2',
      [expenseId, targetUserId]
    );

    if (currentShareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono udziału tego użytkownika w wydatku.' });
    }

    const nextIsPaid =
      typeof req.body?.is_paid === 'boolean'
        ? req.body.is_paid
        : !currentShareResult.rows[0].is_paid;

    await pool.query(
      `UPDATE expense_shares
       SET is_paid = $1
       WHERE expense_id = $2 AND user_id = $3`,
      [nextIsPaid, expenseId, targetUserId]
    );

    const updatedExpense = await getFullExpenseById(expenseId, tripId);

    res.status(200).json({
      message: nextIsPaid
        ? 'Udział został oznaczony jako opłacony.'
        : 'Cofnięto oznaczenie spłaty udziału.',
      expense: updatedExpense,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas zmiany statusu rozliczenia.' });
  }
};

// USUNIĘCIE WYDATKU
// DELETE /api/trips/:tripId/expenses/:expenseId
exports.deleteExpense = async (req, res) => {
  const tripId = parsePositiveInt(req.params.tripId);
  const expenseId = parsePositiveInt(req.params.expenseId);
  const userId = req.user.id;

  if (!tripId || !expenseId) {
    return res.status(400).json({ error: 'Nieprawidłowy identyfikator wyjazdu lub wydatku.' });
  }

  try {
    const trip = await getTripWithRole(tripId, userId);

    if (!trip) {
      return res.status(404).json({ error: 'Nie znaleziono wyjazdu.' });
    }
    if (!trip.my_role) {
      return res.status(403).json({ error: 'Nie masz dostępu do tego wyjazdu.' });
    }

    const expenseResult = await pool.query(
      'SELECT id, paid_by_user_id FROM expenses WHERE id = $1 AND trip_id = $2',
      [expenseId, tripId]
    );

    if (expenseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono wydatku w tym wyjeździe.' });
    }

    if (expenseResult.rows[0].paid_by_user_id !== userId && trip.my_role !== 'ORGANIZER') {
      return res.status(403).json({
        error: 'Tylko osoba płacąca za wydatek lub organizator może go usunąć.',
      });
    }

    await pool.query(
      'DELETE FROM expenses WHERE id = $1 AND trip_id = $2',
      [expenseId, tripId]
    );

    res.status(200).json({
      message: 'Wydatek został usunięty.',
      deletedId: expenseId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd serwera podczas usuwania wydatku.' });
  }
};
const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middleware/authMiddleware');
const expenseController = require('../controllers/expenseController');

router.use(authMiddleware);

router.get('/', expenseController.getTripExpenses);
router.post('/', expenseController.addExpense);
router.patch('/:expenseId', expenseController.updateExpense);
router.patch('/:expenseId/shares/:userId', expenseController.updateExpenseShareStatus);
router.delete('/:expenseId', expenseController.deleteExpense);

module.exports = router;
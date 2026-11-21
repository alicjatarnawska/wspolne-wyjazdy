const express = require('express');
const router = express.Router({ mergeParams: true });
const taskController = require('../controllers/taskController');

router.get('/', taskController.getTripTasks);
router.post('/', taskController.addTask);
router.patch('/:taskId', taskController.updateTask);
router.delete('/:taskId', taskController.deleteTask);

module.exports = router;
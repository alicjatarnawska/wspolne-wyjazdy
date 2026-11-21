const express = require('express');
const router = express.Router({ mergeParams: true });
const planController = require('../controllers/planController');

router.get('/', planController.getTripPlan);
router.post('/', planController.addPlanItem);
router.patch('/:itemId', planController.updatePlanItem);
router.delete('/:itemId', planController.deletePlanItem);

module.exports = router;
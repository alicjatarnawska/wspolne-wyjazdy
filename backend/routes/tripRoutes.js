const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, tripController.createTrip);
router.get('/', authMiddleware, tripController.getUserTrips);
router.get('/:tripId', authMiddleware, tripController.getTripDetails);
router.get('/:tripId/members', authMiddleware, tripController.getTripMembers);
router.post('/:tripId/members', authMiddleware, tripController.inviteMember);
router.patch('/:tripId/members/:userId', authMiddleware, tripController.updateMemberRole);

module.exports = router;
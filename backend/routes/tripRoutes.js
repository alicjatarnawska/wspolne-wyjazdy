const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const authMiddleware = require('../middleware/authMiddleware');
const planRoutes = require('./planRoutes');
const taskRoutes = require('./taskRoutes');

//strona główna wyjazdów
router.post('/', authMiddleware, tripController.createTrip);
router.get('/', authMiddleware, tripController.getUserTrips);
//strona szczegółów wyjazdu, edycja wyjazdu, usuwanie wyjazdu
router.get('/:tripId', authMiddleware, tripController.getTripDetails);
router.patch('/:tripId', authMiddleware, tripController.updateTrip);
router.delete('/:tripId', authMiddleware, tripController.deleteTrip);
//zakładka "Uczestnicy"
router.get('/:tripId/members', authMiddleware, tripController.getTripMembers);
router.post('/:tripId/members', authMiddleware, tripController.inviteMember);
router.patch('/:tripId/members/:userId', authMiddleware, tripController.updateMemberRole);
router.delete('/:tripId/members/:userId', authMiddleware, tripController.removeMember);
//zakładka "Harmonogram"
router.use('/:tripId/plan', authMiddleware, planRoutes);
//zakładka "Zadania"
router.use('/:tripId/tasks', authMiddleware, taskRoutes);

module.exports = router;
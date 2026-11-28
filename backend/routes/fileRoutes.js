const express = require('express');
const router = express.Router({ mergeParams: true });
const { handleTripFilesUpload } = require('../middleware/uploadMiddleware');
const fileController = require('../controllers/fileController');


router.get('/', fileController.getTripFiles);

// pierw sprawdzamy członkostwo użytkownika, następnie obsługujemy upload plików
router.post(
  '/',
  fileController.verifyTripMembership,
  handleTripFilesUpload,
  fileController.uploadTripFiles
);

router.patch('/:fileId', fileController.updateTripFile);
router.get('/:fileId/download', fileController.downloadTripFile);
router.delete('/:fileId', fileController.deleteTripFile);

module.exports = router;
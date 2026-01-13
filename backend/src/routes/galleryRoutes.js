// Imports
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getFolderImages, uploadImage } = require('../controllers/galleryController');
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

router.get('/:folderId', getFolderImages);
router.post('/:folderId/upload',
    firebaseAuthMiddleware,
    roleMiddleware(['admin', 'church_leadership', 'secretary', 'relationship']),
    upload.single('image'),
    uploadImage
);

module.exports = router;

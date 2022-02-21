const express = require('express');
const {
	enterQueue,
	pollQueue,
	doneCall,
	cleanup,
} = require('../controllers/matching');

const router = express.Router();

router.post('/enterQueue', async (req, res, next) => {
	await enterQueue(req, res, next);
});

router.get('/pollQueue/:uId', async (req, res, next) => {
	await pollQueue(req, res, next);
});

router.get('/doneCall/:uId', async (req, res, next) => {
	await doneCall(req, res, next);
});

router.get('/cleanup/:uId', async (req, res, next) => {
	await cleanup(req, res, next);
});

module.exports = router;

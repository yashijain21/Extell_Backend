import express from 'express';
import { listPublicPartners } from '../controllers/publicPartnerController.js';

const router = express.Router();

router.get('/', listPublicPartners);

export default router;

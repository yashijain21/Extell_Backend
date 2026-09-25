import express from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware.js';
import { loginPartner, getPartnerMe, requestPartnerPasswordReset } from '../controllers/partnerAuthController.js';
import {
  listPartnerLeads,
  listPartnerQuotes,
  listPartnerProducts,
  createPartnerQuote
} from '../controllers/partnerController.js';

const router = express.Router();

router.post('/login', loginPartner);
router.post('/forgot-password', requestPartnerPasswordReset);

router.use(authMiddleware, roleMiddleware(['partner_admin', 'partner_user']));

router.get('/me', getPartnerMe);
router.get('/leads', listPartnerLeads);
router.get('/quotes', listPartnerQuotes);
router.post('/quotes', createPartnerQuote);
router.get('/products', listPartnerProducts);

export default router;

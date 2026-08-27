import express from 'express';
import { loginAdmin, getMe } from '../controllers/adminAuthController.js';
import { getDashboardStats } from '../controllers/adminDashboardController.js';
import { getHomePageContent, updateHomePageContent } from '../controllers/homePageController.js';
import {
  listAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct
} from '../controllers/adminProductController.js';
import {
  listAdminCategories,
  getAdminCategoryById,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory
} from '../controllers/adminCategoryController.js';
import { listSolutions, createSolution, updateSolution, deleteSolution } from '../controllers/solutionsController.js';
import { listProjects, createProject, updateProject, deleteProject } from '../controllers/projectsController.js';
import { listResources, createResource, deleteResource } from '../controllers/resourcesController.js';
import { listTickets, updateTicketStatus } from '../controllers/ticketsController.js';
import { listWarrantyRegistrations, updateWarrantyStatus } from '../controllers/warrantyController.js';
import { listQuoteRequests, updateQuoteStatus } from '../controllers/quoteController.js';
import { listAdmins, createAdmin } from '../controllers/adminUserController.js';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware.js';
import {
  listAdminPartners,
  getAdminPartnerById,
  createAdminPartner,
  updateAdminPartner,
  deleteAdminPartner,
  invitePartnerUser,
  resetPartnerPassword,
  listAdminPartnerLeads,
  listAdminPartnerQuotes,
  generateAdminPartnerQuote,
  previewAdminPartnerQuote
} from '../controllers/adminPartnerController.js';

const router = express.Router();

router.post('/login', loginAdmin);
router.get('/me', authMiddleware, getMe);

router.use(authMiddleware, roleMiddleware(['admin']));

router.get('/dashboard', getDashboardStats);

router.get('/homepage', getHomePageContent);
router.put('/homepage', updateHomePageContent);

router.get('/products', listAdminProducts);
router.post('/products', createAdminProduct);
router.put('/products/:id', updateAdminProduct);
router.delete('/products/:id', deleteAdminProduct);
router.get('/categories', listAdminCategories);
router.get('/categories/:id', getAdminCategoryById);
router.post('/categories', createAdminCategory);
router.put('/categories/:id', updateAdminCategory);
router.delete('/categories/:id', deleteAdminCategory);

router.get('/solutions', listSolutions);
router.post('/solutions', createSolution);
router.put('/solutions/:id', updateSolution);
router.delete('/solutions/:id', deleteSolution);

router.get('/projects', listProjects);
router.post('/projects', createProject);
router.put('/projects/:id', updateProject);
router.delete('/projects/:id', deleteProject);

router.get('/resources', listResources);
router.post('/resources', createResource);
router.delete('/resources/:id', deleteResource);

router.get('/tickets', listTickets);
router.put('/tickets/:id/status', updateTicketStatus);

router.get('/quotes', listQuoteRequests);
router.put('/quotes/:id/status', updateQuoteStatus);

router.get('/warranties', listWarrantyRegistrations);
router.put('/warranties/:id/status', updateWarrantyStatus);

router.get('/users', listAdmins);
router.post('/users', createAdmin);

router.get('/partners', listAdminPartners);
router.post('/partners', createAdminPartner);
router.get('/partners/:id', getAdminPartnerById);
router.put('/partners/:id', updateAdminPartner);
router.delete('/partners/:id', deleteAdminPartner);
router.post('/partners/:id/invite', invitePartnerUser);
router.post('/partners/:id/reset-password', resetPartnerPassword);

router.get('/partner-leads', listAdminPartnerLeads);
router.get('/partner-quotes', listAdminPartnerQuotes);
router.post('/partner-quotes/preview', previewAdminPartnerQuote);
router.post('/partner-quotes/generate', generateAdminPartnerQuote);

export default router;

import express from 'express';
import { loginAdmin, getMe } from '../controllers/adminAuthController.js';
import { getDashboardStats } from '../controllers/adminDashboardController.js';
import { getHomePageContent, updateHomePageContent } from '../controllers/homePageController.js';
import {
  listAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  listAdminCategories
} from '../controllers/adminProductController.js';
import { listSolutions, createSolution, updateSolution, deleteSolution } from '../controllers/solutionsController.js';
import { listProjects, createProject, updateProject, deleteProject } from '../controllers/projectsController.js';
import { listResources, createResource, deleteResource } from '../controllers/resourcesController.js';
import { listTickets, updateTicketStatus } from '../controllers/ticketsController.js';
import { listAdmins, createAdmin } from '../controllers/adminUserController.js';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware.js';

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

router.get('/users', listAdmins);
router.post('/users', createAdmin);

export default router;

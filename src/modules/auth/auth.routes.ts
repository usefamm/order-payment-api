import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { loginSchema, registerSchema } from './auth.schema';
import {
  loginController,
  logoutController,
  registerController,
} from './auth.controller';

const router = Router();

router.post('/register', validate(registerSchema), registerController);
router.post('/login', validate(loginSchema), loginController);
// Logout must be authenticated so we know which jti to revoke.
router.post('/logout', requireAuth(), logoutController);

export default router;

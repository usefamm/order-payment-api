import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler';
import { sendSuccess } from '../../shared/http/sendSuccess';
import * as authService from './auth.service';
import type { LoginInput, RegisterInput } from './auth.schema';

export const registerController = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body as RegisterInput);
  sendSuccess(res, result, 201);
});

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body as LoginInput);
  sendSuccess(res, result);
});

export const logoutController = asyncHandler(async (req: Request, res: Response) => {
  // requireAuth already verified the token and put its jti on the request.
  await authService.logout(req.auth!.jti);
  sendSuccess(res, { revoked: true });
});

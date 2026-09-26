import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler';
import { sendSuccess } from '../../shared/http/sendSuccess';
import * as orderService from './order.service';
import type { CreateOrderInput } from './order.schema';

export const createOrderController = asyncHandler(async (req: Request, res: Response) => {
  // The order is always created on behalf of the authenticated caller; there is
  // no way to inject another user's id.
  const order = await orderService.createOrder(req.auth!.userId, req.body as CreateOrderInput);
  sendSuccess(res, order, 201);
});

export const getOrderController = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrderForRequester(req.params.id, req.auth!);
  sendSuccess(res, order);
});

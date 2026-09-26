import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/http/asyncHandler';
import { sendSuccess } from '../../shared/http/sendSuccess';
import * as productService from './product.service';
import type { CreateProductInput } from './product.schema';

export const createProductController = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.createProduct(req.body as CreateProductInput);
  sendSuccess(res, product, 201);
});

export const listProductsController = asyncHandler(async (req: Request, res: Response) => {
  const includeInactive = req.query.includeInactive === 'true';
  const products = await productService.listProducts(includeInactive);
  sendSuccess(res, products);
});

export const getProductController = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.getProduct(req.params.id);
  sendSuccess(res, product);
});

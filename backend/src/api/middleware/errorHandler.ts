import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../models/types';

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  console.error('Unhandled error:', error);
  
  const response: ApiResponse<null> = {
    success: false,
    error: error.message || 'Internal server error',
  };
  
  // Determine status code based on error type
  let statusCode = 500;
  
  if (error.message.includes('not found') || error.message.includes('does not exist')) {
    statusCode = 404;
  } else if (error.message.includes('already exists')) {
    statusCode = 409;
  } else if (error.message.includes('access denied') || error.message.includes('unauthorized')) {
    statusCode = 403;
  } else if (error.message.includes('invalid') || error.message.includes('required')) {
    statusCode = 400;
  }
  
  res.status(statusCode).json(response);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse<null> = {
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  };
  
  res.status(404).json(response);
}


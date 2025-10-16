import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../common/app-errors";
import HttpStatusCodes from "../common/https-status-codes";

interface ErrorResponse {
   error: string;
   source?: "prisma" | "zod" | "application" | "system";
   code?: string;
   details?: unknown;
   errors?: Array<{ field: string; message: string }>;
}

/**
 * Maps Prisma error codes to HTTP status codes and user-friendly messages
 */
const handlePrismaError = (
   error: Prisma.PrismaClientKnownRequestError
): { status: HttpStatusCodes; message: string; code: string } => {
   const { code, meta } = error;

   switch (code) {
      case "P2000":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "The provided value for the column is too long",
            code,
         };
      case "P2001":
         return {
            status: HttpStatusCodes.NOT_FOUND,
            message: "The record searched for does not exist",
            code,
         };
      case "P2002":
         return {
            status: HttpStatusCodes.CONFLICT,
            message: `Unique constraint failed on: ${(meta?.target as string[])?.join(", ") || "field"}`,
            code,
         };
      case "P2003":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "Foreign key constraint failed",
            code,
         };
      case "P2004":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "A constraint failed on the database",
            code,
         };
      case "P2005":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: `Invalid value stored in the database: ${meta?.field_value || ""}`,
            code,
         };
      case "P2006":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: `The provided value is invalid: ${meta?.field_name || ""}`,
            code,
         };
      case "P2007":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "Data validation error",
            code,
         };
      case "P2008":
         return {
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: "Failed to parse the query",
            code,
         };
      case "P2009":
         return {
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: "Failed to validate the query",
            code,
         };
      case "P2010":
         return {
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: "Raw query failed",
            code,
         };
      case "P2011":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "Null constraint violation",
            code,
         };
      case "P2012":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "Missing a required value",
            code,
         };
      case "P2013":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "Missing required argument",
            code,
         };
      case "P2014":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "The change would violate a required relation",
            code,
         };
      case "P2015":
         return {
            status: HttpStatusCodes.NOT_FOUND,
            message: "Related record not found",
            code,
         };
      case "P2016":
         return {
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: "Query interpretation error",
            code,
         };
      case "P2017":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "The records for relation are not connected",
            code,
         };
      case "P2018":
         return {
            status: HttpStatusCodes.NOT_FOUND,
            message: "Required connected records not found",
            code,
         };
      case "P2019":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "Input error",
            code,
         };
      case "P2020":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "Value out of range for the type",
            code,
         };
      case "P2021":
         return {
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: "The table does not exist in the current database",
            code,
         };
      case "P2022":
         return {
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: "The column does not exist in the current database",
            code,
         };
      case "P2023":
         return {
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: "Inconsistent column data",
            code,
         };
      case "P2024":
         return {
            status: HttpStatusCodes.REQUEST_TIMEOUT,
            message: "Connection to the database timed out",
            code,
         };
      case "P2025":
         return {
            status: HttpStatusCodes.NOT_FOUND,
            message: "Record to update or delete not found",
            code,
         };
      case "P2026":
         return {
            status: HttpStatusCodes.BAD_REQUEST,
            message: "The query does not support the current database provider",
            code,
         };
      case "P2027":
         return {
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: "Multiple errors occurred during query execution",
            code,
         };
      case "P2028":
         return {
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: "Transaction API error",
            code,
         };
      case "P2030":
         return {
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: "Cannot find a fulltext index to use for the search",
            code,
         };
      default:
         return {
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
            message: "Database operation failed",
            code,
         };
   }
};

/**
 * Global error handling middleware
 * Handles AppError, Prisma errors, and generic errors
 */
export const errorMiddleware = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
   console.error("Error:", err);

   // Handle custom AppError
   if (err instanceof AppError) {
      const response: ErrorResponse = {
         error: err.message,
         source: "application",
      };
      res.status(err.status).json(response);
      return;
   }

   // Handle Prisma Known Request Errors (with error codes)
   if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const { status, message, code } = handlePrismaError(err);
      const response: ErrorResponse = {
         error: message,
         source: "prisma",
         code,
      };
      res.status(status).json(response);
      return;
   }

   // Handle Prisma Validation Errors (invalid query structure)
   if (err instanceof Prisma.PrismaClientValidationError) {
      const errorMessage = err.message;

      // Extract field-specific validation errors
      const errors: Array<{ field: string; message: string }> = [];

      // Pattern: "Argument `fieldName` is missing"
      const missingArgMatches = errorMessage.matchAll(/Argument `(\w+)` is missing/g);
      for (const match of missingArgMatches) {
         errors.push({
            field: match[1],
            message: `${match[1]} is required`,
         });
      }

      // Pattern: "Argument `fieldName`: [error details]"
      const invalidArgMatches = errorMessage.matchAll(/Argument `(\w+)`: ([^\n]+)/g);
      for (const match of invalidArgMatches) {
         errors.push({
            field: match[1],
            message: match[2].trim(),
         });
      }

      // Pattern: "Unknown arg `fieldName`"
      const unknownArgMatches = errorMessage.matchAll(/Unknown arg `(\w+)`/g);
      for (const match of unknownArgMatches) {
         errors.push({
            field: match[1],
            message: `Unknown field: ${match[1]}`,
         });
      }

      // If we found specific field errors, return them
      if (errors.length > 0) {
         const response: ErrorResponse = {
            error: "Validation failed",
            source: "prisma",
            code: "VALIDATION_ERROR",
            errors,
         };
         res.status(HttpStatusCodes.BAD_REQUEST).json(response);
         return;
      }

      // Otherwise return generic error with details in development
      const response: ErrorResponse = {
         error: "Invalid data provided for database operation",
         source: "prisma",
         code: "VALIDATION_ERROR",
         details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      };
      res.status(HttpStatusCodes.BAD_REQUEST).json(response);
      return;
   }

   // Handle Prisma Initialization Errors (connection issues)
   if (err instanceof Prisma.PrismaClientInitializationError) {
      const response: ErrorResponse = {
         error: "Database connection error",
         source: "prisma",
         code: "DB_CONNECTION_ERROR",
      };
      res.status(HttpStatusCodes.SERVICE_UNAVAILABLE).json(response);
      return;
   }

   // Handle Prisma Rust Panic Errors (rare crashes)
   if (err instanceof Prisma.PrismaClientRustPanicError) {
      const response: ErrorResponse = {
         error: "Critical database error occurred",
         source: "prisma",
         code: "DB_PANIC_ERROR",
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
      return;
   }

   // Handle generic errors
   const response: ErrorResponse = {
      error: err.message || "Internal server error",
      source: "system",
   };
   res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
};

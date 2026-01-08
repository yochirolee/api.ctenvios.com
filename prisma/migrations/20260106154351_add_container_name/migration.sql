/*
  Warnings:

  - Added the required column `container_name` to the `Container` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Container" ADD COLUMN     "container_name" TEXT NOT NULL;

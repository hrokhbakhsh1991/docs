-- Allow a member payment receipt to be submitted as text evidence without a file.
ALTER TABLE "payment_receipts"
  ALTER COLUMN "file_key" DROP NOT NULL;

-- Session URI contains a bearer-like identifier. Store only attempt-bound ciphertext.
ALTER TABLE "PublicationAttempt" ADD COLUMN "mediaSha256" TEXT;
ALTER TABLE "PublicationAttempt" ADD COLUMN "mediaBytes" INTEGER;
ALTER TABLE "PublicationAttempt" ADD COLUMN "uploadSessionCiphertext" TEXT;

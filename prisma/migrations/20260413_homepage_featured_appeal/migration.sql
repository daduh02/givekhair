-- Add a single homepage-feature flag to appeals. Application logic enforces
-- that only one active/public appeal is featured at a time.
ALTER TABLE "Appeal"
ADD COLUMN "isFeaturedHomepage" BOOLEAN NOT NULL DEFAULT false;

-- Add image_url column to cyphers if it doesn't exist
ALTER TABLE cyphers ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Storage policies for cypher-images bucket
-- Allow authenticated users to upload to their own folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload their own cypher images'
  ) THEN
    CREATE POLICY "Users can upload their own cypher images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'cypher-images'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Allow authenticated users to update/replace their own images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update their own cypher images'
  ) THEN
    CREATE POLICY "Users can update their own cypher images"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'cypher-images'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Allow public read of all cypher images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read cypher images'
  ) THEN
    CREATE POLICY "Public read cypher images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'cypher-images');
  END IF;
END $$;

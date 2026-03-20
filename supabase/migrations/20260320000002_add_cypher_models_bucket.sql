-- Create cypher-models bucket for GLB files
INSERT INTO storage.buckets (id, name, public)
VALUES ('cypher-models', 'cypher-models', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Public read cypher models'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read cypher models"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = ''cypher-models'')';
  END IF;
END
$$;

-- Authenticated upload policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Authenticated upload cypher models'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated upload cypher models"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = ''cypher-models'')';
  END IF;
END
$$;

-- Authenticated update policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Authenticated update cypher models'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated update cypher models"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = ''cypher-models'')';
  END IF;
END
$$;

-- Create cypher_pose_sets table for storing multiple generated pose sets per cypher
CREATE TABLE IF NOT EXISTS cypher_pose_sets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cypher_id uuid REFERENCES cyphers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  pose_type text NOT NULL,
  set_number integer NOT NULL,
  image_right_url text,
  image_left_url text,
  is_active boolean DEFAULT false,
  generated_at timestamptz DEFAULT now(),
  fp_cost integer DEFAULT 0
);

-- Only one active set per pose type per cypher
CREATE UNIQUE INDEX IF NOT EXISTS one_active_pose_per_type
ON cypher_pose_sets(cypher_id, pose_type)
WHERE is_active = true;

-- Enable RLS
ALTER TABLE cypher_pose_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cypher_pose_sets
CREATE POLICY "Users can insert their own pose sets"
ON cypher_pose_sets FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read their own pose sets"
ON cypher_pose_sets FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own pose sets"
ON cypher_pose_sets FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Ensure cyphers table has an UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cyphers'
    AND cmd = 'UPDATE'
    AND policyname = 'Users can update their own cyphers'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own cyphers"
      ON cyphers FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())';
  END IF;
END
$$;

-- Ensure storage objects have an UPDATE policy for cypher-images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Users can update their own cypher images'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own cypher images"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = ''cypher-images'' AND (storage.foldername(name))[1] = auth.uid()::text)';
  END IF;
END
$$;

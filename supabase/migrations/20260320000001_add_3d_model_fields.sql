-- Add 3D model URL to cyphers table
ALTER TABLE cyphers
ADD COLUMN IF NOT EXISTS model_url text,
ADD COLUMN IF NOT EXISTS model_generated_at timestamptz;

COMMENT ON COLUMN cyphers.model_url IS 'GLB 3D model URL generated via Tripo, used for battle grid and 3D viewer';
COMMENT ON COLUMN cyphers.image_url IS 'Primary 2D PNG, used for roster list and cypher sheet header fast loading';

-- Update cypher_pose_sets to support GLB
ALTER TABLE cypher_pose_sets
ADD COLUMN IF NOT EXISTS model_url text,
ADD COLUMN IF NOT EXISTS generation_method text DEFAULT 'tripo';

COMMENT ON COLUMN cypher_pose_sets.model_url IS 'GLB pose model URL from Tripo, replaces image_right_url and image_left_url';
COMMENT ON COLUMN cypher_pose_sets.generation_method IS 'tripo or png_legacy for tracking which pipeline generated this set';

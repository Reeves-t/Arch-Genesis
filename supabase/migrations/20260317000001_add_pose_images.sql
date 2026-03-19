-- Add directional and pose image columns to cyphers table
ALTER TABLE cyphers
ADD COLUMN IF NOT EXISTS image_front_url text,
ADD COLUMN IF NOT EXISTS image_right_url text,
ADD COLUMN IF NOT EXISTS image_left_url text,
ADD COLUMN IF NOT EXISTS attack_front_url text,
ADD COLUMN IF NOT EXISTS attack_right_url text,
ADD COLUMN IF NOT EXISTS attack_left_url text,
ADD COLUMN IF NOT EXISTS defend_front_url text,
ADD COLUMN IF NOT EXISTS defend_right_url text,
ADD COLUMN IF NOT EXISTS defend_left_url text,
ADD COLUMN IF NOT EXISTS generation_prompt text,
ADD COLUMN IF NOT EXISTS generation_seed integer,
ADD COLUMN IF NOT EXISTS poses_generated_at timestamptz;

-- Add comment documenting the pose system
COMMENT ON COLUMN cyphers.image_url IS 'Primary identity image, front facing, used on roster and cypher sheet';
COMMENT ON COLUMN cyphers.image_front_url IS 'Front facing battle pose, same as image_url but explicit alias';
COMMENT ON COLUMN cyphers.image_right_url IS 'Right facing battle pose, used for player side on grid';
COMMENT ON COLUMN cyphers.image_left_url IS 'Left facing battle pose, used for opponent side on grid';
COMMENT ON COLUMN cyphers.attack_right_url IS 'Attack pose facing right, triggered on player attack turn';
COMMENT ON COLUMN cyphers.attack_left_url IS 'Attack pose facing left, triggered on opponent attack turn';
COMMENT ON COLUMN cyphers.defend_right_url IS 'Defend pose facing right, triggered on player defense turn';
COMMENT ON COLUMN cyphers.defend_left_url IS 'Defend pose facing left, triggered on opponent defense turn';
COMMENT ON COLUMN cyphers.generation_prompt IS 'Original prompt used for initial generation, referenced for pose consistency';
COMMENT ON COLUMN cyphers.generation_seed IS 'Seed used for initial generation, used for pose generation consistency';

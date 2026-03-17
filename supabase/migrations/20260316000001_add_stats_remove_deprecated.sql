-- Remove deprecated columns from cyphers
ALTER TABLE cyphers DROP COLUMN IF EXISTS visual_style;
ALTER TABLE cyphers DROP COLUMN IF EXISTS material;

-- Add stat columns to cyphers
ALTER TABLE cyphers ADD COLUMN IF NOT EXISTS movement_speed integer;
ALTER TABLE cyphers ADD COLUMN IF NOT EXISTS attack_range integer;
ALTER TABLE cyphers ADD COLUMN IF NOT EXISTS melee_power integer;
ALTER TABLE cyphers ADD COLUMN IF NOT EXISTS defense_rating integer;
ALTER TABLE cyphers ADD COLUMN IF NOT EXISTS special_range integer;
ALTER TABLE cyphers ADD COLUMN IF NOT EXISTS initiative integer;
ALTER TABLE cyphers ADD COLUMN IF NOT EXISTS bonus_points_allocated jsonb;
ALTER TABLE cyphers ADD COLUMN IF NOT EXISTS structure_standard_mapping jsonb;

-- Remove deprecated columns from cypher_sheets
ALTER TABLE cypher_sheets DROP COLUMN IF EXISTS visual_style;
ALTER TABLE cypher_sheets DROP COLUMN IF EXISTS material;

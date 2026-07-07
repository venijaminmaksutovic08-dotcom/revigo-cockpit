-- Adds a free-text notes field to monthly_targets so revenue managers can
-- annotate each month with context the math cannot know (events, closures, etc.)
alter table monthly_targets add column if not exists notes text;

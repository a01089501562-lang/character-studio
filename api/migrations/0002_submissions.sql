CREATE TABLE submissions(
  class_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action_at INTEGER NOT NULL,
  turnaround_at INTEGER,
  character_name TEXT NOT NULL,
  PRIMARY KEY(class_id,user_id),
  FOREIGN KEY(class_id,user_id) REFERENCES members(class_id,user_id)
);

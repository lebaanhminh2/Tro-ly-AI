/* Reward and account balance are committed in the same guarded transaction.
   Calendar dates use Vietnam midnight, independently of the sleep day. */
CREATE TABLE daily_checkins (
 owner TEXT NOT NULL,
 day INTEGER NOT NULL,
 cycle_start_day INTEGER NOT NULL,
 reward_day INTEGER NOT NULL CHECK (reward_day BETWEEN 1 AND 30),
 reward_json TEXT NOT NULL CHECK (json_valid(reward_json)),
 created INTEGER NOT NULL,
 PRIMARY KEY (owner, day),
 UNIQUE (owner, cycle_start_day, reward_day),
 CHECK (day >= cycle_start_day AND day < cycle_start_day + 32)
);

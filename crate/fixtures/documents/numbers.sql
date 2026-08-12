-- retention is 0755 days, not a mode
SELECT id, rate FROM prices WHERE id = 42 AND rate > 0.0825;
UPDATE prices SET mask = 0xFF, budget = 1_000 WHERE id = 7;

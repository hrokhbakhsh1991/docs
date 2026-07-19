-- Release integrity: phase4 created outbox_events without GRANTs to app_tour.
-- Fresh empty migrate left Booking approve unable to INSERT outbox (42501).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE outbox_events TO app_tour;

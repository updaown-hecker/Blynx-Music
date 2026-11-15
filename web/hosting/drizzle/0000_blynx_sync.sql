CREATE TABLE `blynx_sync` (
  `owner` text NOT NULL,
  `profile` text NOT NULL,
  `revision` integer NOT NULL,
  `state` text NOT NULL,
  PRIMARY KEY (`owner`, `profile`)
);

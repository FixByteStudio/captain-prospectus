ALTER TABLE `prospects` ADD `name_search` text;--> statement-breakpoint
-- ADR-0032. On printable ASCII, foldForSearch equals lower(), so those names are
-- folded here in one statement. Any other name stays null until the nightly
-- sweep folds it in JS: SQLite cannot strip an accent or lowercase "É".
UPDATE `prospects` SET `name_search` = lower(`name`) WHERE `name` NOT GLOB '*[^ -~]*';

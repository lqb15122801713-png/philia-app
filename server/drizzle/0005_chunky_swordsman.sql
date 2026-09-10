ALTER TABLE `users` ADD `wx_openid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_wx_openid_unique` ON `users` (`wx_openid`);
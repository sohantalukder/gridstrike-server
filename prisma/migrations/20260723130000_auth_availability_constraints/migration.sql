-- Enforce normalized registered-account uniqueness for auth availability checks.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User"(LOWER("email"));
CREATE UNIQUE INDEX "User_registered_username_key" ON "User"("username") WHERE "authMode" = 'email';

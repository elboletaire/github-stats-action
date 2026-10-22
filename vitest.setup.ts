// Git hooks export GIT_* (GIT_DIR, GIT_INDEX_FILE...), which would point the tests' git calls at the real repo.
for (const key of Object.keys(process.env)) {
  if (key.startsWith('GIT_')) delete process.env[key];
}

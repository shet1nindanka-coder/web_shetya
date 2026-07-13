# TutorFlow: project-specific handoff rules

After every task that changes project files, always end the user-facing response with a short, copy-pasteable section named `Как применить на сайте`.

## Deployment environment

- Local Mac repository: `~/Desktop/Сайт`
- Production server repository: `~/web_shetya`
- Production process manager: PM2
- PM2 application name: `shetya`
- Default deployment uses Git + npm + PM2, not Docker.

## Required handoff format

Tailor commands to the actual Git state instead of repeating a generic template:

- If Codex already created the commit, show only `git push origin main` on the Mac; do not tell the user to commit the same files again.
- If changes remain uncommitted, list the exact changed paths in `git add`, provide an appropriate commit message, and then show `git push origin main`.
- On the server, default to:

```bash
cd ~/web_shetya
git pull --ff-only origin main
npm run build
pm2 restart shetya --update-env
```

- If `package.json` or `package-lock.json` changed, add `npm ci` after `git pull` and before the build.
- If `prisma/schema.prisma` or `prisma/migrations/**` changed, explicitly include `npm run db:migrate`. Warn the user to take a database backup and deploy when no AI checks are active. For a migration that is incompatible with the currently running code, build first, then stop PM2 immediately before the migration:

```bash
npm run build
pm2 stop shetya
npm run db:migrate
pm2 restart shetya --update-env
```

- If production environment variables changed, explicitly tell the user which values to update before the PM2 restart.
- Never include `npm run db:seed` in a production deployment unless the user explicitly requests it.
- After restart, show only `pm2 status` by default. Do not include a streaming `pm2 logs` command in the normal deployment handoff.
- Include logs only when troubleshooting an observed failure, and keep the output bounded and non-streaming: `pm2 logs shetya --lines 20 --nostream`.

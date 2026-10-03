# Heirloom Database Migrations

Database migrations are tracked via Prisma in `apps/api/prisma/migrations/`.
All schema changes are version-controlled and applied through:
```bash
npx prisma migrate dev
```
Current active migration:
- `20261003144516_init_heirloom_foundation`

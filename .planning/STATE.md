# STATE — autonomous milestone 2026-08-21

**Branch:** feat/autonomous-2026-08
**Current phase:** 1 (not started)
**Blockers:** none

## Progress
- [ ] Phase 1: Fix условий при ручном создании занятия/ДЗ
- [ ] Phase 2: Звонки родителям (напоминания + история)
- [ ] Phase 3: Статистика по учителям для разработчика

## Decisions log
(product decisions made autonomously will be appended here)

## Notes
- Не деплоить на прод, не трогать существующие миграции, только новые.
- Не удалять/перезаписывать данные.
- В working tree есть незакоммиченные удаления старых файлов (.planning/audit-*, plans/, docs/ и т.п.) — НЕ коммитить их, коммитить только свои файлы адресно.

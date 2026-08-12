# Changelog

All notable changes to AI Viva are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Monorepo scaffold: Django modular monolith (`backend/`), React Vite SPA (`frontend/`).
- Docker Compose stack: PostgreSQL (pgvector), Redis, MinIO, backend (Daphne), Celery worker/beat, frontend, Prometheus, Grafana.
- Core Django apps and models: accounts, orgs, courses, assignments, rubrics, submissions, rag, questions, viva, assessments, ai, audit, common.
- AI provider abstraction with mock (default), OpenAI, and Gemini adapters.
- `.env.example`, root documentation set (`docs/`), ADRs, CONTRIBUTING, LICENSE, README.

### In progress

- Phase 0: repository setup, skeleton services, documentation baseline.

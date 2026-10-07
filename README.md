# SafeRoute Academy

SafeRoute Academy is a controlled beta/prototype for student-pilot safety intelligence and pre-flight risk awareness. The flight-school workspaces use persistent synthetic demo data and are not authoritative maintenance, training, or regulatory records.

## Current milestone

Step 3 of the beta sequence — persistent private demo workspaces — is complete on the prototype branch. The application implementation, database activation, data boundary and verification record are documented in [docs/milestones/step-3-persistent-demo-workspaces.md](docs/milestones/step-3-persistent-demo-workspaces.md).

The Step 3 persistence checklist is maintained in [docs/testing/step-3-persistence-checklist.md](docs/testing/step-3-persistence-checklist.md).

Step 2 — the interface freeze — remains recorded in [docs/milestones/step-2-interface-freeze.md](docs/milestones/step-2-interface-freeze.md). Its frozen regression suite and issue classification are maintained in:

- [docs/testing/step-2-regression-checklist.md](docs/testing/step-2-regression-checklist.md)
- [docs/triage/step-2-interface-triage.md](docs/triage/step-2-interface-triage.md)

Step 1 — the shared Academy → PAVE/FRAT integration — remains recorded in [docs/milestones/step-1-academy-pave-frat-integration.md](docs/milestones/step-1-academy-pave-frat-integration.md).

The Vercel branch preview is connected to the beta-only Supabase project. Those settings are scoped to the `academy-engineering-cfi-prototype` Preview environment and are not present in Production. Step 4 named authentication, invitations and enforced role-specific access has not started.

## Local verification

```text
npm test
npm run lint
npm run build
```

## Vite project notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

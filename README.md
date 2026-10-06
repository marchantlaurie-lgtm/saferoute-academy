# SafeRoute Academy

SafeRoute Academy is a controlled beta/prototype for student-pilot safety intelligence and pre-flight risk awareness. The flight-school workspaces currently use simulated, browser-session data and are not authoritative maintenance, training, or regulatory records.

## Current milestone

Step 1 of the beta sequence — the shared Academy → PAVE/FRAT integration — is documented in [docs/milestones/step-1-academy-pave-frat-integration.md](docs/milestones/step-1-academy-pave-frat-integration.md).

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

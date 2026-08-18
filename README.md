# CMS Power Platform Web Resources

This repository contains source-controlled assets used by CMS Power Platform solutions, including Power Apps, Dataverse plugins, and dataflows.

## Organization

- `/apps/`  
  App-specific code and resources
- `/shared/`  
  Cross-app reusable components (when appropriate)

## Guiding principle

Code starts app-specific and becomes shared **only when reuse is proven**.

This approach favors clarity, safety, and maintainability over premature abstraction.

## Documentation

- [Security Policy](./SECURITY.md)

## Power Platform solution source

The PAC scripts clone the `InitialITGO` unmanaged solution in PAC's YAML
source-control format from the reviewed
development environment in
[`apps/it-governance/solution-source.json`](./apps/it-governance/solution-source.json).
They never create, select, or modify PAC authentication profiles, and every
remote command receives that environment URL explicitly.

Authenticate to the configured development environment before using the
scripts:

```sh
pac auth create --environment https://itgovernancedev.crm9.dynamics.com
```

Preview all solution and canvas-source differences without modifying the
working tree:

```sh
npm run pac:diff
```

Export and replace the checked-out solution:

```sh
npm run pac:export
```

The export command requires PAC CLI 2.4.1 or newer and fails when the solution
folder contains uncommitted or untracked files. It clones into temporary storage, displays the
complete incoming file list, and requires confirmation before replacing the
checked-out folder. It never stages or commits the result automatically.

After exporting, inspect the complete Git diff and run the appropriate Power
Platform validation before committing. Changes to the configured environment,
solution name, or repository destination must be made through a reviewed change
to `solution-source.json`; UAT and production must not be configured as export
sources for this workflow.

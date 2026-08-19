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

### Prerequisites and PAC versions

Install Node.js LTS, the .NET 10 SDK, and the current PAC CLI as a global .NET
tool. The global PAC CLI performs authentication and `solution clone` commands:

```sh
dotnet tool install --global Microsoft.PowerApps.CLI.Tool
```

Canvas source comparison intentionally uses a second, repository-local PAC CLI
pinned to version 2.4.1 in [`.config/dotnet-tools.json`](./.config/dotnet-tools.json).
PAC 2.4.1 can unpack older canvas apps with `MSAppStructureVersion 2.0`; current
PAC releases reject those apps. Keeping the compatibility version local avoids
downgrading the global CLI used for solution operations.

Restore the pinned compatibility tool once after cloning the repository and
whenever the tool manifest changes:

```sh
npm run pac:setup
```

Do not globally downgrade PAC to 2.4.1. The scripts select the correct version
for each operation automatically.

Solution cloning has been validated with global PAC CLI 2.10.1. Newer global
versions are permitted, while canvas source expansion remains pinned to the
repository-local PAC CLI 2.4.1 compatibility version.

Solution comparison normalizes two PAC-generated identifiers that change on
otherwise identical clones: `<ProjectGuid>` in `.cdsproj` files and GUID-valued
`workflowName` entries inside canvas-app `ConnectionReferences`. The files are
still compared after normalization, so every other metadata or source change in
those same files remains visible.

### Authentication

Authenticate to the configured development environment before using the
scripts:

```sh
pac auth create --environment https://itgovernancedev.crm9.dynamics.com
```

If Windows selects the wrong Microsoft account, use device-code authentication
so you can explicitly choose the account that belongs to the Dev environment:

```sh
pac auth create --name "ITGO Dev" --environment https://itgovernancedev.crm9.dynamics.com --deviceCode
pac auth select --name "ITGO Dev"
```

### Compare and export

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

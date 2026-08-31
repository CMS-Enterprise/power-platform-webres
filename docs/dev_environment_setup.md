# Development Environment Setup




## Setting up pre-commit Git hooks

This repo uses [`pre-commit`](https://pre-commit.com/) to manage pre-commit Git hooks for maintaining several quality and stylistic standards; see [`.pre-commit-config.yaml`](/.pre-commit-config.yaml) for details.

**MacOS:** Install with `brew install pre-commit`.

**Windows+WSL:**
- First install Python's `pip` package manager with `sudo apt install python3-pip`.
- Then, install `pre-commit` with `pip install pre-commit`. This should install `pre-commit` in the `~/.local/bin` directory.
- Add this directory to your `PATH`. Add the following to `~/.bashrc`:
```bash
export PATH="$PATH:$HOME/.local/bin"
```

**All developers:**
- From the root of this repo, run `pre-commit install` to set up a Git pre-commit hook in `.git/hooks/pre-commit`.
- Then, run `pre-commit install-hooks` to install the environments for this project's specific hooks.

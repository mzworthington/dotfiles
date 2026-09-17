# dotfiles

[![Quality gate](https://img.shields.io/sonar/alert_status/mzworthington_dotfiles?server=https%3A%2F%2Fsonarcloud.io&style=for-the-badge&logo=sonarqube)](https://sonarcloud.io/summary/new_code?id=mzworthington_dotfiles)

Personal macOS machine setup: shell, tooling, and bootstrap scripts.

## Quick start (fresh machine)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/mzworthington/dotfiles/main/bootstrap.sh)"
```

Or, if you already have the repo:

```bash
git clone https://github.com/mzworthington/dotfiles.git ~/Documents/dev/dotfiles
cd ~/Documents/dev/dotfiles && ./bootstrap.sh
```

Override clone location or workspace directory:

```bash
DOTFILES_DIR=~/.dotfiles DEV_DIRECTORY=~/code ./bootstrap.sh
```

## What it does

1. Installs Xcode CLI tools and Homebrew (if missing)
2. Clones/updates this repo
3. Installs Oh My Zsh (if missing)
4. Links dotfiles into `~` via `install/link.sh`
5. Installs packages via Homebrew + mise via `install/software.sh`
6. Clones companion repos (e.g. [Waykit](https://github.com/mzworthington/waykit))

## Structure

```text
dotfiles/
├── .github/actions/          # reusable GitHub Actions (detect-release-changes, python-mise-verify, python-semantic-release)
├── bootstrap.sh              # one-command fresh machine setup
├── install/
│   ├── link.sh               # symlink home → repo
│   ├── software.sh           # brew + mise + extras
│   ├── repos.conf            # companion repos to clone
│   ├── homebrew/             # Brewfile (core, apps, ai)
│   ├── mise/config.toml      # language/tool versions
│   └── setup_local_ai.sh     # optional local AI setup
├── zsh/                      # .zshrc, .zprofile
├── completions/              # shell completions
├── config/                   # app config fragments
└── git/.gitignore_global
```

## Paths

| Variable | Default | Purpose |
|----------|---------|---------|
| `DOTFILES_DIR` | `~/Documents/dev/dotfiles` | Where this repo lives |
| `DEV_DIRECTORY` | `~/Documents/dev` | Your project workspace |

Shell config resolves `DOTFILES_DIR` from the `.zshrc` symlink location, so it works if you clone elsewhere (e.g. `~/.dotfiles`).

Never hardcode usernames like `/Users/you/…`. Use `$HOME`, `~`, or these variables.

| File | Purpose |
|------|---------|
| `~/.secrets` | API keys and tokens (from `secrets.example`) |
| `~/.local.zsh` | Machine-specific PATH and env (from `zsh/local.example.zsh`) |

### Install options

```bash
# CLI tools only, skip desktop apps and AI tooling
INSTALL_APPS=0 INSTALL_AI=0 ./bootstrap.sh

# Re-link after pulling changes
./install/link.sh

# Update software only
./install/software.sh
```

## Companion repos

Defined in `install/repos.conf`. Currently:

- **Waykit** → `$DEV_DIRECTORY/waykit` (symlinked to `~/.agents`; existing `$DEV_DIRECTORY/agent-lifecycle-kit` checkouts are reused)

## License

[Unlicense](./LICENSE) (public domain).

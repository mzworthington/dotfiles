eval "$(/opt/homebrew/bin/brew shellenv zsh)"

# Login shells (and some GUI apps) skip .zshrc; keep Apple container Docker shims on PATH.
_zprofile_path="${(%):-%N}"
[[ -L "$_zprofile_path" ]] && _zprofile_path="$(readlink "$_zprofile_path")"
export PATH="$(cd "$(dirname "$_zprofile_path")/.." && pwd)/bin:$PATH"
unset _zprofile_path

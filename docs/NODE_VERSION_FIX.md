# Fixing Node.js Version Mismatch

If you're seeing different Node.js versions in different directories, here's how to fix it:

## Problem

- Root folder shows: Node.js v20
- Backend folder shows: Node.js v12

This happens when:
1. Using nvm but not loading it properly in your shell
2. Multiple Node.js installations (system vs nvm)
3. Shell not sourcing nvm on startup

## Solution

### Step 1: Load nvm in Current Shell

```bash
# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Or if installed via Homebrew on Mac:
[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && \. "/opt/homebrew/opt/nvm/nvm.sh"
```

### Step 2: Use Node.js 20

```bash
# Install Node.js 20 if not already installed
nvm install 20

# Use Node.js 20
nvm use 20

# Set as default
nvm alias default 20
```

### Step 3: Auto-load nvm on Shell Startup

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Auto-use .nvmrc if present
autoload -U add-zsh-hook
load-nvmrc() {
  local node_version="$(nvm version)"
  local nvmrc_path="$(nvm_find_nvmrc)"

  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version=$(nvm version "$(cat "${nvmrc_path}")")

    if [ "$nvmrc_node_version" = "N/A" ]; then
      nvm install
    elif [ "$nvmrc_node_version" != "$node_version" ]; then
      nvm use
    fi
  elif [ "$node_version" != "$(nvm version default)" ]; then
    echo "Reverting to nvm default version"
    nvm use default
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
```

For bash, add to `~/.bashrc`:

```bash
# NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Auto-use .nvmrc
cdnvm() {
    command cd "$@" || return $?
    nvm_path=$(nvm_find_up .nvmrc | tr -d '\n')

    if [[ ! $nvm_path = *[^[:space:]]* ]]; then
        declare default_version;
        default_version=$(nvm version default);

        if [[ $default_version == "N/A" ]]; then
            nvm alias default node;
            default_version=$(nvm version default);
        fi

        if [[ $default_version != $(nvm current) ]]; then
            nvm use default > /dev/null;
        fi

        elif [[ -s $nvm_path/.nvmrc && -r $nvm_path/.nvmrc ]]; then
            declare nvm_version
            nvm_version=$(<"$nvm_path"/.nvmrc)

            declare locally_resolved_nvm_version
            locally_resolved_nvm_version=$(nvm ls --no-colors "$nvm_version" | tail -1 | tr -d '\n ')

            if [[ "$locally_resolved_nvm_version" == "N/A" ]]; then
                nvm install "$nvm_version";
            elif [[ $(nvm current) != "$locally_resolved_nvm_version" ]]; then
                nvm use "$nvm_version";
            fi
        fi
    }
}
alias cd='cdnvm'
cdnvm "$PWD"
```

### Step 4: Verify

```bash
# Reload shell
source ~/.bashrc  # or source ~/.zshrc

# Check version in root
cd /mnt/c/writable/git/nwpie/ReactProjects/react-ai-news
node --version  # Should show v20.x.x

# Check version in backend
cd backend
node --version  # Should show v20.x.x
```

### Step 5: Reinstall Dependencies

After fixing Node version:

```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

## Quick Fix (Temporary)

If you just want to use Node.js 20 right now:

```bash
# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node.js 20
nvm use 20

# Verify
node --version

# Now run your commands
cd backend
npm run dev
```

## Using .nvmrc Files

I've created `.nvmrc` files in the root and backend directories specifying Node.js 20. When you `cd` into these directories (with auto-loading configured), nvm will automatically switch to Node.js 20.

## Troubleshooting

### Issue: "nvm: command not found"

Install nvm first:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

### Issue: Still showing wrong version

1. Check which node is being used:
   ```bash
   which node
   ```

2. If it shows `/usr/bin/node`, you're using system Node, not nvm:
   ```bash
   nvm use 20
   which node  # Should show ~/.nvm/versions/node/v20.x.x/bin/node
   ```

3. Make sure nvm is loaded in your shell:
   ```bash
   type nvm  # Should show "nvm is a function"
   ```

### Issue: Different terminals show different versions

Make sure nvm is loaded in your shell startup file (`~/.bashrc` or `~/.zshrc`).


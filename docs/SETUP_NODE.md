# Setting Node.js 20 as Default

This guide shows you how to set Node.js 20 as the default version globally and for this project.

## Quick Setup (Recommended)

### ⚠️ Important: Load nvm First!

**If you see v12 even after setting default, nvm is not loaded in your current shell.**

Run this in your current terminal:

```bash
# Load nvm in current shell
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Now use Node.js 20
nvm use 20

# Verify
node --version  # Should now show v20.x.x
```

### Option 1: Use the Setup Script

```bash
# From project root
npm run setup-node
```

This will:
- Install Node.js 20 if not already installed
- Switch to Node.js 20
- Set Node.js 20 as the default version

### Option 2: Manual Setup

```bash
# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 20 (if not installed)
nvm install 20

# Use Node.js 20
nvm use 20

# Set as default (global)
nvm alias default 20

# Verify
node --version  # Should show v20.x.x
```

## Auto-Load nvm in Every Terminal

To automatically load nvm and use Node.js 20 when you open a terminal:

### Option 1: Use the Setup Script

```bash
# From project root
npm run setup-nvm
```

This automatically adds nvm configuration to your `~/.bashrc` or `~/.zshrc`.

### Option 2: Manual Setup

Add these lines to your `~/.bashrc` (or `~/.zshrc` for zsh):

```bash
# NVM Configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Auto-use Node.js 20 if available
if command -v nvm &> /dev/null; then
    nvm use 20 2>/dev/null || nvm use default 2>/dev/null
fi
```

Then reload your shell:

```bash
source ~/.bashrc  # or source ~/.zshrc
```

## Verify Setup

```bash
# Check Node.js version
node --version  # Should show v20.x.x

# Check which node is being used
which node  # Should show ~/.nvm/versions/node/v20.x.x/bin/node

# Check nvm default
nvm alias default  # Should show: default -> 20
```

## Project-Specific Auto-Switch

The project includes `.nvmrc` files that specify Node.js 20. With auto-loading configured, when you `cd` into the project directory, nvm will automatically switch to Node.js 20.

### For Bash Users

Add this to `~/.bashrc` for automatic `.nvmrc` detection:

```bash
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

### For Zsh Users

Add this to `~/.zshrc`:

```zsh
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

## Common Issue: Still Showing v12 After Setting Default

**Problem**: You set `nvm alias default 20` but `node --version` still shows v12.

**Cause**: nvm is not loaded in your current shell session. The system is using `/usr/bin/node` instead of nvm's Node.js.

**Solution**:

1. **Load nvm in current shell**:
   ```bash
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   ```

2. **Use Node.js 20**:
   ```bash
   nvm use 20
   ```

3. **Verify**:
   ```bash
   node --version  # Should show v20.x.x
   which node      # Should show ~/.nvm/versions/node/v20.x.x/bin/node
   ```

4. **To make permanent**, run:
   ```bash
   npm run setup-nvm
   source ~/.bashrc  # or source ~/.zshrc
   ```

Or use the quick load script:
```bash
source scripts/load-nvm.sh
```

## Troubleshooting

### Issue: "nvm: command not found"

Install nvm first:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

Then reload your shell or run:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### Issue: Still showing wrong version

1. Check if nvm is loaded:
   ```bash
   type nvm  # Should show "nvm is a function"
   ```

2. If not, load it:
   ```bash
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   ```

3. Check which node:
   ```bash
   which node
   # If it shows /usr/bin/node, you're using system Node, not nvm
   # Run: nvm use 20
   ```

### Issue: Version resets after closing terminal

Make sure you've added nvm configuration to your shell startup file (`~/.bashrc` or `~/.zshrc`) and reloaded it.

## Summary

**To set Node.js 20 as default globally:**

```bash
npm run setup-node
```

**To auto-load nvm in every terminal:**

```bash
npm run setup-nvm
source ~/.bashrc  # or source ~/.zshrc
```

After this, Node.js 20 will be used automatically whenever you open a terminal or work in this project!


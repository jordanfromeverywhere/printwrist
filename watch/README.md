# PrintWrist watch project

Pebble Time 2 (emery platform) watchapp plus PebbleKit JS companion.

## Toolchain

- Pebble tooling runs inside WSL Ubuntu 24.04 (not native Windows).
- pebble-tool: 5.0.40
- Active Pebble SDK: 4.33.1
- Node (bundled with the SDK, used for the JS build step): 18
- gcc: the SDK's bundled `arm-none-eabi-gcc` toolchain (installed with the SDK, no separate setup)

Verify with:

```bash
export PATH="$HOME/.local/bin:$PATH"
pebble --version
```

## Building

From Git Bash on Windows, invoke pebble-tool through WSL against the Windows-mounted
project path:

```bash
wsl -d Ubuntu -- bash -lc 'export PATH="$HOME/.local/bin:$PATH"; cd "/mnt/c/Users/cfran/OneDrive/Documents/Vault/PrintWrist/printwrist/watch" && pebble build 2>&1 | grep -v -E "SyntaxWarning|^\s+\"\"\""'
```

(pebble-tool prints harmless libpebble2 `SyntaxWarning`s on this Python version; the
`grep -v` filters them out. Pipe through `tr -d '\0'` if WSL output looks garbled.)

## Installing on the emulator

```bash
wsl -d Ubuntu -- bash -lc 'export PATH="$HOME/.local/bin:$PATH"; cd "/mnt/c/Users/cfran/OneDrive/Documents/Vault/PrintWrist/printwrist/watch" && pebble install --emulator emery'
```

Then stream logs:

```bash
wsl -d Ubuntu -- bash -lc 'export PATH="$HOME/.local/bin:$PATH"; cd "/mnt/c/Users/cfran/OneDrive/Documents/Vault/PrintWrist/printwrist/watch" && pebble logs --emulator emery'
```

Kill the emulator when done: `pebble kill` (same WSL invocation pattern).

The emulator needs a display; WSLg (bundled with WSL Ubuntu on Windows 11) provides one.

## Companion JS tests

Existing PebbleKit JS modules under `src/pkjs/` have plain Node tests (no framework, no
npm installs) under `test/`. Run them on Windows with:

```bash
cd watch && node --test test/*.test.js
```

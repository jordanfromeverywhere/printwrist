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

## Security Warning

Never sign in through `pebble emu-app-config`: the SDK helper logs the settings page's returned data, including your password.

## v1.0.2 acceptance (device test, 2026-09-23)

| Check | Result |
|---|---|
| Sign in without leaving the app, one code email | Pass |
| Up/Down screens (Status, Details, Filament) | Pass |
| Select menu, chamber light on/off | Pass (label lag fixed in v1.0.3, be8f3a9) |
| Refresh | Not yet tested |
| Print speed | Not yet tested |
| Pause with confirm, resume | Not yet tested |
| Stop (throwaway print) | Not yet tested |
| Airplane-mode recovery | Not yet tested |

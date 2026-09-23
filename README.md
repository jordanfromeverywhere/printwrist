# PrintWrist

Bambu Lab printer status on a Pebble Time 2. No server: your phone talks to Bambu Lab directly, and your password and token never go anywhere else.

## Install

The compiled watchapp (.pbw) is attached to GitHub Releases. Or build it yourself:

1. Clone this repo
2. `cd watch && pebble build`
3. Install from `watch/build/watch.pbw`

## Settings

Open the settings page at https://jordanfromeverywhere.github.io/printwrist/config/ on your phone to sign in with your Bambu Lab account.

Never sign in through the Pebble emulator: the SDK helper logs the settings page's returned data, including your password.

## v1 Limits

- Alerts only display while the app is open
- Photos in v1.1
- US region only
- Authenticator-app 2FA not supported

## Development

- `watch/`: Pebble watchapp and phone companion
- `tools/verify_cloud.py`: checks Bambu Cloud behavior against your own account (requires `pip install "paho-mqtt>=2.1" requests`)

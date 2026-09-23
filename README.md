# PrintWrist

Bambu Lab printer status on a Pebble Time 2. Watchapp + PebbleKit JS companion + a small stateless relay.

- `relay/`: FastAPI relay (stores nothing; your Bambu token passes through per request)
- `watch/`: Pebble watchapp and phone companion
- `tools/verify_cloud.py`: checks Bambu Cloud behavior against your own account

Self-host the relay: `docker build -t printwrist-relay relay && docker run -p 8000:8000 printwrist-relay`, then set the relay URL in PrintWrist settings.

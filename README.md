# DiscordRP — Roblox Studio Rich Presence

Local helper that shows Discord Rich Presence while you edit in Roblox Studio.

## Setup

1. Install dependencies, build, and install Startup + plugin:

```bat
npm install
npm run build
npm run install-startup
npm run install-plugin
```

The helper installs to `%LOCALAPPDATA%\DiscordRP\` and a **hidden** `DiscordRP.vbs` launcher goes in Startup (so no console window that can kill the process when closed).

2. Open Discord, then restart Roblox Studio.

**Keep only one presence plugin.** If you have both `DiscordRP.rbxmx` and `StudioDiscordPresence.lua`, delete one of them to avoid double requests / double warnings.

## If Studio says "Helper not reachable"

1. Check the helper is running: open `http://127.0.0.1:3847/health` in a browser  
2. Or run `npm run install-startup` again  
3. Logs: `%LOCALAPPDATA%\DiscordRP\discordrp.log`

## How it works

- Helper listens on `http://127.0.0.1:3847`
- Plugin heartbeats every 15s with `placeId` / `universeId` / name
- Helper fetches the game icon from Roblox thumbnails and sets Discord presence
- If Studio stops heartbeating (~45s) or the plugin unloads, presence is cleared
- Helper retries Discord IPC until Discord desktop is available

## Dev (without exe)

```bat
npm start
```

## Uninstall startup

```bat
npm run uninstall-startup
```

# DiscordRP — Roblox Studio Rich Presence

Local helper that shows Discord Rich Presence while you edit in Roblox Studio.

## Roblox plugin

Install from the Creator Store:  
[Rich Presence](https://create.roblox.com/store/asset/70734782627727/Rich-Presence)

## Setup

1. Install the [D Presence](https://create.roblox.com/store/asset/70734782627727/D-Presence) plugin in Roblox Studio.

2. Install the helper (build + Startup):

```bat
npm install
npm run build
npm run install-startup
```

The helper installs to `%LOCALAPPDATA%\DiscordRP\` and a **hidden** `DiscordRP.vbs` launcher goes in Startup (so no console window that can kill the process when closed).

3. Open Discord, then restart Roblox Studio.

**Keep only one presence plugin.** If you already have a local `StudioDiscordPresence.lua` or `DiscordRP.rbxmx`, remove it so it doesn’t conflict with the store plugin.

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

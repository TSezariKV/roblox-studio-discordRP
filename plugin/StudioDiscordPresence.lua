-- Studio Discord Presence
-- Install: copy to %LOCALAPPDATA%\Roblox\Plugins\
-- Requires DiscordRP helper on http://127.0.0.1:3847

local HttpService = game:GetService("HttpService")
local MarketplaceService = game:GetService("MarketplaceService")

local ENDPOINT = "http://127.0.0.1:3847/presence"
local CLEAR_ENDPOINT = "http://127.0.0.1:3847/clear"
local HEARTBEAT_SECONDS = 15

local warnedHelper = false

local function getProjectName()
	if game.PlaceId > 0 then
		local ok, info = pcall(function()
			return MarketplaceService:GetProductInfo(game.PlaceId)
		end)
		if ok and info and info.Name and info.Name ~= "" then
			return info.Name
		end
	end

	local name = game.Name
	if name == "" or name == "Game" then
		return "an untitled place"
	end
	return name
end

local function pushPresence()
	local name = getProjectName()
	local payload = {
		placeId = game.PlaceId,
		universeId = game.GameId,
		name = name,
		details = "Working in Roblox Studio",
		state = "Editing " .. name,
	}

	local ok = pcall(function()
		HttpService:PostAsync(
			ENDPOINT,
			HttpService:JSONEncode(payload),
			Enum.HttpContentType.ApplicationJson
		)
	end)

	if not ok and not warnedHelper then
		warnedHelper = true
		warn("[Discord Presence] Helper not reachable. Is DiscordRP running? (Startup / npm start)")
	end
end

local function clearPresence()
	pcall(function()
		HttpService:PostAsync(CLEAR_ENDPOINT, "{}", Enum.HttpContentType.ApplicationJson)
	end)
end

task.defer(pushPresence)

local heartbeat = task.spawn(function()
	while true do
		task.wait(HEARTBEAT_SECONDS)
		pushPresence()
	end
end)

game:GetPropertyChangedSignal("Name"):Connect(function()
	task.defer(pushPresence)
end)
game:GetPropertyChangedSignal("PlaceId"):Connect(function()
	task.defer(pushPresence)
end)

plugin.Unloading:Connect(function()
	task.cancel(heartbeat)
	clearPresence()
end)

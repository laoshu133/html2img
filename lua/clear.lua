#!/usr/bin/lua
local tmpImgDir = "/data/storage/material_icon/"
local curTimestamp = os.time()-24*60*60
local imgDirPrefix = os.date("%Y%m%d",curTimestamp)
local curDateHour = os.date("%H")
local imgDir
if tonumber(curDateHour) > 0 then
	for i=0,tonumber(curDateHour)-1,1 do
		if i < 10 then
			imgDir = imgDirPrefix.."0"..i
		else
			imgDir = imgDirPrefix..i
		end
		os.execute("rm -rf "..tmpImgDir..imgDir)
	end
else
	local yesterdayTimestamp = curTimestamp - 24*60*60
	imgDirPrefix = os.date("%Y%m%d",yesterdayTimestamp)
	os.execute("rm -rf "..tmpImgDir..imgDirPrefix.."23")
end

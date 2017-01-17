#!/usr/bin/lua
local tmpImgDir = "/var/tmp/material_icon/"
local curTimestamp = os.time()
local imgDirPrefix = os.date("%Y%m%d",curTimestamp)
local curDateHour = os.date("%H")
local imgDir
for i=0,tonumber(curDateHour)-1,1 do
	if i < 10 then
		imgDir = imgDirPrefix.."0"..i
	else
		imgDir = imgDirPrefix..i
	end
	os.execute("rm -rf "..tmpImgDir..imgDir)
end

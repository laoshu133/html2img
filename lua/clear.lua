#!/usr/bin/lua
local tmpImgDir = "/var/tmp/material_icon/"
for i=1,3,1 do
	local curTimestamp = os.time()
	local oldTimestamp = curTimestamp - i*24*60*60
	local imgDir = os.date("%Y%m%d",oldTimestamp)
	os.execute("rm -rf "..tmpImgDir..imgDir)
end

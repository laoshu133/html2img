local upload = require "resty.upload"
local cjson = require "cjson"
local chunk_size = 8192
local form,err = upload:new(chunk_size)
local tid = ngx.var.arg_id
local imgDir = "/data/storage/material_icon/"
local file
local fileName
local response = {
    status = "success",
    desc = "",
    result = {}
}
ngx.header.content_type = "application/json;charset=utf-8"
if not form then
    ngx.log(ngx.ERR,"failed to new upload:",err)
    response.status = "error"
    response.desc = err
    ngx.say(cjson.encode(response))
    return
end

form:set_timeout(16000)
while true do
    local typ,res,err = form:read()
    if not typ then
        response.status = "error"
        response.desc = err
        ngx.say(cjson.encode(response))
        return
    end
    if typ == "header" then
        if not fileName then
            local filenameRegex = "filename=\"[^\"]*\\.(\\w+)\""
            local m = ngx.re.match(res[2],filenameRegex)
            if m then
                local tmpDir = os.date("%Y%m%d%H")
                local time = os.time()
                fileName = tmpDir.."/"..tid.."_"..time.."."..m[1]
                file = io.open(imgDir..fileName,"w")
                if not file then
                    --[[ 失败尝试创建一次临时图片目录 ]]--
                    os.execute("mkdir "..imgDir.."/"..tmpDir)
                    file = io.open(imgDir..fileName,"w")
                end
                if not file then
                    response.status = "success"
                    response.desc = "fail to open tmp upload file"
                    ngx.say(cjson.encode(response))
                    return
                end
            end
        end
    elseif typ == "body" then
        if file then
            file:write(res)
        end
    elseif typ == "part_end" then
        file:close()
        file = nil
    elseif typ == "eof" then
        break
    else
    end
end

if fileName then
    response.status = "success"
    if ngx.var.icon_img_url then
        response.result["upload_file"] = "http://"..ngx.var.icon_img_url.."/"..fileName
    else
        response.result["upload_file"] = fileName
    end
    ngx.say(cjson.encode(response))
end

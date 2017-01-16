local upload = require "resty.upload"
local cjson = require "cjson"
local chunk_size = 4096
local form,err = upload:new(chunk_size)
local tid = ngx.var.arg_tid
local tmpDir = "/var/tmp/material_image/"
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

form:set_timeout(1000)
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
                local time = os.time()
                fileName = "makeicon_"..time.."_"..tid.."."..m[1]
                file = io.open(tmpDir..fileName,"w")
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
    response.result["upload_file"] = fileName
    ngx.say(cjson.encode(response))
end

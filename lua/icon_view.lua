local cjson = require "cjson"
local template = require "resty.template"
ngx.header.content_type = "text/html; charset=UTF-8"
local params = ngx.unescape_uri(ngx.var.arg_params)
local iconParams = cjson.decode(params)
local iconImgPath = ngx.var.arg_imgP
local waterPrice = ngx.var.arg_price
if waterPrice == nil then
	ngx.exit(500)
	return
end
local view = template.new "icon_templet.html"
local picWidth = iconParams['picWidth']
local picHeight = iconParams['picHeight']
local left = iconParams['left']
local top = iconParams['top']
--[[ 保留两位小数四舍五入(math.round) ]]--
local scale = math.floor((picWidth / iconParams['w']) * 100 + 0.5) / 100
view.iconImgPath = iconImgPath
view.waterPrice = waterPrice
view.textWidth = iconParams['textWidth']
view.width = picWidth
view.height = picHeight
if iconParams['textWidth'] ~= nil then
	view.textWidth = iconParams['textWidth'] * scale
else
	view.textWidth = 32 * scale
end
view.textLeft = left * scale
view.textTop = top * scale
view.color = iconParams['color']
view.textAlign = iconParams['textA']
view.textDecoration = iconParams['textD']
view.verticalAlign = iconParams['verticalA']
view.fontSize = iconParams['fontSize'] * scale
view.fontFamily = iconParams['fontFamily']
view.letterSpacing = iconParams['letterS']
view.fontStyle = iconParams['fontStyle']
view.fontWeight = iconParams['fontW']
view.lineHeight = iconParams['lineH']
local transform = {iconParams["a"],iconParams["b"],iconParams["c"],iconParams["d"],iconParams["tx"],iconParams["ty"]}
view.transform = table.concat(transform,",")
view:render()
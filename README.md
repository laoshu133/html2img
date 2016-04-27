# html2img

## Server

```
node server.js
```

## Client

截图

```
node client-makeshot.js
```

取文件/清理文件

```
node client-getfile.js
```


## Support Actions

- makeshot

  生成缩略图

- getfile

  获取生成的文件

- clean

  清理生成的文件(夹)


## config 所有参数

```
{
  "url": null,
  "content": "",
  "action": "makeshot",
  "actionOptions": null,
  "htmlTpl": "taobao_desc.html",
  "optimizeImage": false,
  "imageType": "png",
  "imageQuality": 90,
  "imageBlank": "http://wscdn.huanleguang.com/assets/img/blank.png",
  "wrapSelector": ".shot_flag_wrap_panel",
  "requestHeaders": null,
  "viewport": null,
  "size": null
}
```

*部分参数说明*

```
id - 必填，标识，用于区分唯一性
action - 必填，任务类型
description - 选填，任务说明
outPath - 相对路径、绝对路径均支持，需要有读写权限
htmlTpl - 选填，HTML模板，用于包装 `content`，默认 tb_desc
viewport - 选填，浏览器视窗大小，如果需要导出的图片大小大于默认视窗大小，需要手动指定，默认 [1024, 800]
size - 选填，导出图片大小，裁剪类型，详见 `size`参数说明
```

*`size`参数说明*

```
/**
 * type - 裁剪类型，默认  10
 * 10 - 长边裁剪，圆点中心，不足补白
 * 11 - 长边裁剪，圆点左上，不足补白
 * 12 - 长边裁剪，圆点左上，不足不处理
 * 20 - 短边裁剪，圆点中心，不足不处理
 * 21 - 短边裁剪，圆点左上，不足不处理
 */
{
  type: 10,
  width: 320, // 如果为空不处理宽高，默认空
  height: 180 // 指定 width 时必须指定 height，默认空
}
```

## Scoket 流协议

*规则*

```
{ HEAD_CODE }-{ TYPE_LENGTH }-{ TYPE }-{ BODY_CODE }-{ BODY_LENGTH }-{ BODY }
-----------------------------------------------------------------------------
|  Int16LE  |-|   Int32LE   |-|String|-|  Int16LE  |-|   Int32LE   |-|Buffer|
```

*说明*

1. `HEAD_CODE` 始终为 `1`
2. `BODY_LENGTH` 可以为 `0`，即 `BODY` 可以为空

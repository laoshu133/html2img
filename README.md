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

取文件

```
node client-getfile.js
```

## Support Actions

- makeshot
- getfile

## config 参数说明

```
{
  "id": null,
  "action": "hello",
  "description": "任务说明",
  "listenPort": 3000,
  "htmlTpl": "tb_desc.html",
  "url": null,
  "outPath": "__out",
  "wrapSelector": ".hlg_flag_wrap_panel",
  "replaceSelector": ".hlg_flag_replace_place",
  "horsemanConfig": {
    "phantomPath": "/usr/local/bin/phantomjs"
  },
  "viewport": null,
  "size": {
    "width": 620,
    "height": 590
  }
}
```
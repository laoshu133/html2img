# html2img

A fast screenshot server, base on PhantomJS and Koa.

## 安装与启动

1. 安装依赖

    ```
    npm i
    ```

2. 基础配置

    复制基本配置

    ```
    cp .env.example .env
    ```

    配置服务器域名，将文件内 `WWW_HOST` 改为自己的域名或 IP

    ```
    vim .env

    ```

3. 启动

    此时已经可以使用 `node app.js` 启动 Server，
    不过强烈建议使用 pm2 管理服务

    ```
    npm i -g pm2
    npm start
    ```


## 使用非常非常简单

比如对某个网站截图

```
curl http://shot.huanleguang.cn/?url=http://meiyaapp.com
```

直接返回图片

```
curl -I http://shot.huanleguang.cn/?url=http://meiyaapp.com&dataType=image
```

按选择器截图多张图片

```
curl http://shot.huanleguang.cn/?url=http://meiyaapp.com&wrapSelector=.floor
```

自定义宽高以及裁剪方式

```
curl -H "Content-type: application/json" -X POST -d '{"url":"http://meiyaapp.com","wrapSelector":"body","imageSize":{"type":21,"width":1200,"height":800},"viewport":[1200,800]}' http://shot.huanleguang.cn
```

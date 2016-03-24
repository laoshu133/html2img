<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Layout test</title>
    <style type="text/css">
    *{ margin: 0; padding: 0;}
    .container{
        border: 1px solid green;
        padding: 10px;
        position: absolute;
        left: 50%;
        top: 10px;
        -webkit-transform: translate(-50%, 0);
        transform: translate(-50%, 0);
    }
    .container .panel{
        position: relative;
        z-index: 1;
    }
    .container .mask{
        position: absolute;
        left: 10px;
        top: 10px;
        z-index: 3;
    }
    .container .mask a{
        box-shadow: 0 0 5px green;
    }
    </style>
    <style id="J_Taobao_css"></style>
    <script src="../../node_modules/jquery/dist/jquery.min.js"></script>
    <script src="../../lib/client-tools.js"></script>
</head>
<body>
    <div class="container">
        <div class="panel main"></div>
        <div class="panel mask"></div>
    </div>

    <?php
    $cfg = isset($_GET['cfg']) ? $_GET['cfg'] : '';
    if(!$cfg) {
        $cfg = 'makelist.json';
    }

    $cfg = dirname(__FILE__) .'/../../demos/'. $cfg;
    $config = json_decode(file_get_contents($cfg), true);

    // merge config
    $defCfgPath = dirname(__FILE__) .'/../../config.default.json';
    $defConfig = json_decode(file_get_contents($defCfgPath), true);

    foreach ($defConfig as $key => $value) {
        if(!isset($config[$key])) {
            $config[$key] = $value;
        }
    }
    ?>
    <script>
    jQuery(function($) {
        var config = <?php echo json_encode($config);?>;

        $('.main').html(config.content);

        var listData = dsTools.covertList({
            type: config.listOutType || 'map',
            imageBlank: config.imageBlank,
            selector: '.main'
        });

        console.log(listData);

        if(listData.status === 'success') {
            var html = listData.html;
            var extName = config.imageType || 'png';
            var imgUrl = '../../__out/' + config.id;
            imgUrl += '/out.' + extName;

            html = html.replace('{imgUrl}', imgUrl);

            $('.mask').html(html);
        }
        else {
            $('.mask').html('Covert error!!!');
        }
    });
    </script>
</body>
</html>
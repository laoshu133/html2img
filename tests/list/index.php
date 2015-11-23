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
    .container .mask area{
        outline: 1px green;
    }
    </style>
    <script src="../../lib/jquery.min.js"></script>
    <script src="../../lib/client-tools.js"></script>
</head>
<body>
    <div class="container">
        <div class="panel main"></div>
        <div class="panel mask"></div>
    </div>

    <?php
    $tpl = isset($_GET['tpl']) ? $_GET['tpl'] : '';
    $type = isset($_GET['type']) ? $_GET['type'] : '';
    if(!$tpl) {
        $tpl = 'tpl.html';
    }
    if(!$type) {
        $type = 'map';
    }

    $data = array();
    $data['type'] = $type;

    $tpl = dirname(__FILE__) .'/'. $tpl;
    $data['content'] = file_get_contents($tpl);
    ?>
    <script>
    jQuery(function($) {
        var data = <?php echo json_encode($data);?>

        $('.main').html(data.content);

        var listData = dsTools.covertList({
            selector: '.main',
            type: 'map'
        });

        console.log(listData);

        if(listData.status === 'success') {
            $('.mask').html(listData.html);
        }
        else {
            $('.mask').html('Covert error!!!');
        }
    });
    </script>
</body>
</html>
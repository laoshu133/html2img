clipServerNum=`ps -fe | grep server.js | grep -v grep | wc -l`
if [ $clipServerNum -lt 1 ]; then
	phantomNum=`ps -fe | grep phantomjs | grep -v grep | wc -l`
	if [ $phantomNum -gt 0 ]; then
		`kill \`ps -fe | grep phantomjs | grep -v grep | awk '{print $2}'\``
	fi
	`nohup /usr/local/node/bin/node /service/html2img/server.js >/service/html2img/server 2>&1 &`
fi

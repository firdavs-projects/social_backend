#!/bin/sh

mysqld --basedir=/opt/mysql/mysql --datadir=/opt/mysql/mysql/data &>/dev/null &

./wait-for.sh localhost:33060 -- node /app/main.js

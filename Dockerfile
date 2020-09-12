FROM ubuntu:focal

ENV TZ=Asia/Dushanbe

RUN apt-get update && apt-get install -y curl && \
    curl -sL https://deb.nodesource.com/setup_14.x | bash - && \
    apt-get install nodejs -y && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone && \
    apt-get install -y --no-install-recommends mysql-server mysql-client netcat

COPY ./init.sql /tmp/init.sql
RUN mkdir /var/run/mysqld && \
    chown mysql:mysql /var/run/mysqld && \
    mkdir -p /opt/mysql/mysql/data && \
    chown -R mysql:mysql /opt/mysql/mysql && \
    chmod 750 /opt/mysql/mysql/data && \
    mysqld --initialize-insecure --user=mysql --basedir=/opt/mysql/mysql --datadir=/opt/mysql/mysql/data --init_file=/tmp/init.sql

COPY ./*.sh ./app/
RUN chmod +x ./app/*.sh

WORKDIR /app
COPY ./*.js* /app/
RUN npm install

EXPOSE 9999

CMD ["/app/run.sh"]

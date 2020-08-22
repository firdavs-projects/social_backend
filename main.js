'use strict';

const http = require('http');

const port = 9999;
const statusOk = 200;
const statusBadRequest = 400;
const statusNotFound = 404;

let nextId = 1;
const posts = [];

function sendResponse(response, { status = statusOk, headers = {}, body = null }) {
    Object.entries(headers).forEach(function ([key, value]) {
        response.setHeader(key, value);
    });
    response.writeHead(status);
    response.end(body);
}

function sendJSON(response, body) {
    sendResponse(response, {
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
}

const methods = new Map();
methods.set('/posts.get', function ({ response }) {
    sendJSON(response, posts);
});

methods.set('/posts.getById', function ({ response, searchParams }) {
    const id = searchParams.get('id');
    if (!searchParams.has('id') | isNaN(Number(id)) | id === '') {
        sendResponse(response, { status: statusBadRequest });
        return;
    }
    const post = posts.find(el => el.id === Number(id));
    if (!post) {
        sendResponse(response, { status: statusNotFound });
        return;
    }
    sendJSON(response, post);
});

methods.set('/posts.post', function ({ response, searchParams }) {

    const content = searchParams.get('content');
    if (!searchParams.has('content') | content === '') {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const post = {
        id: nextId++,
        content: content,
        created: Date.now(),
    };

    posts.unshift(post);
    sendJSON(response, post);
});

methods.set('/posts.edit', function () { });
methods.set('/posts.delete', function () { });

const server = http.createServer(function (request, response) {

    const { pathname, searchParams } = new URL(request.url, `http://${request.headers.host}`);

    const method = methods.get(pathname);
    if (method === undefined) {
        sendResponse(response, { status: statusNotFound });
        return;
    }

    const params = {
        request,
        response,
        pathname,
        searchParams,
    };

    method(params);

});

server.listen(port);

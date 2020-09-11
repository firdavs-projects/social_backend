'use strict';

const http = require('http');
const mysqlx = require('@mysql/xdevapi');
const { table } = require('console');

const port = process.env.PORT || 9999;
const statusOk = 200;
const statusNoContent = 204;
const statusBadRequest = 400;
const statusNotFound = 404;
const statusInternalServerError = 500;
const schema = 'social';

let nextId = 1;
const posts = [];

const client = mysqlx.getClient({
    user: 'app',
    password: 'pass',
    host: '0.0.0.0',
    port: 3306
});

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

function map(columns) {
    return row => row.reduce((res, value, i) => ({ ...res, [columns[i].getColumnLabel()]: value }), {});
}

const methods = new Map();
methods.set('/posts.get', async ({ response, db }) => {
    const table = await db.getTable('posts');
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .orderBy('created DESC')
        .execute();
    const data = result.fetchAll();
    result.getAffectedItemsCount();
    const columns = result.getColumns();
    const posts = data.map(columns);
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
    } else {
        if (post.removed === true) {
            sendResponse(response, { status: statusNotFound });
            return;
        }
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
        removed: false,
    };
    posts.unshift(post);
    sendJSON(response, post);
});

methods.set('/posts.edit', function ({ response, searchParams }) {
    const id = searchParams.get('id');
    const content = searchParams.get('content');
    if (!searchParams.has('id') | isNaN(Number(id)) | id === '' | !searchParams.has('content') | content === '') {
        sendResponse(response, { status: statusBadRequest });
        return;
    }
    const post = posts.find(el => el.id === Number(id));
    if (!post) {
        sendResponse(response, { status: statusNotFound });
        return;
    } else {
        if (post.removed === true) {
            sendResponse(response, { status: statusNotFound });
            return;
        }
    }
    const index = posts.findIndex(o => o.id === Number(id));
    posts[index].content = content;
    sendJSON(response, posts[index]);
});

methods.set('/posts.delete', async ({ response, searchParams, db }) => {
    if (!searchParams.has('id')) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const id = Number(searchParams.get('id'));
    if (Number.isNaN(id)) {
        sendResponse(response, { status: statusBadRequest });
        return;
    }

    const table = await db.getTable('posts');
    const result = await table.update()
        .set('removed', true)
        .where('id=:id')
        .bind('id', id)
        .execute();
    const removed = result.getAffectedItemsCount();

    if (removed === 0) {
        sendResponse(response, { status: statusNotFound });
        return;
    }
    sendResponse(response, { status: statusNoContent });
});

methods.set('/posts.restore', function ({ response, searchParams }) {
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
    const index = posts.findIndex(o => o.id === Number(id));
    if (post.removed === true) {
        posts[index].removed = false;
        sendJSON(response, posts[index]);
        return;
    }
    sendResponse(response, { status: statusBadRequest });
});

const server = http.createServer(async (request, response) => {
    const { pathname, searchParams } = new URL(request.url, `http://${request.headers.host}`);

    const method = methods.get(pathname);
    if (method === undefined) {
        sendResponse(response, { status: statusNotFound });
        return;
    }
    let session = null;
    try {
        session = await client.getSession();
        const db = await session.getschema(schema);

        const params = {
            request,
            response,
            pathname,
            searchParams,
            db,
        };

        await method(params);
    } catch (e) {
        sendResponse(response, { status: statusInternalServerError });
    } finally {
        if (session !== null) {
            try {
                await session.close();
            } catch (e) {
                console.log(e);
            }
        }
    }
});

server.listen(port);

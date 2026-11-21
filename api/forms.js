import handler from './[...path].js';

export default async function formsHandler(req, res) {
    const originalUrl = req.url;
    const url = new URL(req.url, 'http://localhost');
    const formPath = url.searchParams.get('formPath') || '';

    url.searchParams.delete('formPath');

    url.pathname =
        '/api/forms' + (formPath ? '/' + formPath : '');

    req.url = url.pathname + url.search;

    try {
        return await handler(req, res);
    } finally {
        req.url = originalUrl;
    }
}
// Public front for dossierly.pages.dev: every request is served by the dossierly app Worker.
export default { fetch: (req, env) => env.APP.fetch(req) };

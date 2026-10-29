import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No ISR/SSG cache: the app is client-rendered with route handlers, so the default (no incremental cache) is enough.
export default defineCloudflareConfig();

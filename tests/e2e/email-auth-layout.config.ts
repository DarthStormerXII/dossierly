import { defineConfig } from "@playwright/test";
import emailAuth from "./email-auth.config";

export default defineConfig({ ...emailAuth, testMatch: "email-auth-layout.spec.ts" });
